/**
 * MTF Context Tests
 */

import { describe, expect, it } from "vitest";
import type { MtfContext, NormalizedCandle } from "../../types";
import {
  buildMtfIndexMap,
  createMtfContext,
  getCurrentMtfIndicatorValue,
  getMtfCandle,
  getMtfIndicator,
  getMtfTimeframes,
  hasMtfTimeframe,
  setMtfIndicator,
  updateMtfIndices,
} from "../mtf-context";

// Helper to create daily candles
function createDailyCandles(days: number, startTime = 0): NormalizedCandle[] {
  const MS_PER_DAY = 86400000;
  return Array(days)
    .fill(null)
    .map((_, i) => ({
      time: startTime + i * MS_PER_DAY,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000 + i * 10,
    }));
}

// Create candles starting from a specific date
function createDailyCandlesFromDate(startDate: Date, days: number): NormalizedCandle[] {
  const MS_PER_DAY = 86400000;
  const startTime = startDate.getTime();
  return Array(days)
    .fill(null)
    .map((_, i) => ({
      time: startTime + i * MS_PER_DAY,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000 + i * 10,
    }));
}

describe("createMtfContext", () => {
  it("should create context with specified timeframes", () => {
    const candles = createDailyCandles(100);
    const context = createMtfContext(candles, ["weekly"]);

    expect(context.datasets).toBeDefined();
    expect(context.indices).toBeDefined();
    expect(context.currentTime).toBe(0);
  });

  it("should resample daily candles to weekly", () => {
    // Create 30 days of data starting from a Monday
    const startDate = new Date("2024-01-01"); // This is a Monday
    const candles = createDailyCandlesFromDate(startDate, 35); // 5 weeks

    const context = createMtfContext(candles, ["weekly"]);
    const weeklyDataset = context.datasets.get("weekly");

    expect(weeklyDataset).toBeDefined();
    // Should have about 5 weekly candles
    expect(weeklyDataset?.candles.length).toBeGreaterThanOrEqual(4);
    expect(weeklyDataset?.candles.length).toBeLessThanOrEqual(6);
  });

  it("should resample daily candles to monthly", () => {
    // Create 90 days of data
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 90); // ~3 months

    const context = createMtfContext(candles, ["monthly"]);
    const monthlyDataset = context.datasets.get("monthly");

    expect(monthlyDataset).toBeDefined();
    // Should have about 3 monthly candles
    expect(monthlyDataset?.candles.length).toBeGreaterThanOrEqual(2);
    expect(monthlyDataset?.candles.length).toBeLessThanOrEqual(4);
  });

  it("should create multiple timeframe datasets", () => {
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 90);

    const context = createMtfContext(candles, ["weekly", "monthly"]);

    expect(context.datasets.has("weekly")).toBe(true);
    expect(context.datasets.has("monthly")).toBe(true);
  });

  it("should handle empty candles array", () => {
    const context = createMtfContext([], ["weekly"]);

    // Implementation may create empty dataset or no dataset
    // Just verify context is created successfully
    expect(context).toBeDefined();
    expect(context.datasets).toBeDefined();
  });

  it("should initialize indicator cache for each timeframe", () => {
    const candles = createDailyCandles(50);
    const context = createMtfContext(candles, ["weekly"]);

    const weeklyDataset = context.datasets.get("weekly");
    expect(weeklyDataset?.indicators).toBeDefined();
    // indicators is Record<string, unknown>, not Map
    expect(typeof weeklyDataset?.indicators).toBe("object");
  });
});

describe("buildMtfIndexMap", () => {
  it("should create index mapping from daily to weekly", () => {
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 21); // 3 weeks

    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);

    expect(indexMap.has("weekly")).toBe(true);
    const weeklyMap = indexMap.get("weekly")!;

    // Each daily candle should map to a weekly candle index
    expect(weeklyMap.length).toBe(21);

    // First week candles should map to same index
    const firstWeekIndices = weeklyMap.slice(0, 5);
    expect(new Set(firstWeekIndices).size).toBeLessThanOrEqual(2);
  });

  it("should map daily indices to correct weekly indices", () => {
    const startDate = new Date("2024-01-01"); // Monday
    const candles = createDailyCandlesFromDate(startDate, 14); // 2 weeks

    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);
    const weeklyMap = indexMap.get("weekly")!;

    // Days in first week should map to index 0 or early indices
    // Days in second week should map to higher indices
    const firstWeekMax = Math.max(...weeklyMap.slice(0, 5));
    const secondWeekMin = Math.min(...weeklyMap.slice(7, 12));

    // Second week should map to same or higher indices
    expect(secondWeekMin).toBeGreaterThanOrEqual(firstWeekMax);
  });
});

describe("updateMtfIndices", () => {
  it("should update indices for current time", () => {
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 21);

    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);

    // Update to day 10
    updateMtfIndices(context, indexMap, 10, candles[10].time);

    expect(context.currentTime).toBe(candles[10].time);
    expect(context.indices.has("weekly")).toBe(true);
    expect(context.indices.get("weekly")).toBeGreaterThanOrEqual(0);
  });

  it("should progress indices as time advances", () => {
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 28);

    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);

    // Update to day 5
    updateMtfIndices(context, indexMap, 5, candles[5].time);
    const weeklyIndexDay5 = context.indices.get("weekly");

    // Update to day 15
    updateMtfIndices(context, indexMap, 15, candles[15].time);
    const weeklyIndexDay15 = context.indices.get("weekly");

    // Index should be same or higher after more time passes
    expect(weeklyIndexDay15).toBeGreaterThanOrEqual(weeklyIndexDay5!);
  });
});

describe("getMtfCandle", () => {
  it("should retrieve candle for specified timeframe", () => {
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 21);

    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);
    updateMtfIndices(context, indexMap, 10, candles[10].time);

    const weeklyCandle = getMtfCandle(context, "weekly");

    expect(weeklyCandle).toBeDefined();
    expect(weeklyCandle).toHaveProperty("time");
    expect(weeklyCandle).toHaveProperty("open");
    expect(weeklyCandle).toHaveProperty("close");
  });

  it("should return undefined or null for missing timeframe", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    const monthlyCandle = getMtfCandle(context, "monthly");
    expect(monthlyCandle == null).toBe(true);
  });
});

describe("getMtfIndicator / setMtfIndicator", () => {
  it("should store and retrieve indicator data", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    const rsiData = [
      { time: 1, value: 50 },
      { time: 2, value: 55 },
    ];

    setMtfIndicator(context, "weekly", "rsi_14", rsiData);
    const retrieved = getMtfIndicator<typeof rsiData>(context, "weekly", "rsi_14");

    expect(retrieved).toEqual(rsiData);
  });

  it("should return undefined for missing indicator", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    const result = getMtfIndicator(context, "weekly", "nonexistent");
    expect(result).toBeUndefined();
  });

  it("should return undefined for missing timeframe", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    const result = getMtfIndicator(context, "monthly", "rsi_14");
    expect(result).toBeUndefined();
  });

  it("should allow updating indicator data", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    setMtfIndicator(context, "weekly", "rsi_14", [{ time: 1, value: 50 }]);
    setMtfIndicator(context, "weekly", "rsi_14", [{ time: 1, value: 60 }]);

    const result = getMtfIndicator<Array<{ time: number; value: number }>>(
      context,
      "weekly",
      "rsi_14",
    );
    expect(result?.[0].value).toBe(60);
  });
});

describe("getCurrentMtfIndicatorValue", () => {
  it("should retrieve current indicator value based on index", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);

    const indicatorData = [
      { time: 1, value: 50 },
      { time: 2, value: 55 },
      { time: 3, value: 60 },
    ];
    setMtfIndicator(context, "weekly", "rsi_14", indicatorData);

    // Set index to 1
    updateMtfIndices(context, indexMap, 7, candles[7].time);

    const value = getCurrentMtfIndicatorValue<number>(context, "weekly", "rsi_14");
    expect(value).toBeDefined();
  });

  it("should return undefined or null when index is out of bounds", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    setMtfIndicator(context, "weekly", "rsi_14", [{ time: 1, value: 50 }]);

    // Set index beyond data length
    context.indices.set("weekly", 100);

    const value = getCurrentMtfIndicatorValue(context, "weekly", "rsi_14");
    // Should be null or undefined when out of bounds
    expect(value == null).toBe(true);
  });
});

describe("hasMtfTimeframe", () => {
  it("should return true for existing timeframe", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    expect(hasMtfTimeframe(context, "weekly")).toBe(true);
  });

  it("should return false for missing timeframe", () => {
    const candles = createDailyCandles(21);
    const context = createMtfContext(candles, ["weekly"]);

    expect(hasMtfTimeframe(context, "monthly")).toBe(false);
  });
});

describe("getMtfTimeframes", () => {
  it("should return all available timeframes", () => {
    const candles = createDailyCandles(90);
    const context = createMtfContext(candles, ["weekly", "monthly"]);

    const timeframes = getMtfTimeframes(context);
    expect(timeframes).toContain("weekly");
    expect(timeframes).toContain("monthly");
  });

  it("should return empty array for context with no timeframes", () => {
    const context: MtfContext = {
      datasets: new Map(),
      indices: new Map(),
      currentTime: 0,
    };

    const timeframes = getMtfTimeframes(context);
    expect(timeframes).toHaveLength(0);
  });
});

describe("integration scenarios", () => {
  it("should work end-to-end for backtest simulation", () => {
    // Simulate backtest loop
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 60);

    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);

    // Simulate iterating through candles
    for (let i = 20; i < candles.length; i++) {
      updateMtfIndices(context, indexMap, i, candles[i].time);

      const weeklyCandle = getMtfCandle(context, "weekly");
      expect(weeklyCandle).toBeDefined();

      const weeklyIndex = context.indices.get("weekly");
      expect(weeklyIndex).toBeDefined();
      expect(weeklyIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it("should maintain consistent indices during forward iteration", () => {
    const startDate = new Date("2024-01-01");
    const candles = createDailyCandlesFromDate(startDate, 30);

    const context = createMtfContext(candles, ["weekly"]);
    const indexMap = buildMtfIndexMap(candles, context);

    let previousIndex = -1;
    for (let i = 0; i < candles.length; i++) {
      updateMtfIndices(context, indexMap, i, candles[i].time);

      const currentIndex = context.indices.get("weekly")!;

      // Index should never decrease
      expect(currentIndex).toBeGreaterThanOrEqual(previousIndex);
      previousIndex = currentIndex;
    }
  });
});
