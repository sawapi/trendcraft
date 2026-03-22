import { describe, expect, it } from "vitest";
import { standardDeviation } from "../../indicators";

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

describe("standardDeviation", () => {
  it("should return empty array for empty input", () => {
    expect(standardDeviation([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => standardDeviation(candles, { period: 0 })).toThrow(
      "Standard Deviation period must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const result = standardDeviation(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    const candles = makeCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const result = standardDeviation(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(4); // period - 1
  });

  it("should work with default options (period=20)", () => {
    const candles = makeCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const result = standardDeviation(candles);
    expect(result).toHaveLength(25);
    expect(result[18].value).toBeNull();
    expect(result[19].value).not.toBeNull();
  });

  it("should return 0 for constant values", () => {
    const closes = [100, 100, 100, 100, 100];
    const candles = makeCandles(closes);
    const result = standardDeviation(candles, { period: 3 });
    expect(result[2].value).toBe(0);
    expect(result[4].value).toBe(0);
  });

  it("should calculate population standard deviation correctly", () => {
    // period=3, values [10, 20, 30]
    // mean = 20, diffs: -10, 0, 10
    // variance = (100 + 0 + 100) / 3 = 66.67
    // stddev = sqrt(66.67) ≈ 8.165
    const closes = [10, 20, 30];
    const candles = makeCandles(closes);
    const result = standardDeviation(candles, { period: 3 });
    expect(result[2].value).toBeCloseTo(Math.sqrt(200 / 3), 6);
  });

  it("should be higher for more dispersed values", () => {
    const low = makeCandles([100, 101, 100, 101, 100]);
    const high = makeCandles([100, 120, 80, 120, 80]);
    const lowSD = standardDeviation(low, { period: 3 });
    const highSD = standardDeviation(high, { period: 3 });
    expect(highSD[4].value!).toBeGreaterThan(lowSD[4].value!);
  });

  it("should always return non-negative values", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 10);
    const candles = makeCandles(closes);
    const result = standardDeviation(candles, { period: 5 });
    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = standardDeviation(candles, { period: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
