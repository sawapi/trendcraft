import { describe, expect, it } from "vitest";
import { tsi } from "../../indicators";

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

describe("tsi", () => {
  it("should return empty array for empty input", () => {
    expect(tsi([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => tsi(candles, { longPeriod: 0 })).toThrow("TSI periods must be at least 1");
    expect(() => tsi(candles, { shortPeriod: 0 })).toThrow("TSI periods must be at least 1");
    expect(() => tsi(candles, { signalPeriod: 0 })).toThrow("TSI periods must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = tsi(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have null values during warmup", () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = tsi(candles);
    // First values should be null
    expect(result[0].value).toBeNull();
    expect(result[10].value).toBeNull();
  });

  it("should work with default options (long=25, short=13, signal=7)", () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = tsi(candles);
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });

  it("should return tsi and signal values", () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = tsi(candles);
    const firstNonNull = result.find((r) => r.value !== null);
    expect(firstNonNull).toBeDefined();
    expect(firstNonNull!.value).toHaveProperty("tsi");
    expect(firstNonNull!.value).toHaveProperty("signal");
  });

  it("should be positive for consistently rising prices", () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const result = tsi(candles);
    const lastVal = result[result.length - 1].value;
    expect(lastVal).not.toBeNull();
    expect(lastVal!.tsi).toBeGreaterThan(0);
  });

  it("should be negative for consistently falling prices", () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 200 - i));
    const result = tsi(candles);
    const lastVal = result[result.length - 1].value;
    expect(lastVal).not.toBeNull();
    expect(lastVal!.tsi).toBeLessThan(0);
  });

  it("should calculate with small periods for manual verification", () => {
    const closes = [10, 12, 11, 13, 14, 15, 14, 16, 17, 18];
    const candles = makeCandles(closes);
    const result = tsi(candles, { longPeriod: 3, shortPeriod: 2, signalPeriod: 2 });

    // Should eventually produce valid values
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);

    // TSI is bounded roughly between -100 and 100
    for (const r of nonNull) {
      expect(r.value!.tsi).toBeGreaterThanOrEqual(-100);
      expect(r.value!.tsi).toBeLessThanOrEqual(100);
    }
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = tsi(candles, { longPeriod: 2, shortPeriod: 1, signalPeriod: 1 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
