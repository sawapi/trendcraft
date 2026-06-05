import { describe, expect, it } from "vitest";
import { backtestRegistry } from "../../strategy/registry-backtest";
import type { StrategyJSON } from "../../strategy/types";
import type { NormalizedCandle } from "../../types";
import { walkForwardAnalysisFromJSON, walkForwardAnalysisFromJSONSafe } from "../walkforward-json";

/**
 * Deterministic sine-on-uptrend series, long enough for several
 * walk-forward windows of SMA-cross trades.
 */
function makeCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const noise = Math.sin(i / 5) * 3;
    const trend = i * 0.2;
    const close = price + trend + noise;
    const open = close - 0.5;
    const high = Math.max(open, close) + 1;
    const low = Math.min(open, close) - 1;
    candles.push({
      time: 1_700_000_000 + i * 86_400,
      open,
      high,
      low,
      close,
      volume: 1000 + i,
    });
    price = close;
  }
  return candles;
}

const SMA_CROSS_STRATEGY: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "test",
  name: "Test",
  entry: { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 20 } },
  exit: { name: "deadCross", params: { shortPeriod: 5, longPeriod: 20 } },
};

const RANGES = [{ path: "entry.0.shortPeriod", min: 3, max: 7, step: 2 }];
const WF_OPTS = { windowSize: 60, stepSize: 30, testSize: 30 };

describe("walkForwardAnalysisFromJSON", () => {
  it("runs rolling walk-forward and returns path-keyed per-period bestParams", () => {
    const candles = makeCandles(200);
    const wf = walkForwardAnalysisFromJSON(
      candles,
      SMA_CROSS_STRATEGY,
      RANGES,
      backtestRegistry,
      WF_OPTS,
    );
    expect(wf.periods.length).toBeGreaterThan(0);
    // bestParams keys are paths (not raw param names), matching gridSearchFromJSON.
    for (const period of wf.periods) {
      expect(Object.keys(period.bestParams)).toContain("entry.0.shortPeriod");
    }
    expect(wf.aggregateMetrics).toHaveProperty("stabilityRatio");
    expect(wf.recommendation).toHaveProperty("useOptimizedParams");
  });

  it("throws on an invalid range path (same validation as grid search)", () => {
    const candles = makeCandles(200);
    expect(() =>
      walkForwardAnalysisFromJSON(
        candles,
        SMA_CROSS_STRATEGY,
        [{ path: "entry.0.nonExistentParam", min: 1, max: 3, step: 1 }],
        backtestRegistry,
        WF_OPTS,
      ),
    ).toThrow(/Invalid range path/);
  });

  it("throws on insufficient data for even one window", () => {
    const candles = makeCandles(50);
    expect(() =>
      walkForwardAnalysisFromJSON(candles, SMA_CROSS_STRATEGY, RANGES, backtestRegistry, {
        windowSize: 252,
        stepSize: 63,
        testSize: 63,
      }),
    ).toThrow(/Insufficient data/);
  });
});

describe("walkForwardAnalysisFromJSONSafe", () => {
  it("returns ok for a valid run", () => {
    const candles = makeCandles(200);
    const result = walkForwardAnalysisFromJSONSafe(
      candles,
      SMA_CROSS_STRATEGY,
      RANGES,
      backtestRegistry,
      WF_OPTS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.periods.length).toBeGreaterThan(0);
    }
  });

  it("maps an invalid range path to INVALID_PARAMETER", () => {
    const candles = makeCandles(200);
    const result = walkForwardAnalysisFromJSONSafe(
      candles,
      SMA_CROSS_STRATEGY,
      [{ path: "entry.0.nonExistentParam", min: 1, max: 3, step: 1 }],
      backtestRegistry,
      WF_OPTS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PARAMETER");
    }
  });

  it("maps a too-short slice to INSUFFICIENT_DATA", () => {
    const candles = makeCandles(50);
    const result = walkForwardAnalysisFromJSONSafe(
      candles,
      SMA_CROSS_STRATEGY,
      RANGES,
      backtestRegistry,
      { windowSize: 252, stepSize: 63, testSize: 63 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INSUFFICIENT_DATA");
    }
  });

  it("fast-fails oversized grids as TOO_MANY_COMBINATIONS even with a constraint filter", () => {
    // The strategy has registered constraints (goldenCross), so a
    // paramFilter is auto-built. An oversized grid must still be rejected
    // by the per-window maxCombinations guard rather than eagerly
    // enumerating the whole Cartesian product first.
    const candles = makeCandles(200);
    const result = walkForwardAnalysisFromJSONSafe(
      candles,
      SMA_CROSS_STRATEGY,
      [
        { path: "entry.0.shortPeriod", min: 1, max: 100, step: 1 },
        { path: "entry.0.longPeriod", min: 101, max: 300, step: 1 },
      ],
      backtestRegistry,
      WF_OPTS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOO_MANY_COMBINATIONS");
    }
  });

  it("rejects a fully-invalid search space as INVALID_PARAMETER (no filtered-out fallback)", () => {
    // Every combination violates goldenCross's shortPeriod < longPeriod
    // (short range entirely above long range), so the param filter accepts
    // nothing. Rather than falling back to a filtered-out combo, the run
    // must surface that no valid combination exists.
    const candles = makeCandles(200);
    const result = walkForwardAnalysisFromJSONSafe(
      candles,
      SMA_CROSS_STRATEGY,
      [
        { path: "entry.0.shortPeriod", min: 20, max: 24, step: 2 },
        { path: "entry.0.longPeriod", min: 4, max: 8, step: 2 },
      ],
      backtestRegistry,
      WF_OPTS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PARAMETER");
    }
  });

  it("never picks a constraint-violating combo as a window's best params", () => {
    const candles = makeCandles(200);
    // Overlapping short/long ranges so the per-window grid contains
    // invalid combos. Each window's chosen bestParams must still satisfy
    // goldenCross's shortPeriod < longPeriod — enforced at the optimizer
    // via the registry's validateParams, not post-hoc.
    const wf = walkForwardAnalysisFromJSON(
      candles,
      SMA_CROSS_STRATEGY,
      [
        { path: "entry.0.shortPeriod", min: 4, max: 8, step: 2 },
        { path: "entry.0.longPeriod", min: 4, max: 8, step: 2 },
      ],
      backtestRegistry,
      WF_OPTS,
    );
    expect(wf.periods.length).toBeGreaterThan(0);
    for (const period of wf.periods) {
      expect(period.bestParams["entry.0.shortPeriod"]).toBeLessThan(
        period.bestParams["entry.0.longPeriod"],
      );
    }
  });
});
