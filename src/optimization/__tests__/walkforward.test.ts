import { describe, expect, it, vi } from "vitest";
import type { BacktestOptions, NormalizedCandle, PresetCondition } from "../../types";
import { param } from "../grid-search";
import {
  calculatePeriodCount,
  generatePeriodBoundaries,
  getOutOfSampleEquityCurve,
  summarizeWalkForward,
  walkForwardAnalysis,
} from "../walkforward";

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
