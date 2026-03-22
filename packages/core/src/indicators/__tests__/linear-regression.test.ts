import { describe, expect, it } from "vitest";
import { linearRegression } from "../../indicators";

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

describe("linearRegression", () => {
  it("should return empty array for empty input", () => {
    expect(linearRegression([])).toEqual([]);
  });

  it("should throw on invalid period (< 2)", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => linearRegression(candles, { period: 1 })).toThrow(
      "Linear Regression period must be at least 2",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = linearRegression(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = linearRegression(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(4); // period - 1
  });

  it("should work with default options (period=14)", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = linearRegression(candles);
    expect(result).toHaveLength(20);
    expect(result[12].value).toBeNull();
    expect(result[13].value).not.toBeNull();
  });

  it("should return value, slope, intercept, rSquared", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = linearRegression(candles, { period: 5 });
    const val = result[4].value;
    expect(val).not.toBeNull();
    expect(val).toHaveProperty("value");
    expect(val).toHaveProperty("slope");
    expect(val).toHaveProperty("intercept");
    expect(val).toHaveProperty("rSquared");
  });

  it("should have R-squared = 1 for perfectly linear data", () => {
    // y = 2x + 100 (perfectly linear)
    const closes = [100, 102, 104, 106, 108];
    const candles = makeCandles(closes);
    const result = linearRegression(candles, { period: 5 });
    const val = result[4].value!;
    expect(val.rSquared).toBeCloseTo(1, 6);
    expect(val.slope).toBeCloseTo(2, 6);
    expect(val.intercept).toBeCloseTo(100, 6);
    // value at end = intercept + slope * (period-1) = 100 + 2*4 = 108
    expect(val.value).toBeCloseTo(108, 6);
  });

  it("should have positive slope for uptrend", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i * 3));
    const result = linearRegression(candles, { period: 5 });
    const val = result[9].value!;
    expect(val.slope).toBeGreaterThan(0);
  });

  it("should have negative slope for downtrend", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 200 - i * 3));
    const result = linearRegression(candles, { period: 5 });
    const val = result[9].value!;
    expect(val.slope).toBeLessThan(0);
  });

  it("should have low R-squared for noisy data", () => {
    const closes = [100, 130, 90, 140, 85, 150, 80, 145, 75, 160];
    const candles = makeCandles(closes);
    const result = linearRegression(candles, { period: 5 });
    const val = result[4].value!;
    // Very noisy data should have low R-squared
    expect(val.rSquared).toBeLessThan(0.8);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = linearRegression(candles, { period: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
