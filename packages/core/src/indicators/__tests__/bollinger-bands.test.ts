import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { bollingerBands } from "../volatility/bollinger-bands";

describe("bollingerBands", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close + 2,
      low: close - 2,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => bollingerBands(candles, { period: 0 })).toThrow();
  });

  it("should throw if stdDev is not positive", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => bollingerBands(candles, { stdDev: 0 })).toThrow();
  });

  it("should return null values for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = bollingerBands(candles, { period: 5 });

    result.forEach((r) => {
      expect(r.value.upper).toBeNull();
      expect(r.value.middle).toBeNull();
      expect(r.value.lower).toBeNull();
    });
  });

  it("should calculate bands correctly", () => {
    const candles = makeCandles([100, 102, 104, 103, 105]);
    const result = bollingerBands(candles, { period: 3, stdDev: 2 });

    // First 2 values should be null
    expect(result[0].value.middle).toBeNull();
    expect(result[1].value.middle).toBeNull();

    // Third value should have bands
    const bb = result[2].value;
    expect(bb.middle).toBe(102); // (100 + 102 + 104) / 3
    expect(bb.upper).toBeGreaterThan(bb.middle!);
    expect(bb.lower).toBeLessThan(bb.middle!);
  });

  it("should calculate %B correctly", () => {
    const candles = makeCandles([100, 100, 100, 110, 90]);
    const result = bollingerBands(candles, { period: 3, stdDev: 2 });

    // When all prices are the same, %B should be around 0.5
    // (since price is at the middle band)
    const bb = result[2].value;
    expect(bb.percentB).toBeCloseTo(0.5, 1);
  });

  it("should calculate bandwidth correctly", () => {
    const candles = makeCandles([100, 100, 100, 100, 100]);
    const result = bollingerBands(candles, { period: 3, stdDev: 2 });

    // When all prices are the same, bandwidth should be 0
    const bb = result[2].value;
    expect(bb.bandwidth).toBe(0);
  });

  it("should use default values (period=20, stdDev=2)", () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);

    const resultDefault = bollingerBands(candles);
    const resultExplicit = bollingerBands(candles, { period: 20, stdDev: 2 });

    expect(resultDefault).toEqual(resultExplicit);
  });

  it("should handle empty array", () => {
    expect(bollingerBands([])).toEqual([]);
  });
});
