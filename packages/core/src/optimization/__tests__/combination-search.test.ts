import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PresetCondition } from "../../types";
import type { ConditionDefinition } from "../combination-search";
import { combinationSearch } from "../combination-search";

/**
 * Generate trending candles with alternating up/down cycles
 */
function generateTrendingCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const cycle = Math.floor(i / 30);
    let price: number;

    if (cycle % 2 === 0) {
      price = 100 + (i % 30) * 2; // Uptrend
    } else {
      price = 100 + 60 - (i % 30) * 2; // Downtrend
    }

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return candles;
}

// Condition that fires when price > threshold
function priceAbove(threshold: number): PresetCondition {
  return {
    type: "preset",
    name: `priceAbove(${threshold})`,
    evaluate: (_indicators, candle) => candle.close > threshold,
  };
}

// Condition that fires when price < threshold
function priceBelow(threshold: number): PresetCondition {
  return {
    type: "preset",
    name: `priceBelow(${threshold})`,
    evaluate: (_indicators, candle) => candle.close < threshold,
  };
}

// Condition that always fires
function alwaysTrue(): PresetCondition {
  return {
    type: "preset",
    name: "alwaysTrue",
    evaluate: () => true,
  };
}

// Condition that never fires
function neverTrue(): PresetCondition {
  return {
    type: "preset",
    name: "neverTrue",
    evaluate: () => false,
  };
}

describe("combinationSearch", () => {
  const candles = generateTrendingCandles(120);

  it("should run basic combination search", () => {
    const entryDefs: ConditionDefinition[] = [
      { name: "pAbove110", displayName: "Price > 110", create: () => priceAbove(110) },
    ];
    const exitDefs: ConditionDefinition[] = [
      { name: "pBelow105", displayName: "Price < 105", create: () => priceBelow(105) },
    ];

    const result = combinationSearch(candles, entryDefs, exitDefs, {
      metric: "returns",
      backtestOptions: { capital: 100000 },
    });

    expect(result.totalCombinations).toBe(1);
    expect(result.results.length).toBeGreaterThanOrEqual(0);
  });

  it("should use OR combining when useOr is true", () => {
    // Two conditions that are individually very restrictive:
    // - priceAbove(150): only fires at peaks
    // - priceBelow(102): only fires at troughs
    // With AND: both must be true simultaneously → never fires → no trades
    // With OR: either can fire → should produce trades
    const entryDefs: ConditionDefinition[] = [
      { name: "highEntry", displayName: "Price > 150", create: () => priceAbove(150) },
      { name: "lowEntry", displayName: "Price < 102", create: () => priceBelow(102) },
    ];
    const exitDefs: ConditionDefinition[] = [
      { name: "exit", displayName: "Always Exit", create: () => alwaysTrue() },
    ];

    // AND mode: no trades because price can't be both > 150 AND < 102
    const andResult = combinationSearch(candles, entryDefs, exitDefs, {
      metric: "returns",
      minEntryConditions: 2,
      maxEntryConditions: 2,
      useOr: false,
      keepAllResults: true,
      backtestOptions: { capital: 100000 },
    });

    // OR mode: should have trades because either condition can trigger
    const orResult = combinationSearch(candles, entryDefs, exitDefs, {
      metric: "returns",
      minEntryConditions: 2,
      maxEntryConditions: 2,
      useOr: true,
      keepAllResults: true,
      backtestOptions: { capital: 100000 },
    });

    // AND should have 0 results (impossible for both to be true)
    expect(andResult.results.length).toBe(0);

    // OR should have results because either condition can fire
    expect(orResult.results.length).toBeGreaterThan(0);
  });

  it("should always AND required conditions even with useOr", () => {
    // Required: price must be above 100 (always AND)
    // Search conditions with OR: priceAbove(150) OR neverTrue
    // Since neverTrue never fires, only priceAbove(150) matters in OR
    // But required condition (priceAbove(100)) is always ANDed
    const entryDefs: ConditionDefinition[] = [
      { name: "required", displayName: "Price > 100", create: () => priceAbove(100) },
      { name: "searchHigh", displayName: "Price > 150", create: () => priceAbove(150) },
      { name: "searchNever", displayName: "Never", create: () => neverTrue() },
    ];
    const exitDefs: ConditionDefinition[] = [
      { name: "exit", displayName: "Always Exit", create: () => alwaysTrue() },
    ];

    const result = combinationSearch(candles, entryDefs, exitDefs, {
      metric: "returns",
      minEntryConditions: 2,
      maxEntryConditions: 3,
      useOr: true,
      keepAllResults: true,
      requiredEntryConditions: ["required"],
      backtestOptions: { capital: 100000 },
    });

    // Should have tested combos (searchHigh alone, searchNever alone, both)
    expect(result.totalCombinations).toBeGreaterThan(0);

    // Check that search conditions used OR:
    // The combo [searchHigh, searchNever] with OR → priceAbove(150) || never
    // ANDed with required → (priceAbove(100)) AND (priceAbove(150) || never)
    // This should produce some trades when price > 150
    const comboWithBoth = result.results.find(
      (r) => r.entryConditions.includes("searchHigh") && r.entryConditions.includes("searchNever"),
    );
    if (comboWithBoth) {
      // With OR, searchHigh || searchNever can still fire (when searchHigh is true)
      expect(comboWithBoth.backtest.tradeCount).toBeGreaterThan(0);
    }
  });
});

describe("combinationSearch — non-finite scores and the winning entry", () => {
  /** Strictly rising closes: no drawdown, so Calmar / MAR / Recovery are NaN. */
  function monotonicCandles(count: number): NormalizedCandle[] {
    const baseTime = new Date("2015-01-01").getTime();
    const out: NormalizedCandle[] = [];
    for (let i = 0; i < count; i++) {
      const price = 100 + i;
      out.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price,
        high: price + 0.5,
        low: price,
        close: price,
        volume: 1000,
      });
    }
    return out;
  }

  const upDefs: ConditionDefinition[] = [
    {
      name: "priceUp",
      displayName: "Price Up",
      create: () => ({
        type: "preset",
        name: "priceUp",
        evaluate: (_indicators, _candle, index, candles) =>
          index >= 1 && candles[index].close > candles[index - 1].close,
      }),
    },
    {
      name: "priceUp2",
      displayName: "Price Up (2 bars)",
      create: () => ({
        type: "preset",
        name: "priceUp2",
        evaluate: (_indicators, _candle, index, candles) =>
          index >= 2 && candles[index].close > candles[index - 2].close,
      }),
    },
  ];
  const downDefs: ConditionDefinition[] = [
    {
      name: "priceDown",
      displayName: "Price Down",
      create: () => ({
        type: "preset",
        name: "priceDown",
        evaluate: (_indicators, _candle, index, candles) =>
          index >= 1 && candles[index].close < candles[index - 1].close,
      }),
    },
  ];

  it("does not count combinations it can never select as valid", () => {
    const result = combinationSearch(monotonicCandles(400), upDefs, downDefs, {
      metric: "calmar",
      backtestOptions: { capital: 100000 },
    });

    // Every combination trades and passes the (empty) constraint set, but
    // Calmar is NaN with maxDrawdown === 0 and `score > bestScore` is false
    // for NaN. Previously that reported bestScore: null alongside
    // validCombinations: 3 — two answers to "did the search find anything".
    expect(result.bestResult).toBeNull();
    expect(result.bestScore).toBeNull();
    expect(result.validCombinations).toBe(0);
    expect(result.bestEntry).toEqual([]);
    expect(result.results).toEqual([]);
  });

  it("keeps non-finite scores out of the way when keepAllResults is set", () => {
    const result = combinationSearch(monotonicCandles(400), upDefs, downDefs, {
      metric: "calmar",
      keepAllResults: true,
      backtestOptions: { capital: 100000 },
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((r) => Number.isNaN(r.score))).toBe(true);
    expect(result.bestResult).toBeNull();
  });

  it("returns the winning entry, and the projections agree with it", () => {
    const result = combinationSearch(generateTrendingCandles(240), upDefs, downDefs, {
      metric: "returns",
      backtestOptions: { capital: 100000 },
    });

    const best = result.bestResult;
    expect(best).not.toBeNull();
    if (best === null) return;
    expect(result.bestEntry).toBe(best.entryConditions);
    expect(result.bestExit).toBe(best.exitConditions);
    expect(result.bestScore).toBe(best.score);
    expect(best.passedConstraints).toBe(true);
    expect(best.score).toBe(Math.max(...result.results.map((r) => r.score)));
  });

  it("distinguishes a legitimately empty entry from nothing being selected", () => {
    // minEntryConditions: 0 makes the empty entry combination a candidate.
    // Pinning maxEntryConditions to 0 as well leaves it as the ONLY
    // candidate, so it necessarily wins — proving `bestEntry.length === 0`
    // cannot be read as "the search selected nothing".
    const result = combinationSearch(generateTrendingCandles(240), upDefs, downDefs, {
      metric: "returns",
      minEntryConditions: 0,
      maxEntryConditions: 0,
      backtestOptions: { capital: 100000 },
    });

    expect(result.bestEntry).toEqual([]);
    expect(result.bestResult).not.toBeNull();
    expect(result.bestScore).not.toBeNull();
    expect(result.validCombinations).toBe(1);
  });
});
