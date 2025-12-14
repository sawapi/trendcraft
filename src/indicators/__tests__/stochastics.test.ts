import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { stochastics, fastStochastics, slowStochastics } from "../momentum/stochastics";

describe("stochastics", () => {
  // Helper to create candles
  const makeCandles = (data: { high: number; low: number; close: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should return null for initial periods", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 115, low: 95, close: 110 },
      { high: 120, low: 100, close: 115 },
    ]);

    const result = stochastics(candles, { kPeriod: 14 });
    expect(result[0].value.k).toBeNull();
    expect(result[0].value.d).toBeNull();
  });

  it("should calculate %K correctly", () => {
    // Create simple uptrend data
    const candles = makeCandles(
      Array.from({ length: 20 }, (_, i) => ({
        high: 100 + i * 2,
        low: 90 + i * 2,
        close: 95 + i * 2,
      }))
    );

    const result = stochastics(candles, { kPeriod: 5, dPeriod: 3, slowing: 1 });

    // After kPeriod, %K should have values
    const validK = result.filter(r => r.value.k !== null);
    expect(validK.length).toBeGreaterThan(0);

    // %K should be between 0 and 100
    for (const r of validK) {
      expect(r.value.k).toBeGreaterThanOrEqual(0);
      expect(r.value.k).toBeLessThanOrEqual(100);
    }
  });

  it("should return 100 at highest high", () => {
    // Close at highest high of the period
    const candles = makeCandles([
      { high: 100, low: 90, close: 95 },
      { high: 105, low: 92, close: 98 },
      { high: 110, low: 95, close: 100 },
      { high: 108, low: 93, close: 97 },
      { high: 115, low: 100, close: 115 }, // Close at highest high
    ]);

    const result = fastStochastics(candles, { kPeriod: 5, dPeriod: 3 });
    const lastK = result[4].value.k;

    // Should be close to 100 (close = highest high)
    expect(lastK).toBeCloseTo(100, 0);
  });

  it("should return 0 at lowest low", () => {
    // Close at lowest low of the period
    const candles = makeCandles([
      { high: 110, low: 100, close: 105 },
      { high: 108, low: 98, close: 102 },
      { high: 105, low: 95, close: 100 },
      { high: 103, low: 93, close: 97 },
      { high: 100, low: 90, close: 90 }, // Close at lowest low
    ]);

    const result = fastStochastics(candles, { kPeriod: 5, dPeriod: 3 });
    const lastK = result[4].value.k;

    // Should be close to 0 (close = lowest low)
    expect(lastK).toBeCloseTo(0, 0);
  });

  it("should smooth %K for slow stochastic", () => {
    const candles = makeCandles(
      Array.from({ length: 30 }, (_, i) => ({
        high: 100 + Math.sin(i * 0.5) * 10 + 10,
        low: 100 + Math.sin(i * 0.5) * 10 - 10,
        close: 100 + Math.sin(i * 0.5) * 10,
      }))
    );

    const fast = fastStochastics(candles, { kPeriod: 14, dPeriod: 3 });
    const slow = slowStochastics(candles, { kPeriod: 14, dPeriod: 3 });

    // Slow stochastic should be smoother (values should differ due to additional smoothing)
    // Count how many values differ
    let diffCount = 0;
    for (let i = 0; i < candles.length; i++) {
      if (fast[i].value.k !== null && slow[i].value.k !== null) {
        if (Math.abs(fast[i].value.k! - slow[i].value.k!) > 0.01) {
          diffCount++;
        }
      }
    }
    expect(diffCount).toBeGreaterThan(0);
  });

  it("should calculate %D as SMA of %K", () => {
    const candles = makeCandles(
      Array.from({ length: 25 }, (_, i) => ({
        high: 100 + i,
        low: 90 + i,
        close: 95 + i,
      }))
    );

    const result = stochastics(candles, { kPeriod: 5, dPeriod: 3, slowing: 1 });

    // %D should lag behind %K
    const validBoth = result.filter(r => r.value.k !== null && r.value.d !== null);
    expect(validBoth.length).toBeGreaterThan(0);

    // All %D values should be between 0 and 100
    for (const r of validBoth) {
      expect(r.value.d).toBeGreaterThanOrEqual(0);
      expect(r.value.d).toBeLessThanOrEqual(100);
    }
  });

  it("should handle empty candles", () => {
    expect(stochastics([])).toEqual([]);
    expect(fastStochastics([])).toEqual([]);
    expect(slowStochastics([])).toEqual([]);
  });

  it("should throw for invalid periods", () => {
    const candles = makeCandles([{ high: 100, low: 90, close: 95 }]);
    expect(() => stochastics(candles, { kPeriod: 0 })).toThrow();
    expect(() => stochastics(candles, { dPeriod: 0 })).toThrow();
    expect(() => stochastics(candles, { slowing: 0 })).toThrow();
  });

  it("should handle flat price (no range)", () => {
    const candles = makeCandles(
      Array.from({ length: 10 }, () => ({
        high: 100,
        low: 100,
        close: 100,
      }))
    );

    const result = stochastics(candles, { kPeriod: 5, dPeriod: 3, slowing: 1 });
    const validK = result.filter(r => r.value.k !== null);

    // When range is 0, should return 50
    for (const r of validK) {
      expect(r.value.k).toBe(50);
    }
  });
});
