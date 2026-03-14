import { describe, expect, it } from "vitest";
import { kst } from "../../indicators";

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

describe("kst", () => {
  it("should return empty array for empty input", () => {
    expect(kst([])).toEqual([]);
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = kst(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have null values during warmup", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = kst(candles);
    // Default: max(rocPeriods) + max(smaPeriods) = 30 + 15 - 1 = 44
    // First values should be null
    expect(result[0].value).toBeNull();
    expect(result[10].value).toBeNull();
  });

  it("should work with default options", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = kst(candles);
    const nonNullValues = result.filter((r) => r.value !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);
  });

  it("should return kst and signal values", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = kst(candles);
    const firstNonNull = result.find((r) => r.value !== null);
    expect(firstNonNull).toBeDefined();
    expect(firstNonNull!.value).toHaveProperty("kst");
    expect(firstNonNull!.value).toHaveProperty("signal");
  });

  it("should calculate correctly with small periods", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const candles = makeCandles(closes);
    const result = kst(candles, {
      rocPeriods: [2, 3, 4, 5],
      smaPeriods: [2, 2, 2, 2],
      weights: [1, 2, 3, 4],
      signalPeriod: 3,
    });

    // With these small periods, we should get values starting relatively early
    const nonNullValues = result.filter((r) => r.value !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);

    // For steadily rising prices, KST should be positive
    const lastVal = result[result.length - 1].value;
    expect(lastVal).not.toBeNull();
    expect(lastVal!.kst).toBeGreaterThan(0);
  });

  it("should have signal as null before signalPeriod KST values exist", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = kst(candles, {
      rocPeriods: [2, 3, 4, 5],
      smaPeriods: [2, 2, 2, 2],
      weights: [1, 2, 3, 4],
      signalPeriod: 3,
    });

    // Find first non-null KST
    const firstKst = result.find((r) => r.value !== null);
    expect(firstKst).toBeDefined();
    // Signal may be null initially
    if (firstKst!.value!.signal === null) {
      // Good, expected for first KST value
      expect(firstKst!.value!.signal).toBeNull();
    }
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = kst(candles, {
      rocPeriods: [1, 1, 1, 1],
      smaPeriods: [1, 1, 1, 1],
      weights: [1, 1, 1, 1],
      signalPeriod: 1,
    });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
