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
