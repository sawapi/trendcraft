import { describe, expect, it, vi } from "vitest";
import type { BacktestOptions, NormalizedCandle, PresetCondition } from "../../types";
import type { WalkForwardPeriod, WalkForwardResult } from "../../types/optimization";
import { param } from "../grid-search";
import {
  calculatePeriodCount,
  generatePeriodBoundaries,
  getOutOfSampleEquityCurve,
  stitchOosEquity,
  summarizeWalkForward,
  walkForwardAnalysis,
  wfeRatio,
} from "../walkforward";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Build a full OptimizationMetric record, defaulting unspecified keys to 0. */
function metricsRecord(over: { returns?: number; winRate?: number } = {}) {
  return {
    sharpe: 0,
    calmar: 0,
    mar: 0,
    profitFactor: 0,
    recoveryFactor: 0,
    returns: over.returns ?? 0,
    winRate: over.winRate ?? 0,
    tradeCount: 0,
    maxDrawdown: 0,
  };
}

/** Minimal WalkForwardResult carrying only the fields the helpers read. */
function makeWfResult(periods: Partial<WalkForwardPeriod>[]): WalkForwardResult {
  return { periods } as unknown as WalkForwardResult;
}

/**
 * Generate test candles with upward trend
 */
function generateUpTrendCandles(count: number, startPrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price *= 1.002; // ~0.2% daily increase
    const dailyRange = price * 0.015;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - dailyRange * 0.25,
      high: price + dailyRange * 0.5,
      low: price - dailyRange * 0.5,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// Simple condition: enter at specific index
const createEnterCondition = (enterAfter: number): PresetCondition => ({
  type: "preset",
  name: "paramEnter",
  evaluate: (_indicators, _candle, index) => index === enterAfter,
});

// Simple condition: exit after N bars
const createExitCondition = (holdBars: number, enterAfter: number): PresetCondition => ({
  type: "preset",
  name: "paramExit",
  evaluate: (_indicators, _candle, index) => index === enterAfter + holdBars,
});

describe("Walk-Forward Analysis", () => {
  describe("calculatePeriodCount", () => {
    it("should return 0 when insufficient data", () => {
      expect(calculatePeriodCount(100, 100, 50, 50)).toBe(0);
      expect(calculatePeriodCount(149, 100, 50, 50)).toBe(0);
    });

    it("should calculate correct period count", () => {
      // 500 candles, window=100, step=50, test=50 -> (500-100-50)/50 + 1 = 8
      expect(calculatePeriodCount(500, 100, 50, 50)).toBe(8);
    });

    it("should return 1 when exactly enough data", () => {
      expect(calculatePeriodCount(150, 100, 50, 50)).toBe(1);
    });
  });

  describe("generatePeriodBoundaries", () => {
    it("should generate correct boundaries", () => {
      const candles = generateUpTrendCandles(300);
      const boundaries = generatePeriodBoundaries(candles, {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      expect(boundaries.length).toBeGreaterThan(0);

      // Check first boundary
      expect(boundaries[0].trainStart).toBe(0);
      expect(boundaries[0].trainEnd).toBe(99);
      expect(boundaries[0].testStart).toBe(100);
      expect(boundaries[0].testEnd).toBe(149);

      // Check second boundary
      if (boundaries.length > 1) {
        expect(boundaries[1].trainStart).toBe(50);
        expect(boundaries[1].trainEnd).toBe(149);
        expect(boundaries[1].testStart).toBe(150);
        expect(boundaries[1].testEnd).toBe(199);
      }
    });

    it("should return empty array for insufficient data", () => {
      const candles = generateUpTrendCandles(50);
      const boundaries = generatePeriodBoundaries(candles, {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      expect(boundaries).toEqual([]);
    });

    it("should use default options", () => {
      const candles = generateUpTrendCandles(500);
      const boundaries = generatePeriodBoundaries(candles);

      // Default: windowSize=252, stepSize=63, testSize=63
      // Should have at least 1 period
      expect(boundaries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("walkForwardAnalysis", () => {
    it("should run walk-forward analysis", () => {
      const candles = generateUpTrendCandles(300);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 15, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      expect(result.periods.length).toBeGreaterThan(0);
      expect(result.aggregateMetrics).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it("should throw error for insufficient data", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(params.enterAfter),
        exit: createExitCondition(10, params.enterAfter),
      });

      expect(() =>
        walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 15, 5)], {
          windowSize: 100,
          stepSize: 50,
          testSize: 50,
        }),
      ).toThrow(/Insufficient data/);
    });

    it("should call progress callback", () => {
      const candles = generateUpTrendCandles(300);
      const progressFn = vi.fn();

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 10, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
        progressCallback: progressFn,
      });

      expect(progressFn).toHaveBeenCalledTimes(result.periods.length);
    });

    it("should calculate aggregate metrics", () => {
      const candles = generateUpTrendCandles(300);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 10, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      expect(result.aggregateMetrics.avgInSample).toHaveProperty("sharpe");
      expect(result.aggregateMetrics.avgInSample).toHaveProperty("returns");
      expect(result.aggregateMetrics.avgOutOfSample).toHaveProperty("sharpe");
      expect(result.aggregateMetrics.avgOutOfSample).toHaveProperty("returns");
      expect(typeof result.aggregateMetrics.stabilityRatio).toBe("number");
    });

    it("should generate recommendation", () => {
      const candles = generateUpTrendCandles(400);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 15, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      expect(result.recommendation.useOptimizedParams).toBeDefined();
      expect(typeof result.recommendation.reason).toBe("string");
    });

    it("should record best params for each period", () => {
      const candles = generateUpTrendCandles(300);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 15, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      for (const period of result.periods) {
        expect(period.bestParams).toHaveProperty("enterAfter");
        expect(period.inSampleMetrics).toBeDefined();
        expect(period.outOfSampleMetrics).toBeDefined();
      }
    });
  });

  describe("summarizeWalkForward", () => {
    it("should summarize results", () => {
      const candles = generateUpTrendCandles(300);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 10, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      const summary = summarizeWalkForward(result);

      expect(summary.periodCount).toBe(result.periods.length);
      expect(typeof summary.avgInSampleReturn).toBe("number");
      expect(typeof summary.avgOutOfSampleReturn).toBe("number");
      expect(typeof summary.stabilityRatio).toBe("number");
      expect(typeof summary.profitablePeriods).toBe("number");
      expect(typeof summary.recommendation).toBe("string");
    });
  });

  describe("getOutOfSampleEquityCurve", () => {
    it("should generate equity curve", () => {
      const candles = generateUpTrendCandles(300);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 10, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      const curve = getOutOfSampleEquityCurve(result);

      expect(curve.length).toBe(result.periods.length);
      for (const point of curve) {
        expect(point).toHaveProperty("time");
        expect(point).toHaveProperty("equity");
        expect(typeof point.equity).toBe("number");
      }
    });

    it("should use custom initial capital", () => {
      const candles = generateUpTrendCandles(300);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 10, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      const curve100k = getOutOfSampleEquityCurve(result, 100000);
      const curve200k = getOutOfSampleEquityCurve(result, 200000);

      // Ratios should be the same, but absolute values different
      if (curve100k.length > 0 && curve200k.length > 0) {
        const ratio100k = curve100k[0].equity / 100000;
        const ratio200k = curve200k[0].equity / 200000;
        expect(ratio100k).toBeCloseTo(ratio200k, 5);
      }
    });
  });

  describe("wfeRatio", () => {
    // Spans of exactly one year make annualization a no-op, so WFE
    // reduces to the plain out-of-sample / in-sample return ratio.
    it("equals OOS/IS return ratio when both windows span one year", () => {
      const result = makeWfResult([
        {
          trainStart: 0,
          trainEnd: MS_PER_YEAR,
          testStart: MS_PER_YEAR,
          testEnd: 2 * MS_PER_YEAR,
          inSampleMetrics: metricsRecord({ returns: 20 }),
          outOfSampleMetrics: metricsRecord({ returns: 10 }),
        },
      ]);
      expect(wfeRatio(result)).toBeCloseTo(0.5, 10);
    });

    it("averages per-period WFE", () => {
      const result = makeWfResult([
        {
          trainStart: 0,
          trainEnd: MS_PER_YEAR,
          testStart: MS_PER_YEAR,
          testEnd: 2 * MS_PER_YEAR,
          inSampleMetrics: metricsRecord({ returns: 20 }),
          outOfSampleMetrics: metricsRecord({ returns: 10 }), // WFE 0.5
        },
        {
          trainStart: 2 * MS_PER_YEAR,
          trainEnd: 3 * MS_PER_YEAR,
          testStart: 3 * MS_PER_YEAR,
          testEnd: 4 * MS_PER_YEAR,
          inSampleMetrics: metricsRecord({ returns: 10 }),
          outOfSampleMetrics: metricsRecord({ returns: 10 }), // WFE 1.0
        },
      ]);
      expect(wfeRatio(result)).toBeCloseTo(0.75, 10);
    });

    it("skips periods with non-positive in-sample return and is NaN when none qualify", () => {
      const result = makeWfResult([
        {
          trainStart: 0,
          trainEnd: MS_PER_YEAR,
          testStart: MS_PER_YEAR,
          testEnd: 2 * MS_PER_YEAR,
          inSampleMetrics: metricsRecord({ returns: -5 }),
          outOfSampleMetrics: metricsRecord({ returns: 10 }),
        },
      ]);
      expect(Number.isNaN(wfeRatio(result))).toBe(true);
    });

    it("is not capped above 1 when OOS beats IS", () => {
      const result = makeWfResult([
        {
          trainStart: 0,
          trainEnd: MS_PER_YEAR,
          testStart: MS_PER_YEAR,
          testEnd: 2 * MS_PER_YEAR,
          inSampleMetrics: metricsRecord({ returns: 10 }),
          outOfSampleMetrics: metricsRecord({ returns: 25 }),
        },
      ]);
      expect(wfeRatio(result)).toBeCloseTo(2.5, 10);
    });
  });

  describe("stitchOosEquity", () => {
    it("compounds each OOS trade onto a leading anchor point", () => {
      const result = makeWfResult([
        {
          testStart: 1000,
          testBacktest: {
            trades: [
              { exitTime: 2000, returnPercent: 10 },
              { exitTime: 3000, returnPercent: -5 },
            ],
          },
        },
        {
          testStart: 4000,
          testBacktest: {
            trades: [{ exitTime: 5000, returnPercent: 20 }],
          },
        },
      ] as unknown as Partial<WalkForwardPeriod>[]);

      const curve = stitchOosEquity(result, 100_000);

      // 1 anchor + 3 trades
      expect(curve.length).toBe(4);
      expect(curve[0]).toEqual({ time: 1000, equity: 100_000 });
      expect(curve[1].equity).toBeCloseTo(110_000, 6); // +10%
      expect(curve[2].equity).toBeCloseTo(104_500, 6); // -5%
      expect(curve[3].equity).toBeCloseTo(125_400, 6); // +20%
      // Times are non-decreasing.
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].time).toBeGreaterThanOrEqual(curve[i - 1].time);
      }
    });

    it("returns an empty curve for no periods", () => {
      expect(stitchOosEquity(makeWfResult([]), 100_000)).toEqual([]);
    });

    it("keeps the curve chronological when test windows overlap", () => {
      // Overlapping windows (stepSize < testSize): period 2 holds a trade
      // that exited before period 1's last trade. A global sort must keep
      // exit times non-decreasing across the whole stitched curve.
      const result = makeWfResult([
        {
          testStart: 1000,
          testBacktest: {
            trades: [
              { exitTime: 2000, returnPercent: 5 },
              { exitTime: 6000, returnPercent: 5 },
            ],
          },
        },
        {
          testStart: 4000,
          testBacktest: {
            trades: [{ exitTime: 5000, returnPercent: 5 }],
          },
        },
      ] as unknown as Partial<WalkForwardPeriod>[]);

      const curve = stitchOosEquity(result, 100_000);
      const times = curve.map((p) => p.time);
      expect(times).toEqual([1000, 2000, 5000, 6000]);
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    });

    it("is finer than the per-period equity curve", () => {
      const candles = generateUpTrendCandles(300);
      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });
      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 10, 5)], {
        windowSize: 100,
        stepSize: 50,
        testSize: 50,
      });

      const perPeriod = getOutOfSampleEquityCurve(result);
      const stitched = stitchOosEquity(result);
      // At least as many points as periods (anchor + trades), never fewer.
      expect(stitched.length).toBeGreaterThanOrEqual(perPeriod.length);
    });
  });

  describe("edge cases", () => {
    it("should handle single period", () => {
      const candles = generateUpTrendCandles(200);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = walkForwardAnalysis(candles, createStrategy, [param("enterAfter", 5, 10, 5)], {
        windowSize: 100,
        stepSize: 100, // Large step = fewer periods
        testSize: 50,
      });

      expect(result.periods.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle different metrics", () => {
      const candles = generateUpTrendCandles(300);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAfter)),
        exit: createExitCondition(10, Math.round(params.enterAfter)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const sharpeResult = walkForwardAnalysis(
        candles,
        createStrategy,
        [param("enterAfter", 5, 10, 5)],
        {
          windowSize: 100,
          stepSize: 50,
          testSize: 50,
          metric: "sharpe",
        },
      );

      const returnsResult = walkForwardAnalysis(
        candles,
        createStrategy,
        [param("enterAfter", 5, 10, 5)],
        {
          windowSize: 100,
          stepSize: 50,
          testSize: 50,
          metric: "returns",
        },
      );

      // Both should complete successfully
      expect(sharpeResult.periods.length).toBeGreaterThan(0);
      expect(returnsResult.periods.length).toBeGreaterThan(0);
    });
  });
});
