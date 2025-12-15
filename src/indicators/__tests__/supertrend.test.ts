import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { supertrend } from "../trend/supertrend";

describe("supertrend", () => {
  // Helper to create candles with OHLC data
  const makeCandles = (data: Array<{ high: number; low: number; close: number }>): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100 }]);
    expect(() => supertrend(candles, { period: 0 })).toThrow("Supertrend period must be at least 1");
  });

  it("should throw if multiplier is not positive", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100 }]);
    expect(() => supertrend(candles, { multiplier: 0 })).toThrow("Supertrend multiplier must be positive");
    expect(() => supertrend(candles, { multiplier: -1 })).toThrow("Supertrend multiplier must be positive");
  });

  it("should return null for insufficient data (ATR warmup period)", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = supertrend(candles, { period: 5 });
    expect(result[0].value.supertrend).toBeNull();
    expect(result[0].value.direction).toBe(0);
    expect(result[1].value.supertrend).toBeNull();
  });

  it("should calculate supertrend with upper and lower bands", () => {
    // Create enough data for ATR calculation
    const data = Array.from({ length: 15 }, (_, i) => ({
      high: 100 + i * 2,
      low: 90 + i * 2,
      close: 95 + i * 2,
    }));
    const candles = makeCandles(data);

    const result = supertrend(candles, { period: 10 });

    // After ATR warmup, we should have valid bands
    const lastResult = result[result.length - 1].value;
    expect(lastResult.supertrend).not.toBeNull();
    expect(lastResult.upperBand).not.toBeNull();
    expect(lastResult.lowerBand).not.toBeNull();
    expect(lastResult.direction).not.toBe(0);
  });

  it("should identify bullish trend (direction = 1)", () => {
    // Create uptrending data
    const data = Array.from({ length: 20 }, (_, i) => ({
      high: 100 + i * 5,
      low: 90 + i * 5,
      close: 98 + i * 5,
    }));
    const candles = makeCandles(data);

    const result = supertrend(candles, { period: 10, multiplier: 2 });

    // In an uptrend, direction should be 1
    const lastResult = result[result.length - 1].value;
    expect(lastResult.direction).toBe(1);
  });

  it("should identify bearish trend (direction = -1)", () => {
    // Create downtrending data
    const data = Array.from({ length: 20 }, (_, i) => ({
      high: 200 - i * 5,
      low: 190 - i * 5,
      close: 192 - i * 5,
    }));
    const candles = makeCandles(data);

    const result = supertrend(candles, { period: 10, multiplier: 2 });

    // In a downtrend, direction should be -1
    const lastResult = result[result.length - 1].value;
    expect(lastResult.direction).toBe(-1);
  });

  it("should use lower band as support in bullish trend", () => {
    // Create uptrending data
    const data = Array.from({ length: 20 }, (_, i) => ({
      high: 100 + i * 3,
      low: 90 + i * 3,
      close: 98 + i * 3,
    }));
    const candles = makeCandles(data);

    const result = supertrend(candles, { period: 10, multiplier: 2 });

    // Find a bullish period
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].value.direction === 1) {
        // In bullish trend, supertrend = lower band
        expect(result[i].value.supertrend).toBe(result[i].value.lowerBand);
        break;
      }
    }
  });

  it("should use upper band as resistance in bearish trend", () => {
    // Create downtrending data
    const data = Array.from({ length: 20 }, (_, i) => ({
      high: 200 - i * 3,
      low: 190 - i * 3,
      close: 192 - i * 3,
    }));
    const candles = makeCandles(data);

    const result = supertrend(candles, { period: 10, multiplier: 2 });

    // Find a bearish period
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].value.direction === -1) {
        // In bearish trend, supertrend = upper band
        expect(result[i].value.supertrend).toBe(result[i].value.upperBand);
        break;
      }
    }
  });

  it("should detect trend direction based on price vs bands", () => {
    // Create data for ATR warmup period
    const data = Array.from({ length: 15 }, (_, i) => ({
      high: 100 + i * 2,
      low: 90 + i * 2,
      close: 95 + i * 2,
    }));
    const candles = makeCandles(data);

    const result = supertrend(candles, { period: 10, multiplier: 2 });

    // After warmup, direction should be determined
    const validResults = result.filter(r => r.value.direction !== 0);
    expect(validResults.length).toBeGreaterThan(0);

    // Each valid result should have consistent direction with its supertrend value
    for (const r of validResults) {
      if (r.value.direction === 1) {
        // Bullish: supertrend = lower band
        expect(r.value.supertrend).toBe(r.value.lowerBand);
      } else if (r.value.direction === -1) {
        // Bearish: supertrend = upper band
        expect(r.value.supertrend).toBe(r.value.upperBand);
      }
    }
  });

  it("should handle empty array", () => {
    expect(supertrend([])).toEqual([]);
  });

  it("should preserve time values in result", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = supertrend(candles);
    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
  });

  it("should respect multiplier parameter", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      high: 100 + i,
      low: 90 + i,
      close: 95 + i,
    }));
    const candles = makeCandles(data);

    const resultSmallMult = supertrend(candles, { period: 10, multiplier: 1 });
    const resultLargeMult = supertrend(candles, { period: 10, multiplier: 5 });

    // With larger multiplier, bands should be further apart
    const lastSmall = resultSmallMult[resultSmallMult.length - 1].value;
    const lastLarge = resultLargeMult[resultLargeMult.length - 1].value;

    if (lastSmall.upperBand && lastSmall.lowerBand && lastLarge.upperBand && lastLarge.lowerBand) {
      const rangeSmall = lastSmall.upperBand - lastSmall.lowerBand;
      const rangeLarge = lastLarge.upperBand - lastLarge.lowerBand;
      expect(rangeLarge).toBeGreaterThan(rangeSmall);
    }
  });
});
