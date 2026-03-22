import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  anchoredWalkForwardAnalysis,
  calculateAWFPeriodCount,
  formatAWFResult,
  generateAWFBoundaries,
  getAWFEquityCurve,
  summarizeAWFResult,
} from "../anchored-walkforward";
import type { ConditionDefinition } from "../combination-search";

/**
 * Generate test candles with an upward trend
 */
function generateTestCandles(
  count: number,
  startPrice = 100,
  dailyReturn = 0.001,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2015-01-01").getTime();
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price *= 1 + dailyReturn + (Math.random() - 0.5) * 0.02;
    const dailyRange = price * 0.02;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - dailyRange * 0.25,
      high: price + dailyRange * 0.5,
      low: price - dailyRange * 0.5,
      close: price,
      volume: 1000000 + Math.random() * 500000,
    });
  }

  return candles;
}

/**
 * Create simple test conditions
 */
function createSimpleEntryConditions(): ConditionDefinition[] {
  return [
    {
      name: "always",
      displayName: "Always",
      create: () => () => true,
    },
    {
      name: "priceUp",
      displayName: "Price Up",
      create: () => (_indicators, _candle, index, candles) => {
        if (index < 1 || !candles[index] || !candles[index - 1]) return false;
        return candles[index].close > candles[index - 1].close;
      },
    },
  ];
}

function createSimpleExitConditions(): ConditionDefinition[] {
  return [
    {
      name: "always",
      displayName: "Always Exit",
      create: () => () => true,
    },
    {
      name: "priceDown",
      displayName: "Price Down",
      create: () => (_indicators, _candle, index, candles) => {
        if (index < 1 || !candles[index] || !candles[index - 1]) return false;
        return candles[index].close < candles[index - 1].close;
      },
    },
  ];
}

describe("Anchored Walk-Forward Analysis", () => {
  describe("generateAWFBoundaries", () => {
    it("should generate correct boundaries for basic case", () => {
      const candles = generateTestCandles(1500); // ~6 years
      const anchorDate = candles[0].time;

      const boundaries = generateAWFBoundaries(candles, {
        anchorDate,
        initialTrainSize: 504, // ~2 years
        expansionStep: 252, // ~1 year
        testSize: 252, // ~1 year
      });

      expect(boundaries.length).toBeGreaterThan(0);

      // Check first boundary
      expect(boundaries[0].trainStart).toBe(0);
      expect(boundaries[0].trainEnd).toBe(503); // 504 - 1
      expect(boundaries[0].testStart).toBe(504);
      expect(boundaries[0].testEnd).toBe(755); // 504 + 252 - 1

      // Check that train always starts at anchor
      for (const b of boundaries) {
        expect(b.trainStart).toBe(0);
      }

      // Check that train end expands
      if (boundaries.length > 1) {
        expect(boundaries[1].trainEnd).toBeGreaterThan(boundaries[0].trainEnd);
      }
    });

    it("should return empty array if insufficient data", () => {
      const candles = generateTestCandles(500); // Less than initial + test
      const anchorDate = candles[0].time;

      const boundaries = generateAWFBoundaries(candles, {
        anchorDate,
        initialTrainSize: 504,
        testSize: 252,
      });

      expect(boundaries.length).toBe(0);
    });

    it("should find anchor date in middle of data", () => {
      const candles = generateTestCandles(2000);
      const anchorDate = candles[500].time; // Start from candle 500

      const boundaries = generateAWFBoundaries(candles, {
        anchorDate,
        initialTrainSize: 252,
        expansionStep: 126,
        testSize: 126,
      });

      expect(boundaries.length).toBeGreaterThan(0);
      expect(boundaries[0].trainStart).toBe(500);
    });

    it("should handle anchor date before first candle", () => {
      const candles = generateTestCandles(1000);
      const anchorDate = candles[0].time - 86400000 * 30; // 30 days before

      const boundaries = generateAWFBoundaries(candles, {
        anchorDate,
        initialTrainSize: 252,
        testSize: 252,
      });

      expect(boundaries.length).toBeGreaterThan(0);
      expect(boundaries[0].trainStart).toBe(0);
    });
  });

  describe("calculateAWFPeriodCount", () => {
    it("should return 0 for insufficient data", () => {
      const count = calculateAWFPeriodCount(500, 0, 504, 252, 252);
      expect(count).toBe(0);
    });

    it("should return 1 for minimum data", () => {
      const count = calculateAWFPeriodCount(756, 0, 504, 252, 252);
      expect(count).toBe(1);
    });

    it("should calculate correct period count", () => {
      // Total: 1500, Initial: 504, Step: 252, Test: 252
      // Period 1: train 0-503, test 504-755 (756 candles used)
      // Period 2: train 0-755, test 756-1007 (1008 candles used)
      // Period 3: train 0-1007, test 1008-1259 (1260 candles used)
      // Period 4: train 0-1259, test 1260-1499 (needs 1512, but only 1500)
      const count = calculateAWFPeriodCount(1500, 0, 504, 252, 252);
      expect(count).toBe(3);
    });

    it("should account for anchor offset", () => {
      const countFromStart = calculateAWFPeriodCount(1500, 0, 504, 252, 252);
      const countWithOffset = calculateAWFPeriodCount(1500, 500, 504, 252, 252);
      expect(countWithOffset).toBeLessThan(countFromStart);
    });
  });

  describe("anchoredWalkForwardAnalysis", () => {
    it("should throw error for insufficient data", () => {
      const candles = generateTestCandles(500);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      expect(() =>
        anchoredWalkForwardAnalysis(candles, entryConditions, exitConditions, {
          anchorDate: candles[0].time,
          initialTrainSize: 504,
          testSize: 252,
        }),
      ).toThrow("Insufficient data");
    });

    it("should run analysis and return results", () => {
      const candles = generateTestCandles(1200);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
          metric: "sharpe",
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      expect(result.periods.length).toBeGreaterThan(0);
      expect(result.aggregateMetrics).toBeDefined();
      expect(result.stabilityAnalysis).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it("should track condition frequency", () => {
      const candles = generateTestCandles(1200);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      // Should have some condition frequencies tracked
      const frequencies = Object.keys(result.stabilityAnalysis.conditionFrequency);
      expect(frequencies.length).toBeGreaterThan(0);
    });

    it("should call progress callback", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const progressCalls: Array<{
        period: number;
        total: number;
        phase: string;
      }> = [];

      anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
          progressCallback: (period, total, phase) => {
            progressCalls.push({ period, total, phase });
          },
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      expect(progressCalls.length).toBeGreaterThan(0);
      // Should have both train and test phases
      expect(progressCalls.some((c) => c.phase === "train")).toBe(true);
      expect(progressCalls.some((c) => c.phase === "test")).toBe(true);
    });

    it("should include period details", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      for (const period of result.periods) {
        expect(period.periodNumber).toBeGreaterThan(0);
        expect(period.trainStart).toBeDefined();
        expect(period.trainEnd).toBeDefined();
        expect(period.testStart).toBeDefined();
        expect(period.testEnd).toBeDefined();
        expect(period.trainCandleCount).toBeGreaterThan(0);
        expect(period.testCandleCount).toBeGreaterThan(0);
        expect(period.bestEntryConditions).toBeDefined();
        expect(period.bestExitConditions).toBeDefined();
        expect(period.inSampleMetrics).toBeDefined();
        expect(period.outOfSampleMetrics).toBeDefined();
        expect(period.testBacktest).toBeDefined();
      }
    });
  });

  describe("summarizeAWFResult", () => {
    it("should return summary object", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      const summary = summarizeAWFResult(result);

      expect(typeof summary.periodCount).toBe("number");
      expect(typeof summary.avgInSampleReturn).toBe("number");
      expect(typeof summary.avgOutOfSampleReturn).toBe("number");
      expect(typeof summary.stabilityRatio).toBe("number");
      expect(typeof summary.profitablePeriods).toBe("number");
      expect(typeof summary.consistencyScore).toBe("number");
      expect(Array.isArray(summary.recommendedEntry)).toBe(true);
      expect(Array.isArray(summary.recommendedExit)).toBe(true);
      expect(typeof summary.useOptimized).toBe("boolean");
    });
  });

  describe("formatAWFResult", () => {
    it("should format result as string", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      const formatted = formatAWFResult(result);

      expect(typeof formatted).toBe("string");
      expect(formatted).toContain("Anchored Walk-Forward Analysis Results");
      expect(formatted).toContain("Periods:");
      expect(formatted).toContain("IS Return:");
      expect(formatted).toContain("OOS Return:");
      expect(formatted).toContain("Stability:");
      expect(formatted).toContain("Recommendation:");
    });

    it("should include period details", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      const formatted = formatAWFResult(result);

      expect(formatted).toContain("Period Details:");
      expect(formatted).toContain("[1]");
      expect(formatted).toContain("Train:");
      expect(formatted).toContain("Test:");
    });
  });

  describe("getAWFEquityCurve", () => {
    it("should return equity curve array", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      const curve = getAWFEquityCurve(result);

      expect(curve.length).toBe(result.periods.length);
      for (const point of curve) {
        expect(typeof point.time).toBe("number");
        expect(typeof point.equity).toBe("number");
        expect(typeof point.periodNumber).toBe("number");
      }
    });

    it("should use custom initial capital", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      const curve1 = getAWFEquityCurve(result, 100000);
      const curve2 = getAWFEquityCurve(result, 1000000);

      // Starting from different capitals, but same returns, so ratios should be same
      if (curve1.length > 0 && curve2.length > 0) {
        const ratio1 = curve1[0].equity / 100000;
        const ratio2 = curve2[0].equity / 1000000;
        expect(ratio1).toBeCloseTo(ratio2, 5);
      }
    });

    it("should compound returns across periods", () => {
      const candles = generateTestCandles(1500);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      const curve = getAWFEquityCurve(result, 100000);

      // Verify compounding: each point's equity depends on previous
      let expectedEquity = 100000;
      for (let i = 0; i < curve.length; i++) {
        const returnPct = result.periods[i].outOfSampleMetrics.returns;
        expectedEquity *= 1 + returnPct / 100;
        expect(curve[i].equity).toBeCloseTo(expectedEquity, 2);
      }
    });
  });

  describe("recommendation logic", () => {
    it("should provide useOptimized boolean", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      expect(typeof result.recommendation.useOptimized).toBe("boolean");
      expect(typeof result.recommendation.reason).toBe("string");
      expect(result.recommendation.reason.length).toBeGreaterThan(0);
    });

    it("should include condition recommendations when useOptimized is true", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      if (result.recommendation.useOptimized) {
        expect(result.recommendation.entryConditions.length).toBeGreaterThan(0);
        expect(result.recommendation.exitConditions.length).toBeGreaterThan(0);
      }
    });
  });

  describe("aggregate metrics", () => {
    it("should calculate stability ratio", () => {
      const candles = generateTestCandles(1000);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      expect(typeof result.aggregateMetrics.stabilityRatio).toBe("number");
      expect(result.aggregateMetrics.stabilityRatio).toBeLessThanOrEqual(1);
    });

    it("should calculate OOS return standard deviation", () => {
      const candles = generateTestCandles(1500);
      const entryConditions = createSimpleEntryConditions();
      const exitConditions = createSimpleExitConditions();

      const result = anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        {
          anchorDate: candles[0].time,
          initialTrainSize: 252,
          expansionStep: 252,
          testSize: 252,
        },
        {
          maxEntryConditions: 1,
          maxExitConditions: 1,
        },
      );

      expect(typeof result.aggregateMetrics.oosReturnStdDev).toBe("number");
      expect(result.aggregateMetrics.oosReturnStdDev).toBeGreaterThanOrEqual(0);
    });
  });
});
