import { describe, expect, it } from "vitest";
import { ultimateOscillator } from "../../indicators";
import type { NormalizedCandle } from "../../types";

function makeCandles(
  data: { high: number; low: number; close: number }[],
  time0 = 1000,
  step = 86400,
): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: time0 + i * step,
    open: d.close - 0.5,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: 1000 + i * 100,
  }));
}

function makeSimpleCandles(closes: number[], time0 = 1000, step = 86400) {
  return closes.map((c, i) => ({
    time: time0 + i * step,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000 + i * 100,
  }));
}

describe("ultimateOscillator", () => {
  it("should return empty array for empty input", () => {
    expect(ultimateOscillator([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    expect(() => ultimateOscillator(candles, { period1: 0 })).toThrow(
      "Ultimate Oscillator periods must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeSimpleCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ultimateOscillator(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // Default: period1=7, period2=14, period3=28; maxPeriod=28
    const candles = makeSimpleCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ultimateOscillator(candles);
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(28); // first valid at index 28
  });

  it("should work with default options", () => {
    const candles = makeSimpleCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ultimateOscillator(candles);
    expect(result[28].value).not.toBeNull();
    // UO is bounded 0-100
    expect(result[28].value!).toBeGreaterThanOrEqual(0);
    expect(result[28].value!).toBeLessThanOrEqual(100);
  });

  it("should calculate UO correctly with small periods", () => {
    // period1=2, period2=3, period3=4
    const data = [
      { high: 11, low: 9, close: 10 },
      { high: 12, low: 10, close: 11 },
      { high: 13, low: 11, close: 12 },
      { high: 14, low: 12, close: 13 },
      { high: 15, low: 13, close: 14 },
    ];
    const candles = makeCandles(data);
    const result = ultimateOscillator(candles, { period1: 2, period2: 3, period3: 4 });

    // maxPeriod=4, first valid at index 4
    expect(result[0].value).toBeNull();
    expect(result[3].value).toBeNull();
    expect(result[4].value).not.toBeNull();
    // For consistently rising prices, UO should be at least 50
    expect(result[4].value!).toBeGreaterThanOrEqual(50);
  });

  it("should preserve time values", () => {
    const candles = makeSimpleCandles([10, 20, 30, 40, 50]);
    const result = ultimateOscillator(candles, { period1: 1, period2: 2, period3: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
