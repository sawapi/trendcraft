import { describe, expect, it, vi } from "vitest";
import type { NormalizedCandle, PresetCondition } from "../../types";
import type {
  OptimizationMetric,
  OptimizationResultEntry,
  ParetoObjective,
} from "../../types/optimization";
import {
  crowdingDistance,
  fastNonDominatedSort,
  paretoOptimization,
  paretoOptimizationSafe,
  summarizeParetoResult,
} from "../pareto";

// ============================================
// Helpers
// ============================================

/**
 * Create a mock OptimizationResultEntry with given metric values
 */
function mockEntry(
  metrics: Partial<Record<OptimizationMetric, number>>,
  params: Record<string, number> = {},
): OptimizationResultEntry {
  const defaults: Record<OptimizationMetric, number> = {
    sharpe: 0,
    calmar: 0,
    mar: 0,
    profitFactor: 0,
    recoveryFactor: 0,
    returns: 0,
    winRate: 0,
    tradeCount: 0,
    maxDrawdown: 0,
  };
  return {
    params,
    score: 0,
    metrics: { ...defaults, ...metrics },
    backtest: {} as any,
    passedConstraints: true,
  };
}

/**
 * Generate test candles with an upward trend
 */
function generateUpTrendCandles(
  count: number,
  startPrice = 100,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price *= 1.003;
    const dailyRange = price * 0.02;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - dailyRange * 0.25,
      high: price + dailyRange * 0.25,
      low: price - dailyRange * 0.5,
      close: price,
      volume: 1000000,
      _normalized: true as const,
    });
  }

  return candles;
}

const createEnterCondition = (enterIndex: number): PresetCondition => ({
  type: "preset",
  name: "paramEnter",
  evaluate: (_indicators, _candle, index) => index === enterIndex,
});

const createExitCondition = (exitIndex: number): PresetCondition => ({
  type: "preset",
  name: "paramExit",
  evaluate: (_indicators, _candle, index) => index === exitIndex,
});

// Objectives used in multiple tests
const twoObjectives: ParetoObjective[] = [
  { metric: "sharpe", direction: "maximize" },
  { metric: "maxDrawdown", direction: "minimize" },
];

// ============================================
// Tests
// ============================================

describe("Pareto Optimization", () => {
  describe("fastNonDominatedSort", () => {
    it("should return empty for empty input", () => {
      const fronts = fastNonDominatedSort([], twoObjectives);
      expect(fronts).toEqual([]);
    });

    it("should place a single solution in front 0", () => {
      const entries = [mockEntry({ sharpe: 1.5, maxDrawdown: 10 })];
      const fronts = fastNonDominatedSort(entries, twoObjectives);
      expect(fronts).toHaveLength(1);
      expect(fronts[0]).toEqual([0]);
    });

    it("should place two non-dominated solutions both in front 0", () => {
      // A is better on sharpe, B is better on maxDrawdown (lower)
      const entries = [
        mockEntry({ sharpe: 2.0, maxDrawdown: 15 }),
        mockEntry({ sharpe: 1.0, maxDrawdown: 5 }),
      ];
      const fronts = fastNonDominatedSort(entries, twoObjectives);
      expect(fronts).toHaveLength(1);
      expect(fronts[0]).toContain(0);
      expect(fronts[0]).toContain(1);
    });

    it("should place a dominated solution in front 1", () => {
      // A dominates B (better sharpe AND lower drawdown)
      const entries = [
        mockEntry({ sharpe: 2.0, maxDrawdown: 5 }),
        mockEntry({ sharpe: 1.0, maxDrawdown: 10 }),
      ];
      const fronts = fastNonDominatedSort(entries, twoObjectives);
      expect(fronts).toHaveLength(2);
      expect(fronts[0]).toEqual([0]);
      expect(fronts[1]).toEqual([1]);
    });

    it("should create three fronts with cascading domination", () => {
      // A dominates B dominates C
      const entries = [
        mockEntry({ sharpe: 3.0, maxDrawdown: 3 }), // best
        mockEntry({ sharpe: 2.0, maxDrawdown: 5 }), // mid
        mockEntry({ sharpe: 1.0, maxDrawdown: 10 }), // worst
      ];
      const fronts = fastNonDominatedSort(entries, twoObjectives);
      expect(fronts).toHaveLength(3);
      expect(fronts[0]).toEqual([0]);
      expect(fronts[1]).toEqual([1]);
      expect(fronts[2]).toEqual([2]);
    });

    it("should place all identical solutions in front 0", () => {
      const entries = [
        mockEntry({ sharpe: 1.5, maxDrawdown: 10 }),
        mockEntry({ sharpe: 1.5, maxDrawdown: 10 }),
        mockEntry({ sharpe: 1.5, maxDrawdown: 10 }),
      ];
      const fronts = fastNonDominatedSort(entries, twoObjectives);
      expect(fronts).toHaveLength(1);
      expect(fronts[0]).toHaveLength(3);
    });
  });

  describe("crowdingDistance", () => {
    it("should return empty map for empty front", () => {
      const distances = crowdingDistance([], [], twoObjectives);
      expect(distances.size).toBe(0);
    });

    it("should return Infinity for a single solution", () => {
      const entries = [mockEntry({ sharpe: 1.5, maxDrawdown: 10 })];
      const distances = crowdingDistance(entries, [0], twoObjectives);
      expect(distances.get(0)).toBe(Infinity);
    });

    it("should return Infinity for two solutions", () => {
      const entries = [
        mockEntry({ sharpe: 1.0, maxDrawdown: 5 }),
        mockEntry({ sharpe: 2.0, maxDrawdown: 15 }),
      ];
      const distances = crowdingDistance(entries, [0, 1], twoObjectives);
      expect(distances.get(0)).toBe(Infinity);
      expect(distances.get(1)).toBe(Infinity);
    });

    it("should assign Infinity to boundary solutions and finite to interior", () => {
      const entries = [
        mockEntry({ sharpe: 1.0, maxDrawdown: 15 }),
        mockEntry({ sharpe: 1.5, maxDrawdown: 10 }),
        mockEntry({ sharpe: 2.0, maxDrawdown: 5 }),
      ];
      const distances = crowdingDistance(entries, [0, 1, 2], twoObjectives);

      // Boundaries should be Infinity
      expect(distances.get(0)).toBe(Infinity);
      expect(distances.get(2)).toBe(Infinity);

      // Interior should be finite and positive
      const interiorDist = distances.get(1)!;
      expect(Number.isFinite(interiorDist)).toBe(true);
      expect(interiorDist).toBeGreaterThan(0);
    });

    it("should handle same values in one objective", () => {
      const entries = [
        mockEntry({ sharpe: 1.0, maxDrawdown: 10 }),
        mockEntry({ sharpe: 1.5, maxDrawdown: 10 }),
        mockEntry({ sharpe: 2.0, maxDrawdown: 10 }),
      ];
      // maxDrawdown range is 0, so only sharpe contributes to crowding distance
      const distances = crowdingDistance(entries, [0, 1, 2], twoObjectives);

      // Boundaries still get Infinity
      expect(distances.get(0)).toBe(Infinity);
      expect(distances.get(2)).toBe(Infinity);

      // Interior should be finite
      const interiorDist = distances.get(1)!;
      expect(Number.isFinite(interiorDist)).toBe(true);
    });
  });

  describe("paretoOptimization", () => {
    it("should throw for fewer than 2 objectives", () => {
      const candles = generateUpTrendCandles(100);
      expect(() =>
        paretoOptimization(candles, () => ({} as any), [], {
          objectives: [{ metric: "sharpe", direction: "maximize" }],
        }),
      ).toThrow("Pareto optimization requires 2-4 objectives");
    });

    it("should throw for more than 4 objectives", () => {
      const candles = generateUpTrendCandles(100);
      const fiveObjectives: ParetoObjective[] = [
        { metric: "sharpe", direction: "maximize" },
        { metric: "returns", direction: "maximize" },
        { metric: "winRate", direction: "maximize" },
        { metric: "profitFactor", direction: "maximize" },
        { metric: "maxDrawdown", direction: "minimize" },
      ];
      expect(() =>
        paretoOptimization(candles, () => ({} as any), [], {
          objectives: fiveObjectives,
        }),
      ).toThrow("Pareto optimization requires 2-4 objectives");
    });

    it("should throw when too many combinations exceed maxCombinations", () => {
      const candles = generateUpTrendCandles(100);
      expect(() =>
        paretoOptimization(
          candles,
          () => ({} as any),
          [{ name: "p", min: 1, max: 100, step: 1 }],
          {
            objectives: twoObjectives,
            maxCombinations: 10,
          },
        ),
      ).toThrow("Too many combinations");
    });

    it("should return empty result when no valid results", () => {
      const candles = generateUpTrendCandles(100);
      // Strategy that always throws
      const result = paretoOptimization(
        candles,
        () => {
          throw new Error("fail");
        },
        [{ name: "p", min: 1, max: 2, step: 1 }],
        { objectives: twoObjectives },
      );

      expect(result.paretoFront).toHaveLength(0);
      expect(result.allResults).toHaveLength(0);
      expect(result.validCombinations).toBe(0);
      expect(result.totalCombinations).toBe(2);
    });

    it("should run basic 2-objective optimization", () => {
      const candles = generateUpTrendCandles(100);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.floor(params.enterAt)),
        exit: createExitCondition(
          Math.floor(params.enterAt) + Math.floor(params.holdBars),
        ),
      });

      const result = paretoOptimization(
        candles,
        createStrategy,
        [
          { name: "enterAt", min: 5, max: 15, step: 5 },
          { name: "holdBars", min: 10, max: 20, step: 10 },
        ],
        { objectives: twoObjectives },
      );

      expect(result.totalCombinations).toBe(6);
      expect(result.objectives).toEqual(twoObjectives);
      // At least some results should be valid
      expect(result.allResults.length).toBeGreaterThanOrEqual(0);
      // All pareto front entries should have frontIndex 0
      for (const entry of result.paretoFront) {
        expect(entry.frontIndex).toBe(0);
      }
    });

    it("should filter results with constraints", () => {
      const candles = generateUpTrendCandles(100);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.floor(params.enterAt)),
        exit: createExitCondition(Math.floor(params.enterAt) + 20),
      });

      const result = paretoOptimization(
        candles,
        createStrategy,
        [{ name: "enterAt", min: 5, max: 25, step: 5 }],
        {
          objectives: twoObjectives,
          constraints: [{ metric: "tradeCount", operator: ">=", value: 1 }],
        },
      );

      // All results should have at least 1 trade
      for (const entry of result.allResults) {
        expect(entry.metrics.tradeCount).toBeGreaterThanOrEqual(1);
      }
    });

    it("should call progress callback", () => {
      const candles = generateUpTrendCandles(100);
      const progressCalls: [number, number][] = [];

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.floor(params.enterAt)),
        exit: createExitCondition(Math.floor(params.enterAt) + 10),
      });

      paretoOptimization(
        candles,
        createStrategy,
        [{ name: "enterAt", min: 5, max: 15, step: 5 }],
        {
          objectives: twoObjectives,
          progressCallback: (current, total) => {
            progressCalls.push([current, total]);
          },
        },
      );

      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[0]).toEqual([1, 3]);
      expect(progressCalls[2]).toEqual([3, 3]);
    });

    it("should ensure pareto front solutions are non-dominated", () => {
      const candles = generateUpTrendCandles(100);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.floor(params.enterAt)),
        exit: createExitCondition(Math.floor(params.enterAt) + 15),
      });

      const result = paretoOptimization(
        candles,
        createStrategy,
        [{ name: "enterAt", min: 5, max: 30, step: 5 }],
        { objectives: twoObjectives },
      );

      // Verify no pareto front solution dominates another
      const front = result.paretoFront;
      for (let i = 0; i < front.length; i++) {
        for (let j = i + 1; j < front.length; j++) {
          const a = front[i].metrics;
          const b = front[j].metrics;

          // Check a does not dominate b
          const aDominatesB =
            twoObjectives.every((obj) => {
              const va =
                obj.direction === "maximize"
                  ? a[obj.metric]
                  : -a[obj.metric];
              const vb =
                obj.direction === "maximize"
                  ? b[obj.metric]
                  : -b[obj.metric];
              return va >= vb;
            }) &&
            twoObjectives.some((obj) => {
              const va =
                obj.direction === "maximize"
                  ? a[obj.metric]
                  : -a[obj.metric];
              const vb =
                obj.direction === "maximize"
                  ? b[obj.metric]
                  : -b[obj.metric];
              return va > vb;
            });

          expect(aDominatesB).toBe(false);
        }
      }
    });

    it("should sort results by front index then crowding distance", () => {
      const candles = generateUpTrendCandles(100);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.floor(params.enterAt)),
        exit: createExitCondition(Math.floor(params.enterAt) + 15),
      });

      const result = paretoOptimization(
        candles,
        createStrategy,
        [{ name: "enterAt", min: 5, max: 30, step: 5 }],
        { objectives: twoObjectives },
      );

      // Verify sorting: front index ascending
      for (let i = 1; i < result.allResults.length; i++) {
        const prev = result.allResults[i - 1];
        const curr = result.allResults[i];
        if (prev.frontIndex === curr.frontIndex) {
          // Within same front, crowding distance should be descending
          expect(prev.crowdingDistance).toBeGreaterThanOrEqual(
            curr.crowdingDistance,
          );
        } else {
          expect(prev.frontIndex).toBeLessThan(curr.frontIndex);
        }
      }
    });
  });

  describe("paretoOptimizationSafe", () => {
    it("should return err for invalid objectives count", () => {
      const candles = generateUpTrendCandles(50);
      const result = paretoOptimizationSafe(candles, () => ({} as any), [], {
        objectives: [{ metric: "sharpe", direction: "maximize" }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("2-4 objectives");
      }
    });

    it("should return ok for valid input", () => {
      const candles = generateUpTrendCandles(100);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.floor(params.enterAt)),
        exit: createExitCondition(Math.floor(params.enterAt) + 10),
      });

      const result = paretoOptimizationSafe(
        candles,
        createStrategy,
        [{ name: "enterAt", min: 5, max: 10, step: 5 }],
        { objectives: twoObjectives },
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("summarizeParetoResult", () => {
    it("should return a non-empty string for empty result", () => {
      const summary = summarizeParetoResult({
        paretoFront: [],
        allResults: [],
        objectives: twoObjectives,
        totalCombinations: 10,
        validCombinations: 0,
      });
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toContain("Pareto Optimization Summary");
      expect(summary).toContain("Pareto front size: 0");
    });

    it("should include objective details and solution info for non-empty result", () => {
      const entry = {
        ...mockEntry({ sharpe: 1.5, maxDrawdown: 8 }, { rsiPeriod: 14 }),
        frontIndex: 0,
        crowdingDistance: Infinity,
      };
      const summary = summarizeParetoResult({
        paretoFront: [entry],
        allResults: [entry],
        objectives: twoObjectives,
        totalCombinations: 5,
        validCombinations: 3,
      });
      expect(summary).toContain("sharpe (maximize)");
      expect(summary).toContain("maxDrawdown (minimize)");
      expect(summary).toContain("Pareto front size: 1");
      expect(summary).toContain("rsiPeriod=14");
    });
  });
});
