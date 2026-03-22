import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { superSmoother } from "../filter/super-smoother";

describe("superSmoother", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should handle empty array", () => {
    expect(superSmoother([], { period: 10 })).toEqual([]);
  });

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([100]);
    expect(() => superSmoother(candles, { period: 0 })).toThrow(
      "Super Smoother period must be at least 1",
    );
  });

  it("should return null for first 2 bars", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = superSmoother(candles, { period: 10 });

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).not.toBeNull();
  });

  it("should converge to constant for constant input", () => {
    const candles = makeCandles(Array(50).fill(100));
    const result = superSmoother(candles, { period: 10 });

    // After warmup, output should converge to 100
    const last = result[result.length - 1].value as number;
    expect(last).toBeCloseTo(100, 2);
  });

  it("should respond faster than SMA to a step function", () => {
    // Create step: 100 for 20 bars, then 200 for 20 bars
    const prices = [...Array(20).fill(100), ...Array(20).fill(200)];
    const candles = makeCandles(prices);

    const result = superSmoother(candles, { period: 10 });

    // At bar 25 (5 bars after step), SS should be well above 150 (midpoint)
    // because it responds faster than SMA
    const val25 = result[25].value as number;
    expect(val25).toBeGreaterThan(150);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = superSmoother(candles, { period: 10 });

    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
    expect(result[2].time).toBe(candles[2].time);
  });

  it("should produce smooth output for noisy input", () => {
    // Alternating prices: noisy signal
    const prices = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? 5 : -5));
    const candles = makeCandles(prices);
    const result = superSmoother(candles, { period: 10 });

    // Last 10 values should be close to 100 (the mean)
    const lastValues = result.slice(-10).map((r) => r.value as number);
    for (const v of lastValues) {
      expect(v).toBeCloseTo(100, 0);
    }
  });
});
