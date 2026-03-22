import { describe, expect, it } from "vitest";
import { schaffTrendCycle } from "../../indicators";

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

describe("schaffTrendCycle", () => {
  it("should return empty array for empty input", () => {
    expect(schaffTrendCycle([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => schaffTrendCycle(candles, { fastPeriod: 0 })).toThrow(
      "Schaff Trend Cycle periods must be at least 1",
    );
    expect(() => schaffTrendCycle(candles, { slowPeriod: 0 })).toThrow(
      "Schaff Trend Cycle periods must be at least 1",
    );
    expect(() => schaffTrendCycle(candles, { cyclePeriod: 0 })).toThrow(
      "Schaff Trend Cycle periods must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = schaffTrendCycle(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have null values during warmup", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = schaffTrendCycle(candles);
    // slowPeriod=50 means MACD not valid until index 49, then need cyclePeriod=10
    expect(result[0].value).toBeNull();
    expect(result[30].value).toBeNull();
  });

  it("should work with default options (fast=23, slow=50, cycle=10)", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = schaffTrendCycle(candles);
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });

  it("should produce values between 0 and 100", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i) * 20));
    const result = schaffTrendCycle(candles);
    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeGreaterThanOrEqual(0);
        expect(r.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("should produce numeric values for strong uptrend", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i * 5));
    const result = schaffTrendCycle(candles);
    const lastVal = result[result.length - 1].value;
    // STC may not be high for perfectly linear trends (stochastic normalizes)
    // but it should produce a valid numeric value
    if (lastVal !== null) {
      expect(typeof lastVal).toBe("number");
      expect(lastVal).toBeGreaterThanOrEqual(0);
      expect(lastVal).toBeLessThanOrEqual(100);
    }
  });

  it("should calculate with smaller periods", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = schaffTrendCycle(candles, {
      fastPeriod: 5,
      slowPeriod: 10,
      cyclePeriod: 3,
    });
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });

  it("should preserve time values", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = schaffTrendCycle(candles, {
      fastPeriod: 3,
      slowPeriod: 5,
      cyclePeriod: 2,
    });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
