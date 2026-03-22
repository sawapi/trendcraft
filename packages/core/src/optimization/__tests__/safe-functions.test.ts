/**
 * Tests for *Safe() function variants in optimization module.
 * Each Safe function wraps the throwing variant with Result<T> error handling.
 */

import { describe, expect, it } from "vitest";
import { runBacktest } from "../../backtest";
import type { Condition, NormalizedCandle } from "../../types";
import type { ParameterRange } from "../../types/optimization";
import { anchoredWalkForwardAnalysisSafe } from "../anchored-walkforward";
import type { ConditionDefinition } from "../combination-search";
import { combinationSearchSafe } from "../condition-pools";
import type { StrategyFactory } from "../grid-search";
import { gridSearchSafe } from "../grid-search";
import { runMonteCarloSimulationSafe } from "../monte-carlo";
import { walkForwardAnalysisSafe } from "../walkforward";

// Helper: create minimal NormalizedCandle data
const makeCandles = (count: number, basePrice = 100): NormalizedCandle[] =>
  Array.from({ length: count }, (_, i) => {
    const price = basePrice + Math.sin(i * 0.1) * 10 + i * 0.5;
    return {
      time: 1700000000000 + i * 86400000,
      open: price,
      high: price + 2,
      low: price - 2,
      close: price + (i % 2 === 0 ? 1 : -1),
      volume: 100000 + i * 100,
    };
  });

// Helper: simple always-true / always-false conditions
const alwaysTrue: Condition = () => true;
const alwaysFalse: Condition = () => false;

// Helper: alternating entry condition (enters every N bars)
const entryEveryN =
  (n: number): Condition =>
  (_indicators, _candle, i) =>
    i % n === 0;

// Helper: simple strategy factory for grid search
const simpleStrategyFactory: StrategyFactory = (params) => {
  const period = params.period ?? 5;
  return {
    entry: (_indicators, _candle, i) => i % period === 0,
    exit: (_indicators, _candle, i) => i % period === Math.floor(period / 2),
    options: { capital: 1000000 },
  };
};

// Helper: condition definitions for combination search
const makeEntryConditions = (): ConditionDefinition[] => [
  {
    name: "entry_a",
    displayName: "Entry A",
    create: () => entryEveryN(3),
  },
  {
    name: "entry_b",
    displayName: "Entry B",
    create: () => entryEveryN(5),
  },
];

const makeExitConditions = (): ConditionDefinition[] => [
  {
    name: "exit_a",
    displayName: "Exit A",
    create: () => entryEveryN(4),
  },
  {
    name: "exit_b",
    displayName: "Exit B",
    create: () => entryEveryN(6),
  },
];

describe("gridSearchSafe", () => {
  it("returns Ok with valid result on success", () => {
    const candles = makeCandles(200);
    const ranges: ParameterRange[] = [{ name: "period", min: 3, max: 5, step: 1 }];

    const result = gridSearchSafe(candles, simpleStrategyFactory, ranges);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalCombinations).toBeGreaterThan(0);
      expect(result.value.bestParams).toBeDefined();
    }
  });

  it("returns Err with TOO_MANY_COMBINATIONS for excessive parameter space", () => {
    const candles = makeCandles(50);
    const ranges: ParameterRange[] = Array.from({ length: 10 }, (_, i) => ({
      name: `param${i}`,
      min: 1,
      max: 100,
      step: 1,
    }));

    const result = gridSearchSafe(candles, simpleStrategyFactory, ranges, {
      maxCombinations: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOO_MANY_COMBINATIONS");
    }
  });

  it("preserves cause Error in error result", () => {
    const candles = makeCandles(50);
    const ranges: ParameterRange[] = Array.from({ length: 10 }, (_, i) => ({
      name: `param${i}`,
      min: 1,
      max: 100,
      step: 1,
    }));

    const result = gridSearchSafe(candles, simpleStrategyFactory, ranges, {
      maxCombinations: 100,
    });
    if (!result.ok) {
      expect(result.error.cause).toBeInstanceOf(Error);
    }
  });
});

describe("walkForwardAnalysisSafe", () => {
  it("returns Ok with valid result on success", () => {
    const candles = makeCandles(500);
    const ranges: ParameterRange[] = [{ name: "period", min: 3, max: 5, step: 1 }];

    const result = walkForwardAnalysisSafe(candles, simpleStrategyFactory, ranges, {
      windowSize: 100,
      stepSize: 50,
      testSize: 50,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.periods).toBeDefined();
      expect(result.value.recommendation).toBeDefined();
    }
  });

  it("returns Err with INSUFFICIENT_DATA for too few candles", () => {
    const candles = makeCandles(10);
    const ranges: ParameterRange[] = [{ name: "period", min: 3, max: 5, step: 1 }];

    const result = walkForwardAnalysisSafe(candles, simpleStrategyFactory, ranges, {
      windowSize: 100,
      stepSize: 50,
      testSize: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INSUFFICIENT_DATA");
    }
  });
});

describe("runMonteCarloSimulationSafe", () => {
  it("returns Ok with valid result on success", () => {
    // Use actual backtest to get a properly structured BacktestResult
    const candles = makeCandles(200);
    const backtestResult = runBacktest(candles, entryEveryN(10), entryEveryN(15), {
      capital: 1000000,
    });

    const result = runMonteCarloSimulationSafe(backtestResult, {
      simulations: 100,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.simulationCount).toBe(100);
      expect(result.value.assessment).toBeDefined();
    }
  });

  it("returns Err with INSUFFICIENT_DATA for too few trades", () => {
    // Run backtest that produces 0 or 1 trade
    const candles = makeCandles(10);
    const backtestResult = runBacktest(
      candles,
      (_ind, _c, i) => i === 0,
      (_ind, _c, i) => i === 9,
      { capital: 1000000 },
    );

    const result = runMonteCarloSimulationSafe(backtestResult);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INSUFFICIENT_DATA");
    }
  });
});

describe("combinationSearchSafe", () => {
  it("returns Ok with valid result on success", () => {
    const candles = makeCandles(200);

    const result = combinationSearchSafe(candles, makeEntryConditions(), makeExitConditions(), {
      backtestOptions: { capital: 1000000 },
      maxEntryConditions: 2,
      maxExitConditions: 2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalCombinations).toBeGreaterThan(0);
    }
  });

  it("returns Err with TOO_MANY_COMBINATIONS for excessive combinations", () => {
    const candles = makeCandles(50);
    const manyConditions: ConditionDefinition[] = Array.from({ length: 20 }, (_, i) => ({
      name: `cond_${i}`,
      displayName: `Condition ${i}`,
      create: () => alwaysTrue,
    }));

    const result = combinationSearchSafe(candles, manyConditions, manyConditions, {
      maxEntryConditions: 10,
      maxExitConditions: 10,
      maxCombinations: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOO_MANY_COMBINATIONS");
    }
  });
});

describe("anchoredWalkForwardAnalysisSafe", () => {
  it("returns Ok with valid result on success", () => {
    const candles = makeCandles(500);

    const result = anchoredWalkForwardAnalysisSafe(
      candles,
      makeEntryConditions(),
      makeExitConditions(),
      {
        anchorDate: candles[0].time,
        initialTrainSize: 100,
        expansionStep: 50,
        testSize: 50,
      },
      {
        backtestOptions: { capital: 1000000 },
        maxEntryConditions: 2,
        maxExitConditions: 2,
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.periods).toBeDefined();
      expect(result.value.recommendation).toBeDefined();
    }
  });

  it("returns Err with INSUFFICIENT_DATA for too few candles", () => {
    const candles = makeCandles(10);

    const result = anchoredWalkForwardAnalysisSafe(
      candles,
      makeEntryConditions(),
      makeExitConditions(),
      {
        anchorDate: candles[0].time,
        initialTrainSize: 504,
        testSize: 252,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INSUFFICIENT_DATA");
    }
  });
});
