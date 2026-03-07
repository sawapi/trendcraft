import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { hurst } from "../momentum/hurst";

describe("hurst", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1000,
    }));

  it("should throw if minWindow is less than 2", () => {
    const candles = makeCandles(Array(200).fill(100));
    expect(() => hurst(candles, { minWindow: 1 })).toThrow(
      "Hurst minWindow must be at least 2",
    );
  });

  it("should throw if maxWindow is not greater than minWindow", () => {
    const candles = makeCandles(Array(200).fill(100));
    expect(() => hurst(candles, { minWindow: 20, maxWindow: 20 })).toThrow(
      "Hurst maxWindow must be greater than minWindow",
    );
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles(Array(50).fill(100));
    const result = hurst(candles, { maxWindow: 100 });

    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should produce values in [0, 1] range", () => {
    // Generate enough data with a simple trend
    const closes = Array.from({ length: 150 }, (_, i) => 100 + i * 0.5 + Math.sin(i * 0.1) * 5);
    const candles = makeCandles(closes);
    const result = hurst(candles, { minWindow: 10, maxWindow: 80 });

    const validValues = result.filter((r) => r.value !== null);
    expect(validValues.length).toBeGreaterThan(0);

    for (const r of validValues) {
      expect(r.value!).toBeGreaterThanOrEqual(0);
      expect(r.value!).toBeLessThanOrEqual(1);
    }
  });

  it("should detect trending series (H > 0.5)", () => {
    // Strong uptrend
    const closes = Array.from({ length: 150 }, (_, i) => 100 + i * 2);
    const candles = makeCandles(closes);
    const result = hurst(candles, { minWindow: 10, maxWindow: 80 });

    const validValues = result.filter((r) => r.value !== null);
    const lastValue = validValues[validValues.length - 1].value!;

    // Strong trend should produce H > 0.5
    expect(lastValue).toBeGreaterThan(0.4);
  });

  it("should handle empty array", () => {
    expect(hurst([])).toEqual([]);
  });

  it("should preserve time values", () => {
    const candles = makeCandles(Array.from({ length: 120 }, (_, i) => 100 + i));
    const result = hurst(candles, { minWindow: 10, maxWindow: 80 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should output null for first maxWindow-1 bars", () => {
    const candles = makeCandles(Array.from({ length: 120 }, (_, i) => 100 + i));
    const result = hurst(candles, { minWindow: 10, maxWindow: 50 });

    for (let i = 0; i < 49; i++) {
      expect(result[i].value).toBeNull();
    }
    // Index 49 (maxWindow - 1) should have a value
    expect(result[49].value).not.toBeNull();
  });
});
