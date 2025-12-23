import { describe, it, expect } from "vitest";
import { cmf } from "../cmf";
import type { NormalizedCandle } from "../../../types";

describe("cmf", () => {
  // Sample data for testing
  const sampleCandles: NormalizedCandle[] = [
    { time: 1, open: 100, high: 105, low: 95, close: 103, volume: 1000 },
    { time: 2, open: 103, high: 108, low: 100, close: 106, volume: 1200 },
    { time: 3, open: 106, high: 110, low: 104, close: 108, volume: 1100 },
    { time: 4, open: 108, high: 112, low: 106, close: 110, volume: 1300 },
    { time: 5, open: 110, high: 115, low: 108, close: 113, volume: 1400 },
    { time: 6, open: 113, high: 118, low: 111, close: 116, volume: 1500 },
    { time: 7, open: 116, high: 120, low: 114, close: 118, volume: 1600 },
    { time: 8, open: 118, high: 122, low: 116, close: 120, volume: 1700 },
    { time: 9, open: 120, high: 124, low: 118, close: 122, volume: 1800 },
    { time: 10, open: 122, high: 126, low: 120, close: 124, volume: 1900 },
  ];

  it("should return empty array for empty input", () => {
    const result = cmf([]);
    expect(result).toEqual([]);
  });

  it("should return null for first period-1 candles", () => {
    const result = cmf(sampleCandles, { period: 5 });

    // First 4 values should be null (period - 1)
    for (let i = 0; i < 4; i++) {
      expect(result[i].value).toBeNull();
    }
    // 5th value should be calculated
    expect(result[4].value).not.toBeNull();
  });

  it("should calculate CMF values", () => {
    const result = cmf(sampleCandles, { period: 5 });

    // After enough data, CMF should be calculated
    const lastValue = result[result.length - 1].value;
    expect(lastValue).not.toBeNull();
    expect(typeof lastValue).toBe("number");
  });

  it("should return values between -1 and 1", () => {
    const result = cmf(sampleCandles, { period: 5 });

    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeGreaterThanOrEqual(-1);
        expect(r.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("should be positive for strong closes near high", () => {
    // Create data where close is always near the high
    const bullishCandles: NormalizedCandle[] = Array.from({ length: 10 }, (_, i) => ({
      time: i + 1,
      open: 100,
      high: 110,
      low: 95,
      close: 109, // Close near high
      volume: 1000,
    }));

    const result = cmf(bullishCandles, { period: 5 });

    // CMF should be positive when closes are near highs
    const lastValue = result[result.length - 1].value;
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThan(0);
  });

  it("should be negative for strong closes near low", () => {
    // Create data where close is always near the low
    const bearishCandles: NormalizedCandle[] = Array.from({ length: 10 }, (_, i) => ({
      time: i + 1,
      open: 100,
      high: 110,
      low: 95,
      close: 96, // Close near low
      volume: 1000,
    }));

    const result = cmf(bearishCandles, { period: 5 });

    // CMF should be negative when closes are near lows
    const lastValue = result[result.length - 1].value;
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeLessThan(0);
  });

  it("should throw error for invalid period", () => {
    expect(() => cmf(sampleCandles, { period: 0 })).toThrow("CMF period must be at least 1");
    expect(() => cmf(sampleCandles, { period: -5 })).toThrow("CMF period must be at least 1");
  });

  it("should use default period of 20", () => {
    const defaultResult = cmf(sampleCandles);
    const explicitResult = cmf(sampleCandles, { period: 20 });

    // With only 10 candles and period 20, all values should be null
    for (const r of defaultResult) {
      expect(r.value).toBeNull();
    }
    for (const r of explicitResult) {
      expect(r.value).toBeNull();
    }
  });

  it("should have correct length", () => {
    const result = cmf(sampleCandles, { period: 5 });
    expect(result.length).toBe(sampleCandles.length);
  });

  it("should preserve timestamps", () => {
    const result = cmf(sampleCandles, { period: 5 });
    for (let i = 0; i < result.length; i++) {
      expect(result[i].time).toBe(sampleCandles[i].time);
    }
  });

  it("should handle case where high equals low", () => {
    const flatCandles: NormalizedCandle[] = [
      { time: 1, open: 100, high: 100, low: 100, close: 100, volume: 1000 },
      { time: 2, open: 100, high: 100, low: 100, close: 100, volume: 1000 },
      { time: 3, open: 100, high: 100, low: 100, close: 100, volume: 1000 },
    ];

    const result = cmf(flatCandles, { period: 2 });

    // Should handle division by zero gracefully
    expect(result[2].value).toBe(0);
  });

  it("should handle zero volume", () => {
    const zeroVolumeCandles: NormalizedCandle[] = Array.from({ length: 5 }, (_, i) => ({
      time: i + 1,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 0,
    }));

    const result = cmf(zeroVolumeCandles, { period: 3 });

    // Should handle division by zero gracefully
    expect(result[2].value).toBe(0);
  });

  it("should be close to 1 when close equals high", () => {
    const closeAtHighCandles: NormalizedCandle[] = Array.from({ length: 5 }, (_, i) => ({
      time: i + 1,
      open: 100,
      high: 110,
      low: 90,
      close: 110, // Close = High
      volume: 1000,
    }));

    const result = cmf(closeAtHighCandles, { period: 3 });

    // Money Flow Multiplier = ((110-90) - (110-110)) / (110-90) = 20/20 = 1
    expect(result[2].value).toBeCloseTo(1, 5);
  });

  it("should be close to -1 when close equals low", () => {
    const closeAtLowCandles: NormalizedCandle[] = Array.from({ length: 5 }, (_, i) => ({
      time: i + 1,
      open: 100,
      high: 110,
      low: 90,
      close: 90, // Close = Low
      volume: 1000,
    }));

    const result = cmf(closeAtLowCandles, { period: 3 });

    // Money Flow Multiplier = ((90-90) - (110-90)) / (110-90) = -20/20 = -1
    expect(result[2].value).toBeCloseTo(-1, 5);
  });
});
