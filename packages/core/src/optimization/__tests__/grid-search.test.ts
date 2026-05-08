import { describe, expect, it, vi } from "vitest";
import type { BacktestOptions, NormalizedCandle, PresetCondition } from "../../types";
import {
  constraint,
  countCombinations,
  GRID_SEARCH_EPSILON_FACTOR,
  generateParameterCombinations,
  getTopResults,
  gridSearch,
  param,
  summarizeGridSearch,
} from "../grid-search";

/**
 * Generate test candles with upward trend
 */
function generateUpTrendCandles(count: number, startPrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price *= 1.003; // ~0.3% daily increase
    const dailyRange = price * 0.02;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - dailyRange * 0.25,
      high: price + dailyRange * 0.25,
      low: price - dailyRange * 0.5,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// Simple condition: enter at specific index based on parameter
const createEnterCondition = (enterIndex: number): PresetCondition => ({
  type: "preset",
  name: "paramEnter",
  evaluate: (_indicators, _candle, index) => index === enterIndex,
});

// Simple condition: exit after N bars
const createExitCondition = (holdBars: number): PresetCondition => ({
  type: "preset",
  name: "paramExit",
  evaluate: (_indicators, _candle, index, _candles) => {
    // This is a simplified exit - just exit after holdBars from start
    return index === holdBars + 5;
  },
});

describe("Grid Search Optimization", () => {
  describe("generateParameterCombinations", () => {
    it("should return single empty object for empty ranges", () => {
      const combinations = generateParameterCombinations([]);
      expect(combinations).toEqual([{}]);
    });

    it("should generate correct combinations for single parameter", () => {
      const ranges = [param("period", 5, 10, 5)];
      const combinations = generateParameterCombinations(ranges);

      expect(combinations).toHaveLength(2);
      expect(combinations).toContainEqual({ period: 5 });
      expect(combinations).toContainEqual({ period: 10 });
    });

    it("should generate correct combinations for multiple parameters", () => {
      const ranges = [param("fast", 5, 10, 5), param("slow", 20, 25, 5)];
      const combinations = generateParameterCombinations(ranges);

      expect(combinations).toHaveLength(4);
      expect(combinations).toContainEqual({ fast: 5, slow: 20 });
      expect(combinations).toContainEqual({ fast: 5, slow: 25 });
      expect(combinations).toContainEqual({ fast: 10, slow: 20 });
      expect(combinations).toContainEqual({ fast: 10, slow: 25 });
    });

    it("should handle decimal steps correctly", () => {
      const ranges = [param("threshold", 0.1, 0.3, 0.1)];
      const combinations = generateParameterCombinations(ranges);

      expect(combinations).toHaveLength(3);
      expect(combinations[0].threshold).toBeCloseTo(0.1, 5);
      expect(combinations[1].threshold).toBeCloseTo(0.2, 5);
      expect(combinations[2].threshold).toBeCloseTo(0.3, 5);
    });

    it("should not generate values above max when step does not divide range evenly", () => {
      const ranges = [param("threshold", 0, 1, 0.4)];
      const combinations = generateParameterCombinations(ranges);

      expect(combinations).toEqual([{ threshold: 0 }, { threshold: 0.4 }, { threshold: 0.8 }]);
    });
  });

  describe("countCombinations", () => {
    it("should return 1 for empty ranges", () => {
      expect(countCombinations([])).toBe(1);
    });

    it("should count single parameter correctly", () => {
      expect(countCombinations([param("a", 1, 5, 1)])).toBe(5);
      expect(countCombinations([param("a", 10, 20, 2)])).toBe(6);
    });

    it("should multiply for multiple parameters", () => {
      const ranges = [
        param("a", 1, 3, 1), // 3 values
        param("b", 10, 20, 5), // 3 values
      ];
      expect(countCombinations(ranges)).toBe(9);
    });

    it("should match generated combinations when range is not evenly divisible by step", () => {
      const ranges = [param("threshold", 0, 1, 0.4)];
      expect(countCombinations(ranges)).toBe(generateParameterCombinations(ranges).length);
    });
  });

  describe("GRID_SEARCH_EPSILON_FACTOR", () => {
    it("is the same constant getParameterValues uses internally", () => {
      // Documented as 1_000_000; check explicitly so callers reproducing
      // grid points externally know the magic number.
      expect(GRID_SEARCH_EPSILON_FACTOR).toBe(1_000_000);
    });
  });

  describe("param helper", () => {
    it("should create parameter range object", () => {
      const range = param("period", 10, 30, 5);
      expect(range).toEqual({
        name: "period",
        min: 10,
        max: 30,
        step: 5,
      });
    });
  });

  describe("constraint helper", () => {
    it("should create constraint object", () => {
      const c = constraint("winRate", ">=", 50);
      expect(c).toEqual({
        metric: "winRate",
        operator: ">=",
        value: 50,
      });
    });
  });

  describe("gridSearch", () => {
    it("should find best parameters for simple strategy", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(Math.round(params.holdBars)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [
        param("enterAt", 5, 10, 5),
        param("holdBars", 10, 15, 5),
      ]);

      expect(result.totalCombinations).toBe(4);
      expect(result.bestParams).toBeDefined();
      expect(typeof result.bestScore).toBe("number");
    });

    it("should filter by constraints", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(Math.round(params.holdBars)),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(
        candles,
        createStrategy,
        [param("enterAt", 5, 10, 5), param("holdBars", 10, 15, 5)],
        {
          constraints: [constraint("winRate", ">=", 0)], // Very low bar
        },
      );

      expect(result.validCombinations).toBeGreaterThanOrEqual(0);
    });

    it("should call progress callback", () => {
      const candles = generateUpTrendCandles(50);
      const progressFn = vi.fn();

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });

      gridSearch(candles, createStrategy, [param("enterAt", 5, 15, 5)], {
        progressCallback: progressFn,
      });

      expect(progressFn).toHaveBeenCalledTimes(3);
      expect(progressFn).toHaveBeenCalledWith(1, 3);
      expect(progressFn).toHaveBeenCalledWith(2, 3);
      expect(progressFn).toHaveBeenCalledWith(3, 3);
    });

    it("should throw error when too many combinations", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(params.a),
        exit: createExitCondition(10),
      });

      // Create ranges that would generate > 10000 combinations
      const ranges = [
        param("a", 1, 100, 1), // 100 values
        param("b", 1, 200, 1), // 200 values = 20000 total
      ];

      expect(() => gridSearch(candles, createStrategy, ranges)).toThrow(
        /Too many parameter combinations/,
      );
    });

    it("should allow custom maxCombinations", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.a)),
        exit: createExitCondition(10),
      });

      // This would fail with default maxCombinations
      const ranges = [
        param("a", 1, 100, 1), // 100 values
        param("b", 1, 200, 1), // 200 values = 20000 total
      ];

      expect(() =>
        gridSearch(candles, createStrategy, ranges, {
          maxCombinations: 50000,
        }),
      ).not.toThrow();
    });

    it("should sort results by score descending", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 20, 5)], {
        keepAllResults: true,
      });

      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].score).toBeGreaterThanOrEqual(result.results[i].score);
      }
    });

    it("should optimize for different metrics", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });

      const sharpeResult = gridSearch(candles, createStrategy, [param("enterAt", 5, 15, 5)], {
        metric: "sharpe",
      });

      const returnsResult = gridSearch(candles, createStrategy, [param("enterAt", 5, 15, 5)], {
        metric: "returns",
      });

      expect(sharpeResult.metric).toBe("sharpe");
      expect(returnsResult.metric).toBe("returns");
    });
  });

  describe("getTopResults", () => {
    it("should return top N results", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 25, 5)], {
        keepAllResults: true,
      });

      const top2 = getTopResults(result, 2);
      expect(top2.length).toBeLessThanOrEqual(2);
    });
  });

  describe("summarizeGridSearch", () => {
    it("should summarize results correctly", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 15, 5)]);

      const summary = summarizeGridSearch(result);

      expect(summary.totalTested).toBe(3);
      expect(summary.metric).toBe("sharpe");
      expect(summary.bestParams).toBeDefined();
      expect(typeof summary.validPercent).toBe("number");
    });
  });

  describe("null fallback when no valid combinations", () => {
    // Documents the contract that bestScore / bestParams are `null`
    // (not `0` / `{}`) when no combination satisfies the constraints.
    // The legacy `0` fallback was indistinguishable from an actual
    // optimum of zero — callers couldn't tell "no result" from "result
    // is exactly zero". null is the explicit empty-state signal.
    it("returns null bestScore and bestParams when no combination passes constraints", () => {
      const candles = generateUpTrendCandles(50);
      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });
      const result = gridSearch(
        candles,
        createStrategy,
        [param("enterAt", 5, 10, 5)],
        // Impossible constraint — no combination will pass.
        { constraints: [constraint("sharpe", ">=", 9999)] },
      );
      expect(result.validCombinations).toBe(0);
      expect(result.bestScore).toBeNull();
      expect(result.bestParams).toBeNull();
    });

    it("returns non-null bestScore and bestParams when at least one combination is valid", () => {
      const candles = generateUpTrendCandles(50);
      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });
      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 10, 5)]);
      // No constraints, so every combination "passes" trivially.
      expect(result.validCombinations).toBeGreaterThan(0);
      expect(result.bestScore).not.toBeNull();
      expect(result.bestParams).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle empty parameter ranges", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = () => ({
        entry: createEnterCondition(5),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, []);

      expect(result.totalCombinations).toBe(1);
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle single value ranges", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(10),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 5, 1)]);

      expect(result.totalCombinations).toBe(1);
    });
  });

  describe("NaN / Infinity score handling", () => {
    // Regression for an A6 audit finding: when `metric` is calmar /
    // mar / recoveryFactor and a combination has maxDrawdown=0 (e.g.
    // a single tiny winning trade), the metric returns NaN
    // (empyrical / pyfolio convention). Without an isFinite guard,
    // any combination producing such a result was eligible to win
    // the ranking — flat strategies could outrank legitimate ones
    // simply because they were lucky enough to never draw down.
    it("excludes non-finite scores from default results array (without keepAllResults)", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(1),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 10, 1)], {
        metric: "calmar",
      });

      // Default behavior: NaN scores filtered out so downstream
      // consumers (strategy-dna's computeRecommendedParams /
      // extractSensitivityData) don't have to re-guard.
      for (const r of result.results) {
        expect(Number.isFinite(r.score)).toBe(true);
      }
    });

    it("keeps non-finite scores at the end when keepAllResults is true", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(1),
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 10, 1)], {
        metric: "calmar",
        keepAllResults: true,
      });

      // With keepAllResults, NaN entries surface for inspection but
      // sink to the end of the sorted array.
      let firstNaNIdx = -1;
      for (let i = 0; i < result.results.length; i++) {
        if (!Number.isFinite(result.results[i].score)) {
          firstNaNIdx = i;
          break;
        }
      }
      if (firstNaNIdx >= 0) {
        for (let i = firstNaNIdx; i < result.results.length; i++) {
          expect(Number.isFinite(result.results[i].score)).toBe(false);
        }
      }
    });

    it("rejects NaN score (Calmar with maxDD=0) from being treated as best", () => {
      const candles = generateUpTrendCandles(50);

      const createStrategy = (params: Record<string, number>) => ({
        entry: createEnterCondition(Math.round(params.enterAt)),
        exit: createExitCondition(1), // Exit one bar later — minimizes DD
        options: { capital: 100000 } as BacktestOptions,
      });

      const result = gridSearch(candles, createStrategy, [param("enterAt", 5, 10, 1)], {
        metric: "calmar",
      });

      // Either every score is finite (all combinations had a real DD)
      // or, when some scored NaN, the bestScore is still finite (or
      // null when no finite score existed). Specifically: NaN must
      // never be reported as bestScore.
      if (result.bestScore !== null) {
        expect(Number.isFinite(result.bestScore)).toBe(true);
      }

      // Ranking is deterministic: NaN scores sink to the end of the
      // sorted results list.
      let firstNaNIdx = -1;
      for (let i = 0; i < result.results.length; i++) {
        if (!Number.isFinite(result.results[i].score)) {
          firstNaNIdx = i;
          break;
        }
      }
      if (firstNaNIdx >= 0) {
        for (let i = firstNaNIdx; i < result.results.length; i++) {
          expect(Number.isFinite(result.results[i].score)).toBe(false);
        }
      }
    });
  });
});
