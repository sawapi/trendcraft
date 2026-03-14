import { describe, expect, it } from "vitest";
import { alma } from "../../indicators";

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

describe("alma", () => {
  it("should return empty array for empty input", () => {
    expect(alma([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => alma(candles, { period: 0 })).toThrow("ALMA period must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 15 }, (_, i) => 100 + i));
    const result = alma(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    const candles = makeCandles(Array.from({ length: 15 }, (_, i) => 100 + i));
    const result = alma(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(4); // period - 1
  });

  it("should work with default options (period=9)", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = alma(candles);
    expect(result).toHaveLength(20);
    expect(result[7].value).toBeNull();
    expect(result[8].value).not.toBeNull();
  });

  it("should calculate weighted average using Gaussian distribution", () => {
    // period=3, offset=0.85, sigma=6
    // m = 0.85 * 2 = 1.7, s = 3/6 = 0.5
    // weights[0] = exp(-((0-1.7)^2)/(2*0.25)) = exp(-5.78)
    // weights[1] = exp(-((1-1.7)^2)/(2*0.25)) = exp(-0.98)
    // weights[2] = exp(-((2-1.7)^2)/(2*0.25)) = exp(-0.18)
    const closes = [10, 20, 30];
    const candles = makeCandles(closes);
    const result = alma(candles, { period: 3, offset: 0.85, sigma: 6 });

    const m = 0.85 * 2;
    const s = 3 / 6;
    const w0 = Math.exp(-((0 - m) ** 2) / (2 * s * s));
    const w1 = Math.exp(-((1 - m) ** 2) / (2 * s * s));
    const w2 = Math.exp(-((2 - m) ** 2) / (2 * s * s));
    const wSum = w0 + w1 + w2;
    const expected = (w0 * 10 + w1 * 20 + w2 * 30) / wSum;

    expect(result[2].value).toBeCloseTo(expected, 6);
  });

  it("should weight toward the end with high offset", () => {
    // With offset=0.85, weights are concentrated near the most recent values
    const closes = [10, 10, 10, 10, 50];
    const candles = makeCandles(closes);
    const result = alma(candles, { period: 5, offset: 0.85, sigma: 6 });
    // Should be higher than a simple average (18)
    expect(result[4].value!).toBeGreaterThan(18);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = alma(candles, { period: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
