import type {
  BacktestResult,
  GridSearchResult,
  OptimizationMetric,
  OptimizationResultEntry,
} from "trendcraft";
import { describe, expect, it } from "vitest";
import { computeDeflatedSharpe } from "../robustness";

/**
 * Minimal optimization entry — `computeDeflatedSharpe` only reads `score`
 * (to pick the selected combination) and `backtest.trades[].returnPercent`
 * (to derive per-return Sharpes), so the rest of the BacktestResult is
 * stubbed.
 */
function entry(score: number, returnPercents: number[]): OptimizationResultEntry {
  return {
    params: {},
    score,
    metrics: {} as Record<OptimizationMetric, number>,
    backtest: {
      trades: returnPercents.map((rp) => ({ returnPercent: rp })),
    } as unknown as BacktestResult,
    passedConstraints: true,
  };
}

function gridResult(entries: OptimizationResultEntry[]): GridSearchResult {
  const best = entries.reduce((a, b) => (b.score > a.score ? b : a), entries[0]);
  return {
    bestParams: {},
    bestScore: best ? best.score : null,
    metric: "sharpe",
    totalCombinations: entries.length,
    validCombinations: entries.length,
    results: entries,
  };
}

// A strong, low-variance winner plus three weaker, distinct trials.
const BEST = entry(3, [5, 4, 6, 5]);
const A = entry(1, [1, -1, 2, -2]);
const B = entry(2, [3, -1, 2, 0]);
const C = entry(0, [-1, -2, 1, 0]);

describe("computeDeflatedSharpe", () => {
  it("returns empty when there are fewer than two combinations to correct against", () => {
    const result = computeDeflatedSharpe(gridResult([BEST]));
    expect(result.kind).toBe("empty");
  });

  it("returns empty when the selected combination has too few trades for a Sharpe", () => {
    // Highest score but only one trade — no Sharpe estimate possible.
    const result = computeDeflatedSharpe(gridResult([entry(9, [4]), A, B]));
    expect(result).toEqual({
      kind: "empty",
      message: "Selected combination has too few trades for a Sharpe estimate",
    });
  });

  it("produces a probability in [0, 1] and reports the selected combination's stats", () => {
    const result = computeDeflatedSharpe(gridResult([A, BEST, B, C]));
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.probability).toBeGreaterThanOrEqual(0);
    expect(result.probability).toBeLessThanOrEqual(1);
    // Stats describe the highest-scoring (selected) combination, BEST.
    expect(result.sampleSize).toBe(4);
    expect(result.observedSharpe).toBeGreaterThan(0);
    expect(result.trials).toBe(4);
  });

  it("selects the highest-scoring combination regardless of array order", () => {
    const ordered = computeDeflatedSharpe(gridResult([A, B, C, BEST]));
    const shuffled = computeDeflatedSharpe(gridResult([BEST, C, A, B]));
    expect(ordered).toEqual(shuffled);
  });

  it("deflates harder as more trials are searched (selection bias grows with N)", () => {
    // Duplicating the whole trial set keeps the Sharpe distribution's mean
    // and variance identical while tripling N, isolating the trial-count
    // term: a wider search over the same-shaped results must deflate more.
    const base = [BEST, A, B, C];
    const few = computeDeflatedSharpe(gridResult(base));
    const many = computeDeflatedSharpe(gridResult([...base, ...base, ...base]));
    expect(few.kind).toBe("ok");
    expect(many.kind).toBe("ok");
    if (few.kind !== "ok" || many.kind !== "ok") return;
    expect(many.trials).toBe(12);
    expect(many.observedSharpe).toBeCloseTo(few.observedSharpe, 10);
    expect(many.probability).toBeLessThan(few.probability);
  });

  it("drops combinations with too few trades from the trial set rather than failing", () => {
    // The single-trade combo can't yield a Sharpe; it must be excluded
    // from the trial count instead of poisoning the variance.
    const result = computeDeflatedSharpe(gridResult([BEST, A, B, entry(0, [2])]));
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.trials).toBe(3);
  });

  it("returns empty when filtering leaves fewer than two trial Sharpes", () => {
    // Two combinations, but the non-selected one has a single trade and is
    // filtered out — the lone remaining Sharpe carries no selection-bias
    // spread, so reporting an OK "best of 1" would be a no-op correction.
    const result = computeDeflatedSharpe(gridResult([BEST, entry(0, [2])]));
    expect(result).toEqual({
      kind: "empty",
      message: "Need ≥ 2 combinations with enough trades to correct for selection bias",
    });
  });
});
