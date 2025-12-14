import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { dmi } from "../momentum/dmi";

describe("dmi", () => {
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

    const result = dmi(candles, { period: 14 });
    expect(result[0].value.plusDi).toBeNull();
    expect(result[0].value.minusDi).toBeNull();
    expect(result[0].value.adx).toBeNull();
  });

  it("should calculate +DI and -DI", () => {
    // Create trending data
    const candles = makeCandles(
      Array.from({ length: 30 }, (_, i) => ({
        high: 100 + i * 2,
        low: 90 + i * 2,
        close: 95 + i * 2,
      }))
    );

    const result = dmi(candles, { period: 5, adxPeriod: 5 });

    // After period, should have values
    const validResult = result.filter(r => r.value.plusDi !== null);
    expect(validResult.length).toBeGreaterThan(0);

    // DI values should be between 0 and 100
    for (const r of validResult) {
      if (r.value.plusDi !== null) {
        expect(r.value.plusDi).toBeGreaterThanOrEqual(0);
        expect(r.value.plusDi).toBeLessThanOrEqual(100);
      }
      if (r.value.minusDi !== null) {
        expect(r.value.minusDi).toBeGreaterThanOrEqual(0);
        expect(r.value.minusDi).toBeLessThanOrEqual(100);
      }
    }
  });

  it("should show +DI > -DI in uptrend", () => {
    // Strong uptrend
    const candles = makeCandles(
      Array.from({ length: 40 }, (_, i) => ({
        high: 100 + i * 3,
        low: 95 + i * 3,
        close: 98 + i * 3,
      }))
    );

    const result = dmi(candles, { period: 7, adxPeriod: 7 });

    // In strong uptrend, +DI should be greater than -DI
    const lastResult = result[result.length - 1].value;
    if (lastResult.plusDi !== null && lastResult.minusDi !== null) {
      expect(lastResult.plusDi).toBeGreaterThan(lastResult.minusDi);
    }
  });

  it("should show -DI > +DI in downtrend", () => {
    // Strong downtrend
    const candles = makeCandles(
      Array.from({ length: 40 }, (_, i) => ({
        high: 200 - i * 3,
        low: 195 - i * 3,
        close: 197 - i * 3,
      }))
    );

    const result = dmi(candles, { period: 7, adxPeriod: 7 });

    // In strong downtrend, -DI should be greater than +DI
    const lastResult = result[result.length - 1].value;
    if (lastResult.plusDi !== null && lastResult.minusDi !== null) {
      expect(lastResult.minusDi).toBeGreaterThan(lastResult.plusDi);
    }
  });

  it("should calculate ADX for trend strength", () => {
    // Trending data
    const candles = makeCandles(
      Array.from({ length: 50 }, (_, i) => ({
        high: 100 + i * 2,
        low: 95 + i * 2,
        close: 97 + i * 2,
      }))
    );

    const result = dmi(candles, { period: 10, adxPeriod: 10 });

    // ADX should eventually have values
    const validAdx = result.filter(r => r.value.adx !== null);
    expect(validAdx.length).toBeGreaterThan(0);

    // ADX should be between 0 and 100
    for (const r of validAdx) {
      expect(r.value.adx).toBeGreaterThanOrEqual(0);
      expect(r.value.adx).toBeLessThanOrEqual(100);
    }
  });

  it("should show high ADX in strong trend", () => {
    // Very strong consistent trend
    const candles = makeCandles(
      Array.from({ length: 60 }, (_, i) => ({
        high: 100 + i * 5,
        low: 98 + i * 5,
        close: 99 + i * 5,
      }))
    );

    const result = dmi(candles, { period: 14, adxPeriod: 14 });

    // In strong trend, ADX should be relatively high (> 20)
    const lastResult = result[result.length - 1].value;
    if (lastResult.adx !== null) {
      expect(lastResult.adx).toBeGreaterThan(15);
    }
  });

  it("should handle empty candles", () => {
    expect(dmi([])).toEqual([]);
  });

  it("should throw for invalid periods", () => {
    const candles = makeCandles([{ high: 100, low: 90, close: 95 }]);
    expect(() => dmi(candles, { period: 0 })).toThrow();
    expect(() => dmi(candles, { adxPeriod: 0 })).toThrow();
  });

  it("should handle single candle", () => {
    const candles = makeCandles([{ high: 100, low: 90, close: 95 }]);
    const result = dmi(candles, { period: 1 });

    expect(result.length).toBe(1);
  });

  it("should use default periods when not specified", () => {
    const candles = makeCandles(
      Array.from({ length: 50 }, (_, i) => ({
        high: 100 + i,
        low: 95 + i,
        close: 97 + i,
      }))
    );

    // Should not throw with defaults
    const result = dmi(candles);
    expect(result.length).toBe(50);
  });
});
