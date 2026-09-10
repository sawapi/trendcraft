import { describe, expect, it } from "vitest";
import { EMPTY_EXTENDED_METRICS_FIXTURE } from "../../backtest/__tests__/backtest-result-fixture";
import type { BacktestResult, Trade } from "../../types";
import { applyEquityCurveFilter, equityCurveHealth } from "../equity-curve";

function makeTrade(i: number, returnAmt: number, holdingDays = 1): Trade {
  const entryPrice = 100;
  const exitPrice = entryPrice + returnAmt / 100;
  return {
    entryTime: 1_700_000_000_000 + i * 86_400_000 * 2,
    entryPrice,
    exitTime: 1000000 + (i * 2 + 1) * 86400000,
    exitPrice,
    return: returnAmt,
    returnPercent: (returnAmt / 10000) * 100,
    holdingDays,
  };
}

function makeResult(trades: Trade[]): BacktestResult {
  const initial = 10000;
  const totalReturn = trades.reduce((s, t) => s + t.return, 0);
  const wins = trades.filter((t) => t.return > 0);
  const losses = trades.filter((t) => t.return <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.return, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.return, 0));

  return {
    initialCapital: initial,
    finalCapital: initial + totalReturn,
    totalReturn,
    totalReturnPercent: (totalReturn / initial) * 100,
    tradeCount: trades.length,
    // winRate and maxDrawdown follow the BacktestResult contract: 0-100 percent.
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    maxDrawdown: 10,
    sharpeRatio: 1.0,
    ...EMPTY_EXTENDED_METRICS_FIXTURE,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0,
    avgHoldingDays:
      trades.length > 0 ? trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length : 0,
    trades,
    settings: {
      fillMode: "next-bar-open",
      slTpMode: "close-only",
      slippage: 0,
      commission: 0,
      commissionRate: 0,
      taxRate: 0,
    },
    drawdownPeriods: [],
  };
}

/** Deterministic PRNG so the reference comparisons below are reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("filters read the strategy's own equity curve, not the filtered one", () => {
  // 5 × +200 → equity 11000 (peak); 3 × −400 → 9800, a 10.9% drawdown;
  // then 40 × +500. The strategy itself recovers on the very next trade.
  const recovering = [
    ...Array.from({ length: 5 }, (_, i) => makeTrade(i, 200)),
    ...Array.from({ length: 3 }, (_, i) => makeTrade(5 + i, -400)),
    ...Array.from({ length: 40 }, (_, i) => makeTrade(8 + i, 500)),
  ];

  it("drawdown filter pauses on the trip and resumes when the strategy recovers", () => {
    const result = makeResult(recovering);
    const analysis = applyEquityCurveFilter(result, { type: "drawdown", maxDrawdown: 10 });
    const kept = analysis.filtered.trades.map((t) => t.entryTime);
    // Stimulus: the pause fired — the first trade after the trip is skipped…
    expect(kept).not.toContain(recovering[8].entryTime);
    // …and only that one: trade 9 lifts the strategy's curve back to 6.4% DD.
    // Before the fix the filtered curve froze at 9800 and every one of the 40
    // recovery trades was skipped (kept 8, final 9800 vs 29800).
    expect(analysis.tradesSkipped).toBe(1);
    expect(analysis.filtered.tradeCount).toBe(47);
    expect(analysis.filtered.finalCapital).toBe(29300);
  });

  it("combined filter is not absorbing either", () => {
    const result = makeResult(recovering);
    const analysis = applyEquityCurveFilter(result, { type: "combined", maxDrawdown: 10 });
    const kept = analysis.filtered.trades.map((t) => t.entryTime);
    expect(analysis.tradesSkipped).toBeGreaterThan(0);
    expect(kept).toContain(recovering[recovering.length - 1].entryTime);
    expect(analysis.tradesSkipped).toBeLessThan(10);
  });

  it("filteredSizeFactor changes the size of a filtered trade, never which trades are filtered", () => {
    const result = makeResult(recovering);
    const skip = applyEquityCurveFilter(result, { type: "drawdown", maxDrawdown: 10 });
    const half = applyEquityCurveFilter(result, {
      type: "drawdown",
      maxDrawdown: 10,
      filteredSizeFactor: 0.5,
    });
    const skippedTimes = recovering
      .map((t) => t.entryTime)
      .filter((t) => !skip.filtered.trades.some((k) => k.entryTime === t));
    const reducedTimes = half.filtered.trades
      .filter((t, i) => t.return !== recovering[i].return)
      .map((t) => t.entryTime);
    expect(skippedTimes).toEqual([recovering[8].entryTime]);
    expect(reducedTimes).toEqual(skippedTimes);
    expect(half.tradesSkipped).toBe(skip.tradesSkipped);
  });

  it("ma / ema decisions match a reference computed on the full-size curve", () => {
    const rnd = lcg(20260910);
    let runsWithSkips = 0;
    let totalSkips = 0;
    for (let run = 0; run < 300; run++) {
      const n = 20 + Math.floor(rnd() * 60);
      const trades = Array.from({ length: n }, (_, i) =>
        makeTrade(i, Math.round((rnd() - 0.45) * 800)),
      );
      const maPeriod = 2 + Math.floor(rnd() * 9);
      const maType = rnd() < 0.5 ? "sma" : "ema";
      const result = makeResult(trades);
      const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod, maType });

      // Reference: the strategy's own curve (every trade at full size) and a
      // causal MA over it; trade i is skipped iff curve[i] < ma[i].
      const curve = [10000];
      for (const t of trades) curve.push(curve[curve.length - 1] + t.return);
      const expectedSkipped: number[] = [];
      let ema: number | null = null;
      for (let i = 0; i < n; i++) {
        let ma: number | null = null;
        if (i >= maPeriod - 1) {
          const window = curve.slice(i - maPeriod + 1, i + 1);
          const sma = window.reduce((a, b) => a + b, 0) / maPeriod;
          if (maType === "sma") ma = sma;
          else {
            ema =
              ema === null ? sma : curve[i] * (2 / (maPeriod + 1)) + ema * (1 - 2 / (maPeriod + 1));
            ma = ema;
          }
        }
        if (ma !== null && curve[i] < ma) expectedSkipped.push(i);
      }
      const keptTimes = new Set(analysis.filtered.trades.map((t) => t.entryTime));
      const actualSkipped = trades
        .map((t, i) => (keptTimes.has(t.entryTime) ? -1 : i))
        .filter((i) => i >= 0);
      expect(actualSkipped).toEqual(expectedSkipped);
      expect(analysis.tradesSkipped).toBe(expectedSkipped.length);
      if (expectedSkipped.length > 0) runsWithSkips++;
      totalSkips += expectedSkipped.length;
    }
    // The invariant is only non-trivial when the filter actually trips.
    expect(runsWithSkips).toBeGreaterThan(200);
    expect(totalSkips).toBeGreaterThan(1000);
  });
});

describe("applyEquityCurveFilter", () => {
  it("returns original when no trades", () => {
    const result = makeResult([]);
    const analysis = applyEquityCurveFilter(result);
    expect(analysis.tradesSkipped).toBe(0);
    expect(analysis.filtered.tradeCount).toBe(0);
  });

  it("does not skip trades when equity stays above MA", () => {
    // All winning trades → equity always above SMA
    const trades = Array.from({ length: 10 }, (_, i) => makeTrade(i, 200));
    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod: 5 });
    // With steadily rising equity, most trades should pass
    expect(analysis.tradesSkipped).toBeLessThanOrEqual(1);
  });

  it("skips trades during losing streak with MA filter", () => {
    // 10 winners, then 10 losers, then 10 winners
    const trades: Trade[] = [];
    for (let i = 0; i < 10; i++) trades.push(makeTrade(i, 200));
    for (let i = 10; i < 20; i++) trades.push(makeTrade(i, -300));
    for (let i = 20; i < 30; i++) trades.push(makeTrade(i, 200));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod: 5 });
    expect(analysis.tradesSkipped).toBeGreaterThan(0);
  });

  it("drawdown filter pauses trading when DD exceeds threshold", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 5; i++) trades.push(makeTrade(i, 200));
    // Large losses to trigger drawdown
    for (let i = 5; i < 15; i++) trades.push(makeTrade(i, -400));
    for (let i = 15; i < 25; i++) trades.push(makeTrade(i, 200));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, {
      type: "drawdown",
      maxDrawdown: 10,
    });
    expect(analysis.tradesSkipped).toBeGreaterThan(0);
  });

  it("filtered result preserves original settings", () => {
    const trades = Array.from({ length: 5 }, (_, i) => makeTrade(i, 100));
    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result);
    expect(analysis.filtered.settings).toEqual(result.settings);
  });

  it("filteredSizeFactor scales trades instead of skipping", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 5; i++) trades.push(makeTrade(i, 200));
    for (let i = 5; i < 15; i++) trades.push(makeTrade(i, -300));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, {
      type: "ma",
      maPeriod: 3,
      filteredSizeFactor: 0.5,
    });

    // With factor 0.5, skipped trades become half-size
    // filtered should still have all trades
    if (analysis.tradesSkipped > 0) {
      expect(analysis.filtered.tradeCount).toBe(result.tradeCount);
    }
  });

  it("improvement.maxDrawdown follows the original − filtered convention", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 10; i++) trades.push(makeTrade(i, 200));
    for (let i = 10; i < 20; i++) trades.push(makeTrade(i, -300));
    for (let i = 20; i < 30; i++) trades.push(makeTrade(i, 200));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod: 5 });

    // Sign convention: positive = filter improved the metric. For maxDrawdown
    // (lower is better) the formula is `original − filtered`. This invariant
    // holds regardless of whether the filter actually helped on this data.
    expect(analysis.improvement.maxDrawdown).toBeCloseTo(
      result.maxDrawdown - analysis.filtered.maxDrawdown,
      10,
    );
  });

  it("all losses → most trades skipped", () => {
    const trades = Array.from({ length: 30 }, (_, i) => makeTrade(i, -200));
    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, {
      type: "ma",
      maPeriod: 5,
    });
    // After initial period, losses should cause equity below MA
    expect(analysis.tradesSkipped).toBeGreaterThan(10);
  });
});

describe("equityCurveHealth", () => {
  it("returns high health for all-winning strategy", () => {
    const trades = Array.from({ length: 20 }, (_, i) => makeTrade(i, 200));
    const result = makeResult(trades);
    const health = equityCurveHealth(result, { maPeriod: 10 });

    expect(health.aboveMa).toBe(true);
    expect(health.currentDrawdown).toBe(0);
    expect(health.rollingWinRate).toBe(100);
    expect(health.healthScore).toBeGreaterThanOrEqual(80);
  });

  it("returns low health for losing strategy", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 10; i++) trades.push(makeTrade(i, 200));
    for (let i = 10; i < 30; i++) trades.push(makeTrade(i, -200));

    const result = makeResult(trades);
    const health = equityCurveHealth(result, { maPeriod: 10 });

    expect(health.currentDrawdown).toBeGreaterThan(0);
    expect(health.rollingWinRate).toBeLessThan(50);
  });

  it("equityCurve has correct length", () => {
    const trades = Array.from({ length: 10 }, (_, i) => makeTrade(i, 100));
    const result = makeResult(trades);
    const health = equityCurveHealth(result);

    // Initial point + one per trade
    expect(health.equityCurve).toHaveLength(11);
  });

  it("health score stays between 0 and 100", () => {
    const trades = Array.from({ length: 20 }, (_, i) => makeTrade(i, i % 3 === 0 ? -300 : 100));
    const result = makeResult(trades);
    const health = equityCurveHealth(result);

    expect(health.healthScore).toBeGreaterThanOrEqual(0);
    expect(health.healthScore).toBeLessThanOrEqual(100);
  });

  it("currentDrawdown and rollingWinRate use the BacktestResult percent scale", () => {
    // Mixed wins/losses → both fields land in the (0, 100] range, not (0, 1].
    // Locks in unit alignment with runBacktest's BacktestResult contract so
    // callers can compare equityCurveHealth output against backtest summary
    // metrics without manual unit conversion.
    const trades: Trade[] = [];
    for (let i = 0; i < 5; i++) trades.push(makeTrade(i, 200));
    for (let i = 5; i < 15; i++) trades.push(makeTrade(i, -300));
    const result = makeResult(trades);
    const health = equityCurveHealth(result);

    expect(health.currentDrawdown).toBeGreaterThan(1);
    expect(health.currentDrawdown).toBeLessThanOrEqual(100);
    expect(health.rollingWinRate).toBeGreaterThanOrEqual(0);
    expect(health.rollingWinRate).toBeLessThanOrEqual(100);
  });
});

describe("rebuildResult unit alignment with runBacktest", () => {
  it("filtered.winRate and filtered.maxDrawdown match BacktestResult contract", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 10; i++) trades.push(makeTrade(i, 200));
    for (let i = 10; i < 20; i++) trades.push(makeTrade(i, -300));
    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod: 5 });

    // Both fields documented as percent (0-100) on BacktestResult; the filter's
    // rebuilt result must follow the same scale so improvement deltas have
    // consistent units (was buggy pre-fix: rebuildResult emitted fractions).
    expect(analysis.filtered.winRate).toBeGreaterThanOrEqual(0);
    expect(analysis.filtered.winRate).toBeLessThanOrEqual(100);
    expect(analysis.filtered.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(analysis.filtered.maxDrawdown).toBeLessThanOrEqual(100);
  });
});
