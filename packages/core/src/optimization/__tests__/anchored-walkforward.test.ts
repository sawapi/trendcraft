import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  anchoredWalkForwardAnalysis,
  anchoredWalkForwardAnalysisSafe,
  calculateAWFPeriodCount,
  formatAWFResult,
  generateAWFBoundaries,
  getAWFEquityCurve,
  summarizeAWFResult,
} from "../anchored-walkforward";
import type { ConditionDefinition } from "../combination-search";
import { combinationSearch } from "../combination-search";

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

    it("accounts for the purge gap so preflight matches the boundary generator", () => {
      // 756 candles fit exactly one unpurged period; a 10-bar purge gap
      // pushes the requirement to 766
      expect(calculateAWFPeriodCount(756, 0, 504, 252, 252, 10)).toBe(0);
      expect(calculateAWFPeriodCount(766, 0, 504, 252, 252, 10)).toBe(1);
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

/**
 * Deterministic price series — these tests assert exact period bookkeeping,
 * so they cannot share the Math.random() generator above.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededCandles(count: number, seed = 7, drift = 0.001): NormalizedCandle[] {
  const rnd = mulberry32(seed);
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2015-01-01").getTime();
  let price = 100;

  for (let i = 0; i < count; i++) {
    price *= 1 + drift + (rnd() - 0.5) * 0.02;
    const dailyRange = price * 0.02;
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

function seededEntryConditions(): ConditionDefinition[] {
  return [
    {
      name: "priceUp",
      displayName: "Price Up",
      create: () => (_indicators, _candle, index, candles) =>
        index >= 1 && candles[index].close > candles[index - 1].close,
    },
    {
      name: "priceUp2",
      displayName: "Price Up (2 bars)",
      create: () => (_indicators, _candle, index, candles) =>
        index >= 2 && candles[index].close > candles[index - 2].close,
    },
  ];
}

function seededExitConditions(): ConditionDefinition[] {
  return [
    {
      name: "priceDown",
      displayName: "Price Down",
      create: () => (_indicators, _candle, index, candles) =>
        index >= 1 && candles[index].close < candles[index - 1].close,
    },
  ];
}

const SEEDED_AWF_OPTIONS = {
  initialTrainSize: 300,
  expansionStep: 200,
  testSize: 200,
} as const;

describe("Anchored Walk-Forward — periods that select nothing", () => {
  it("refuses to report an unselected combination as out-of-sample performance", () => {
    const candles = seededCandles(800);

    // No combination can reach a billion trades, so nothing is ever selected.
    // The previous behavior filtered the condition pools by an empty name
    // list, built `and()` from zero conditions — which is vacuously true —
    // and reported the resulting always-in-the-market backtest (99 trades,
    // +19.17% and +18.19% on this series) as the optimizer's OOS result.
    expect(() =>
      anchoredWalkForwardAnalysis(candles, seededEntryConditions(), seededExitConditions(), {
        anchorDate: candles[0].time,
        ...SEEDED_AWF_OPTIONS,
        constraints: [{ metric: "tradeCount", operator: ">=", value: 1e9 }],
      }),
    ).toThrow(/No AWF period selected a condition combination \(2 period\(s\) evaluated\)/);
  });

  it("surfaces the failure as OPTIMIZATION_FAILED through the safe variant", () => {
    const candles = seededCandles(800);

    const result = anchoredWalkForwardAnalysisSafe(
      candles,
      seededEntryConditions(),
      seededExitConditions(),
      {
        anchorDate: candles[0].time,
        ...SEEDED_AWF_OPTIONS,
        constraints: [{ metric: "tradeCount", operator: ">=", value: 1e9 }],
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("OPTIMIZATION_FAILED");
    }
  });

  it("skips a training window in which no combination trades at all", () => {
    const candles = seededCandles(800, 11);
    const never: ConditionDefinition[] = [
      { name: "never", displayName: "Never", create: () => () => false },
    ];

    // No constraints at all: every combination is discarded for having zero
    // trades, which leaves the search with nothing to select.
    expect(() =>
      anchoredWalkForwardAnalysis(candles, never, seededExitConditions(), {
        anchorDate: candles[0].time,
        ...SEEDED_AWF_OPTIONS,
      }),
    ).toThrow(/No AWF period selected a condition combination/);
  });

  it("records a skipped period and keeps the periods that did select", () => {
    const candles = seededCandles(800);
    const entryConditions = seededEntryConditions();
    const exitConditions = seededExitConditions();
    const anchorDate = candles[0].time;
    const boundaries = generateAWFBoundaries(candles, { anchorDate, ...SEEDED_AWF_OPTIONS });
    expect(boundaries.length).toBe(2);

    // Trade counts grow with the expanding training window, so a threshold
    // between the two windows' counts is met by the second period only.
    const tradeCounts = boundaries.map((b) => {
      const train = candles.slice(b.trainStart, b.trainEnd + 1);
      const search = combinationSearch(train, entryConditions, exitConditions, {
        metric: "returns",
      });
      return search.bestResult?.metrics.tradeCount ?? 0;
    });
    const threshold = tradeCounts[1];
    expect(tradeCounts[0]).toBeLessThan(threshold);

    const result = anchoredWalkForwardAnalysis(candles, entryConditions, exitConditions, {
      anchorDate,
      ...SEEDED_AWF_OPTIONS,
      metric: "returns",
      constraints: [{ metric: "tradeCount", operator: ">=", value: threshold }],
    });

    expect(result.skippedPeriods.map((p) => p.periodNumber)).toEqual([1]);
    expect(result.periods.map((p) => p.periodNumber)).toEqual([2]);

    const skipped = result.skippedPeriods[0];
    expect(skipped.trainStart).toBe(candles[boundaries[0].trainStart].time);
    expect(skipped.trainEnd).toBe(candles[boundaries[0].trainEnd].time);
    expect(skipped.testStart).toBe(candles[boundaries[0].testStart].time);
    expect(skipped.combinationsTested).toBeGreaterThan(0);
    expect(skipped.reason).toMatch(/No combination satisfied the constraints/);

    // Nothing from the skipped period leaks into the aggregates.
    expect(result.periods[0].bestEntryConditions.length).toBeGreaterThan(0);
    for (const value of Object.values(result.stabilityAnalysis.conditionFrequency)) {
      expect(value).toBe(100);
    }
  });

  it("takes in-sample metrics from the winning combination itself", () => {
    const candles = seededCandles(800);
    const entryConditions = seededEntryConditions();
    const exitConditions = seededExitConditions();
    const anchorDate = candles[0].time;

    const result = anchoredWalkForwardAnalysis(candles, entryConditions, exitConditions, {
      anchorDate,
      ...SEEDED_AWF_OPTIONS,
      metric: "returns",
    });

    const boundaries = generateAWFBoundaries(candles, { anchorDate, ...SEEDED_AWF_OPTIONS });
    expect(result.periods.length).toBe(boundaries.length);

    for (const period of result.periods) {
      const boundary = boundaries[period.periodNumber - 1];
      const train = candles.slice(boundary.trainStart, boundary.trainEnd + 1);
      const search = combinationSearch(train, entryConditions, exitConditions, {
        metric: "returns",
      });

      // Previously this came from a name-join lookup back into the result
      // list, falling back to an empty object cast to the metric record —
      // so every key read as `undefined` while the type claimed `number`.
      expect(period.inSampleMetrics.returns).toBe(search.bestResult?.metrics.returns);
      expect(Number.isFinite(period.inSampleMetrics.returns)).toBe(true);
      expect(period.inSampleMetrics.tradeCount).toBeGreaterThan(0);
    }
  });

  it("still tests an empty entry combination when the caller allows one to win", () => {
    const candles = seededCandles(400, 1, 0.002);
    const entryConditions = seededEntryConditions();
    const exitConditions = seededExitConditions();

    // With minEntryConditions: 0 the empty entry combination is a legitimate
    // candidate, and on this series it wins. `bestEntry.length === 0` is
    // therefore NOT a usable "nothing was selected" signal.
    const search = combinationSearch(candles.slice(0, 300), entryConditions, exitConditions, {
      metric: "returns",
      minEntryConditions: 0,
    });
    expect(search.bestResult).not.toBeNull();
    expect(search.bestEntry).toEqual([]);

    const result = anchoredWalkForwardAnalysis(
      candles,
      entryConditions,
      exitConditions,
      { anchorDate: candles[0].time, initialTrainSize: 300, expansionStep: 200, testSize: 100 },
      { metric: "returns", minEntryConditions: 0 },
    );

    expect(result.skippedPeriods).toEqual([]);
    expect(result.periods[0].bestEntryConditions).toEqual([]);
    expect(result.periods[0].outOfSampleMetrics.tradeCount).toBeGreaterThan(0);
  });

  it("reports skipped periods in the summary and the formatted output", () => {
    const candles = seededCandles(800);
    const entryConditions = seededEntryConditions();
    const exitConditions = seededExitConditions();
    const anchorDate = candles[0].time;
    const boundaries = generateAWFBoundaries(candles, { anchorDate, ...SEEDED_AWF_OPTIONS });
    const firstWindow = candles.slice(boundaries[0].trainStart, boundaries[0].trainEnd + 1);
    const secondWindow = candles.slice(boundaries[1].trainStart, boundaries[1].trainEnd + 1);
    const threshold =
      combinationSearch(secondWindow, entryConditions, exitConditions, { metric: "returns" })
        .bestResult?.metrics.tradeCount ?? 0;
    expect(
      combinationSearch(firstWindow, entryConditions, exitConditions, { metric: "returns" })
        .bestResult?.metrics.tradeCount ?? 0,
    ).toBeLessThan(threshold);

    const result = anchoredWalkForwardAnalysis(candles, entryConditions, exitConditions, {
      anchorDate,
      ...SEEDED_AWF_OPTIONS,
      metric: "returns",
      constraints: [{ metric: "tradeCount", operator: ">=", value: threshold }],
    });

    expect(summarizeAWFResult(result).periodCount).toBe(1);
    expect(summarizeAWFResult(result).skippedPeriodCount).toBe(1);

    const text = formatAWFResult(result);
    expect(text).toContain("Periods: 1 (1 skipped)");
    expect(text).toContain("Skipped Periods (no combination selected, not tested)");
  });
});
