import { describe, expect, it } from "vitest";
import { massIndex } from "../../indicators";
import type { NormalizedCandle } from "../../types";

function makeCandles(
  data: { high: number; low: number }[],
  time0 = 1000,
  step = 86400,
): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: time0 + i * step,
    open: (d.high + d.low) / 2,
    high: d.high,
    low: d.low,
    close: (d.high + d.low) / 2,
    volume: 1000,
  }));
}

function makeSimpleCandles(closes: number[], time0 = 1000, step = 86400) {
  return closes.map((c, i) => ({
    time: time0 + i * step,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000,
  }));
}

describe("massIndex", () => {
  it("should return empty array for empty input", () => {
    expect(massIndex([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    expect(() => massIndex(candles, { emaPeriod: 0 })).toThrow(
      "Mass Index periods must be at least 1",
    );
    expect(() => massIndex(candles, { sumPeriod: 0 })).toThrow(
      "Mass Index periods must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeSimpleCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = massIndex(candles, { emaPeriod: 3, sumPeriod: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have null values during warmup", () => {
    const candles = makeSimpleCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = massIndex(candles, { emaPeriod: 3, sumPeriod: 5 });
    // singleEMA starts at index 2, doubleEMA starts at index 4
    // Then need sumPeriod=5 valid ratios, so first valid at index 8
    const firstNonNull = result.findIndex((r) => r.value !== null);
    expect(firstNonNull).toBeGreaterThan(0);
    // All before should be null
    for (let i = 0; i < firstNonNull; i++) {
      expect(result[i].value).toBeNull();
    }
  });

  it("should work with default options (emaPeriod=9, sumPeriod=25)", () => {
    const candles = makeSimpleCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = massIndex(candles);
    expect(result).toHaveLength(60);
    // Should eventually produce non-null values
    const nonNullValues = result.filter((r) => r.value !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);
  });

  it("should produce values around sumPeriod for stable range", () => {
    // When range is constant, single/double EMA ratio approaches 1,
    // so mass index approaches sumPeriod
    const data = Array.from({ length: 60 }, (_, i) => ({
      high: 102,
      low: 98,
    }));
    const candles = makeCandles(data);
    const result = massIndex(candles, { emaPeriod: 3, sumPeriod: 5 });
    const lastVal = result[result.length - 1].value;
    expect(lastVal).not.toBeNull();
    // Should be close to 5 (sumPeriod * 1)
    expect(lastVal!).toBeCloseTo(5, 0);
  });

  it("should preserve time values", () => {
    const candles = makeSimpleCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = massIndex(candles, { emaPeriod: 2, sumPeriod: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
