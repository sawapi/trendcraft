import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { mfi } from "../volume/mfi";

describe("mfi", () => {
  // Helper to create candles
  const makeCandles = (
    data: { high: number; low: number; close: number; volume: number }[],
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));

  it("should return null for initial periods", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100, volume: 1000 },
      { high: 115, low: 95, close: 110, volume: 1200 },
      { high: 120, low: 100, close: 115, volume: 1100 },
    ]);

    const result = mfi(candles, { period: 14 });
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeNull();
  });

  it("should calculate MFI after enough periods", () => {
    // Create trending data
    const candles = makeCandles(
      Array.from({ length: 20 }, (_, i) => ({
        high: 100 + i * 2 + 5,
        low: 100 + i * 2 - 5,
        close: 100 + i * 2,
        volume: 1000 + i * 100,
      })),
    );

    const result = mfi(candles, { period: 5 });

    // After period, should have values
    const validResult = result.filter((r) => r.value !== null);
    expect(validResult.length).toBeGreaterThan(0);

    // MFI should be between 0 and 100
    for (const r of validResult) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    }
  });

  it("should return 100 when all money flow is positive", () => {
    // Continuous uptrend
    const candles = makeCandles(
      Array.from({ length: 10 }, (_, i) => ({
        high: 100 + i * 10 + 5,
        low: 100 + i * 10 - 5,
        close: 100 + i * 10, // Typical price always increasing
        volume: 1000,
      })),
    );

    const result = mfi(candles, { period: 5 });

    // Last values should be 100 (all positive flow)
    const lastValue = result[result.length - 1].value;
    expect(lastValue).toBe(100);
  });

  it("should return 0 when all money flow is negative", () => {
    // Continuous downtrend
    const candles = makeCandles(
      Array.from({ length: 10 }, (_, i) => ({
        high: 200 - i * 10 + 5,
        low: 200 - i * 10 - 5,
        close: 200 - i * 10, // Typical price always decreasing
        volume: 1000,
      })),
    );

    const result = mfi(candles, { period: 5 });

    // Last values should be 0 (all negative flow)
    const lastValue = result[result.length - 1].value;
    expect(lastValue).toBe(0);
  });

  it("should be around 50 when positive and negative flow are equal", () => {
    // Alternating up/down with equal volume
    const candles = makeCandles([
      { high: 105, low: 95, close: 100, volume: 1000 },
      { high: 115, low: 105, close: 110, volume: 1000 }, // Up
      { high: 105, low: 95, close: 100, volume: 1000 }, // Down
      { high: 115, low: 105, close: 110, volume: 1000 }, // Up
      { high: 105, low: 95, close: 100, volume: 1000 }, // Down
      { high: 115, low: 105, close: 110, volume: 1000 }, // Up
    ]);

    const result = mfi(candles, { period: 5 });
    const lastValue = result[result.length - 1].value;

    // Should be in a moderate range (not extreme 0 or 100)
    expect(lastValue).toBeGreaterThan(30);
    expect(lastValue).toBeLessThan(70);
  });

  it("should handle empty candles", () => {
    expect(mfi([])).toEqual([]);
  });

  it("should throw for invalid period", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100, volume: 1000 }]);
    expect(() => mfi(candles, { period: 0 })).toThrow();
  });

  it("should use default period of 14", () => {
    const candles = makeCandles(
      Array.from({ length: 20 }, (_, i) => ({
        high: 100 + i + 5,
        low: 100 + i - 5,
        close: 100 + i,
        volume: 1000,
      })),
    );

    const result = mfi(candles);

    // First 14 values should be null (need period + 1 for comparison)
    expect(result[13].value).toBeNull();
    expect(result[14].value).not.toBeNull();
  });
});
