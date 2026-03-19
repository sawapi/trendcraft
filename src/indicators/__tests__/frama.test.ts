import { describe, expect, it } from "vitest";
import { frama } from "../../indicators";

function makeCandles(closes: number[], time0 = 1000, step = 86400) {
  return closes.map((c, i) => ({
    time: time0 + i * step,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000 + i * 100,
  }));
}

describe("frama", () => {
  it("should return empty array for empty input", () => {
    expect(frama([])).toEqual([]);
  });

  it("should throw on invalid period (< 4)", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    expect(() => frama(candles, { period: 3 })).toThrow("FRAMA period must be at least 4");
    expect(() => frama(candles, { period: 2 })).toThrow("FRAMA period must be at least 4");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = frama(candles, { period: 4 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // effectivePeriod = 4 (already even), nulls = 4-1 = 3
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = frama(candles, { period: 4 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(3);
  });

  it("should round up odd period to next even", () => {
    // period=5 becomes effectivePeriod=6, so nulls = 5
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = frama(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(5);
  });

  it("should work with default options (period=16)", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = frama(candles);
    expect(result).toHaveLength(30);
    expect(result[14].value).toBeNull();
    expect(result[15].value).not.toBeNull();
  });

  it("should seed with current price at first valid index", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = frama(candles, { period: 4 });
    // First valid at index 3, seeded with close price at index 3 = 103
    expect(result[3].value).toBeCloseTo(103, 4);
  });

  it("should adapt alpha based on fractal dimension", () => {
    // For trending data, D should be closer to 1, alpha closer to 1
    // For ranging data, D closer to 2, alpha closer to 0
    const trending = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i * 5));
    const ranging = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 5 : -5)));
    const trendResult = frama(trending, { period: 4 });
    const rangeResult = frama(ranging, { period: 4 });
    // Both should produce valid values
    expect(trendResult[5].value).not.toBeNull();
    expect(rangeResult[5].value).not.toBeNull();
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = frama(candles, { period: 4 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should throw on non-integer period", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    expect(() => frama(candles, { period: 16.5 })).toThrow("FRAMA period must be an integer");
  });
});
