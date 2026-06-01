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
});
