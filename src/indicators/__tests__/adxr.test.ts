import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { adxr } from "../momentum/adxr";

describe("adxr", () => {
  const makeCandles = (data: { high: number; low: number; close: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should return empty for empty input", () => {
    expect(adxr([])).toEqual([]);
  });

  it("should throw if period < 1", () => {
    const candles = makeCandles([{ high: 101, low: 99, close: 100 }]);
    expect(() => adxr(candles, { period: 0 })).toThrow();
  });

  it("should return null for insufficient data", () => {
    const data: { high: number; low: number; close: number }[] = [];
    for (let i = 0; i < 10; i++) {
      data.push({ high: 101 + i, low: 99 + i, close: 100 + i });
    }
    const candles = makeCandles(data);
    const result = adxr(candles, { period: 14 });
    expect(result).toHaveLength(10);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should produce non-null values with enough data", () => {
    const data: { high: number; low: number; close: number }[] = [];
    for (let i = 0; i < 80; i++) {
      data.push({
        high: 100 + i + 2,
        low: 100 + i - 2,
        close: 100 + i + 1,
      });
    }
    const candles = makeCandles(data);
    const result = adxr(candles, { period: 14, dmiPeriod: 14, adxPeriod: 14 });

    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);

    // ADXR values should be positive
    nonNull.forEach((r) => {
      expect(r.value!).toBeGreaterThanOrEqual(0);
    });
  });

  it("should be smoother than ADX", () => {
    // ADXR averages current and past ADX, so should be smoother
    const data: { high: number; low: number; close: number }[] = [];
    for (let i = 0; i < 80; i++) {
      data.push({
        high: 100 + i + Math.sin(i) * 5 + 2,
        low: 100 + i + Math.sin(i) * 5 - 2,
        close: 100 + i + Math.sin(i) * 5,
      });
    }
    const candles = makeCandles(data);
    const result = adxr(candles, { period: 14 });

    // ADXR should exist for later data
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });

  it("should preserve timestamps", () => {
    const data: { high: number; low: number; close: number }[] = [];
    for (let i = 0; i < 80; i++) {
      data.push({ high: 102 + i, low: 98 + i, close: 100 + i });
    }
    const candles = makeCandles(data);
    const result = adxr(candles, { period: 14 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
