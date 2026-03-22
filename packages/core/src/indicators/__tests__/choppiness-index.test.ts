import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { choppinessIndex } from "../volatility/choppiness-index";

describe("choppinessIndex", () => {
  const makeCandles = (
    data: Array<{ high: number; low: number; close: number }>,
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should throw if period is less than 2", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100 }]);
    expect(() => choppinessIndex(candles, { period: 0 })).toThrow(
      "Choppiness Index period must be at least 2",
    );
    expect(() => choppinessIndex(candles, { period: 1 })).toThrow(
      "Choppiness Index period must be at least 2",
    );
  });

  it("should return empty for empty input", () => {
    expect(choppinessIndex([])).toEqual([]);
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 115, low: 95, close: 105 },
    ]);
    const result = choppinessIndex(candles, { period: 14 });
    expect(result).toHaveLength(2);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should return values between 0 and 100", () => {
    // Create a mix of trending and choppy data
    const data: Array<{ high: number; low: number; close: number }> = [];
    for (let i = 0; i < 30; i++) {
      const base = 100 + Math.sin(i * 0.5) * 10;
      data.push({
        high: base + 5,
        low: base - 5,
        close: base,
      });
    }
    const candles = makeCandles(data);
    const result = choppinessIndex(candles, { period: 14 });

    const nonNullValues = result.filter((r) => r.value !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);
    nonNullValues.forEach((r) => {
      expect(r.value!).toBeGreaterThanOrEqual(0);
      expect(r.value!).toBeLessThanOrEqual(100);
    });
  });

  it("should show higher values for choppy (range-bound) markets", () => {
    // Choppy: oscillating within a tight range
    const choppyData: Array<{ high: number; low: number; close: number }> = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + (i % 2 === 0 ? 2 : -2);
      choppyData.push({ high: base + 3, low: base - 3, close: base });
    }

    // Trending: strong uptrend
    const trendingData: Array<{ high: number; low: number; close: number }> = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + i * 3;
      trendingData.push({ high: base + 2, low: base - 2, close: base });
    }

    const choppyResult = choppinessIndex(makeCandles(choppyData), { period: 7 });
    const trendingResult = choppinessIndex(makeCandles(trendingData), { period: 7 });

    // Get last non-null values
    const lastChoppy = [...choppyResult].reverse().find((r) => r.value !== null);
    const lastTrending = [...trendingResult].reverse().find((r) => r.value !== null);

    expect(lastChoppy).toBeDefined();
    expect(lastTrending).toBeDefined();
    // Choppy market should have higher choppiness index
    expect(lastChoppy!.value!).toBeGreaterThan(lastTrending!.value!);
  });

  it("should use default period of 14", () => {
    const data: Array<{ high: number; low: number; close: number }> = [];
    for (let i = 0; i < 20; i++) {
      data.push({ high: 110 + i, low: 90 + i, close: 100 + i });
    }
    const result = choppinessIndex(makeCandles(data));

    // First 14 values should be null (period = 14, need previous close for TR)
    for (let i = 0; i < 14; i++) {
      expect(result[i].value).toBeNull();
    }
    expect(result[14].value).not.toBeNull();
  });
});
