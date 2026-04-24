import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { stochRsi } from "../momentum/stoch-rsi";

describe("stochRsi", () => {
  // Helper to create candles
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close + 5,
      low: close - 5,
      close,
      volume: 1000,
    }));

  it("should return null for initial periods", () => {
    const candles = makeCandles([100, 102, 104, 103, 105]);

    const result = stochRsi(candles, { rsiPeriod: 14, stochPeriod: 14 });
    expect(result[0].value.stochRsi).toBeNull();
    expect(result[0].value.k).toBeNull();
    expect(result[0].value.d).toBeNull();
  });

  it("should calculate StochRSI values between 0 and 100", () => {
    // Create oscillating data to generate varied RSI values
    const closes: number[] = [];
    for (let i = 0; i < 50; i++) {
      closes.push(100 + Math.sin(i * 0.5) * 10);
    }
    const candles = makeCandles(closes);

    const result = stochRsi(candles, { rsiPeriod: 7, stochPeriod: 7, kPeriod: 3, dPeriod: 3 });

    // Check valid values are in range
    const validResults = result.filter((r) => r.value.stochRsi !== null);
    expect(validResults.length).toBeGreaterThan(0);

    for (const r of validResults) {
      if (r.value.stochRsi !== null) {
        expect(r.value.stochRsi).toBeGreaterThanOrEqual(0);
        expect(r.value.stochRsi).toBeLessThanOrEqual(100);
      }
      if (r.value.k !== null) {
        expect(r.value.k).toBeGreaterThanOrEqual(0);
        expect(r.value.k).toBeLessThanOrEqual(100);
      }
      if (r.value.d !== null) {
        expect(r.value.d).toBeGreaterThanOrEqual(0);
        expect(r.value.d).toBeLessThanOrEqual(100);
      }
    }
  });

  it("should produce varied values with oscillating data", () => {
    // Create oscillating data that produces varying RSI values
    const closes: number[] = [];
    for (let i = 0; i < 60; i++) {
      // Oscillating pattern with varying amplitude
      closes.push(100 + Math.sin(i * 0.4) * 15 + (i % 3 === 0 ? 5 : -2));
    }
    const candles = makeCandles(closes);

    const result = stochRsi(candles, { rsiPeriod: 7, stochPeriod: 7, kPeriod: 3, dPeriod: 3 });

    // Should have both high and low StochRSI values (not all 50)
    const validResults = result.filter((r) => r.value.stochRsi !== null);
    const values = validResults.map((r) => r.value.stochRsi!);
    const hasVariedValues = values.some((v) => v > 60) || values.some((v) => v < 40);

    expect(hasVariedValues).toBe(true);
  });

  it("should produce 50 when RSI is constant (no range)", () => {
    // Strong consistent trend causes constant RSI, which gives stochRSI of 50
    const candles = makeCandles(Array.from({ length: 50 }, (_, i) => 100 + i * 3));

    const result = stochRsi(candles, { rsiPeriod: 5, stochPeriod: 5, kPeriod: 1, dPeriod: 1 });

    // When RSI is constant (no range), stochRSI returns 50
    const lastValid = result.filter((r) => r.value.stochRsi !== null).slice(-5);
    const avgValue = lastValid.reduce((sum, r) => sum + r.value.stochRsi!, 0) / lastValid.length;
    expect(avgValue).toBe(50);
  });

  it("should return 50 when RSI has no range", () => {
    // Flat market with no price change
    const candles = makeCandles(Array.from({ length: 30 }, () => 100));

    const result = stochRsi(candles, { rsiPeriod: 5, stochPeriod: 5, kPeriod: 1, dPeriod: 1 });

    // When RSI range is 0, should return 50
    const validResults = result.filter((r) => r.value.stochRsi !== null);
    for (const r of validResults) {
      expect(r.value.stochRsi).toBe(50);
    }
  });

  it("should have %K as smoothed StochRSI", () => {
    const closes: number[] = [];
    for (let i = 0; i < 50; i++) {
      closes.push(100 + Math.sin(i * 0.3) * 15);
    }
    const candles = makeCandles(closes);

    const result = stochRsi(candles, { rsiPeriod: 7, stochPeriod: 7, kPeriod: 3, dPeriod: 3 });

    // %K should appear after stochRsi + kPeriod - 1 valid values
    const firstK = result.findIndex((r) => r.value.k !== null);
    const firstStochRsi = result.findIndex((r) => r.value.stochRsi !== null);

    // %K should appear after stochRsi (it's a smoothed version)
    expect(firstK).toBeGreaterThanOrEqual(firstStochRsi);
  });

  it("should have %D as smoothed %K", () => {
    const closes: number[] = [];
    for (let i = 0; i < 50; i++) {
      closes.push(100 + Math.sin(i * 0.3) * 15);
    }
    const candles = makeCandles(closes);

    const result = stochRsi(candles, { rsiPeriod: 7, stochPeriod: 7, kPeriod: 3, dPeriod: 3 });

    // %D should appear after %K
    const firstD = result.findIndex((r) => r.value.d !== null);
    const firstK = result.findIndex((r) => r.value.k !== null);

    expect(firstD).toBeGreaterThanOrEqual(firstK);
  });

  it("should handle empty candles", () => {
    expect(stochRsi([])).toEqual([]);
  });

  it("should throw for invalid periods", () => {
    const candles = makeCandles([100, 102, 104]);
    expect(() => stochRsi(candles, { rsiPeriod: 0 })).toThrow();
    expect(() => stochRsi(candles, { stochPeriod: 0 })).toThrow();
    expect(() => stochRsi(candles, { kPeriod: 0 })).toThrow();
    expect(() => stochRsi(candles, { dPeriod: 0 })).toThrow();
  });

  it("should use default periods when not specified", () => {
    const candles = makeCandles(Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 10));

    // Should not throw with defaults
    const result = stochRsi(candles);
    expect(result.length).toBe(50);
  });

  it("should preserve time from candles", () => {
    const candles = makeCandles([100, 102, 104, 106, 108]);

    const result = stochRsi(candles);
    expect(result[0].time).toBe(candles[0].time);
    expect(result[4].time).toBe(candles[4].time);
  });

  it("should accept a price source and pass it through to the underlying RSI", () => {
    // Wicks that vary per bar, so hlc3 != close + constant offset.
    // This ensures the first-differences (which drive RSI) actually differ.
    const base: NormalizedCandle[] = [];
    for (let i = 0; i < 60; i++) {
      const close = 100 + Math.sin(i * 0.4) * 10;
      const upperWick = 1 + Math.abs(Math.cos(i * 0.7)) * 4;
      const lowerWick = 0.5 + Math.abs(Math.sin(i * 0.9)) * 2;
      base.push({
        time: 1700000000000 + i * 86400000,
        open: close - 0.5,
        high: close + upperWick,
        low: close - lowerWick,
        close,
        volume: 1000,
      });
    }
    const defaulted = stochRsi(base, { rsiPeriod: 14, stochPeriod: 14 });
    const explicitClose = stochRsi(base, {
      rsiPeriod: 14,
      stochPeriod: 14,
      source: "close",
    });
    const viaHlc3 = stochRsi(base, { rsiPeriod: 14, stochPeriod: 14, source: "hlc3" });

    // Default === close
    for (let i = 0; i < defaulted.length; i++) {
      expect(defaulted[i].value.stochRsi).toEqual(explicitClose[i].value.stochRsi);
    }

    // hlc3 must differ at least once
    const diverged = defaulted.some((r, i) => {
      const a = r.value.stochRsi;
      const b = viaHlc3[i].value.stochRsi;
      return a !== null && b !== null && Math.abs(a - b) > 1e-6;
    });
    expect(diverged).toBe(true);
  });
});
