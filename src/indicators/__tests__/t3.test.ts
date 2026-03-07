import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { t3 } from "../moving-average/t3";

describe("t3", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => t3(candles, { period: 0 })).toThrow("T3 period must be at least 1");
  });

  it("should return null for insufficient data", () => {
    // T3 requires 6 cascaded EMAs, each needing `period` data points
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = t3(candles, { period: 5 });

    // Not enough data for 6 cascaded EMAs with period 5
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should produce values with enough data", () => {
    // With period=2, need 2*6=12 minimum bars for all 6 EMAs to produce values
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const result = t3(candles, { period: 2 });

    // Last value should exist
    expect(result[result.length - 1].value).not.toBeNull();
  });

  it("should be smoother than regular EMA", () => {
    // T3 should produce smoother results
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.5) * 10);
    const candles = makeCandles(closes);
    const result = t3(candles, { period: 5 });

    const validValues = result.filter((r) => r.value !== null).map((r) => r.value!);
    expect(validValues.length).toBeGreaterThan(0);

    // Check smoothness: consecutive differences should be small
    if (validValues.length > 1) {
      for (let i = 1; i < validValues.length; i++) {
        const diff = Math.abs(validValues[i] - validValues[i - 1]);
        expect(diff).toBeLessThan(10); // Should be well-smoothed
      }
    }
  });

  it("should handle constant prices", () => {
    const candles = makeCandles(Array(30).fill(100));
    const result = t3(candles, { period: 3 });

    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeCloseTo(100, 5);
      }
    }
  });

  it("should handle empty array", () => {
    expect(t3([])).toEqual([]);
  });

  it("should preserve time values", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = t3(candles, { period: 3 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should respect vFactor parameter", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);

    const result07 = t3(candles, { period: 3, vFactor: 0.7 });
    const result09 = t3(candles, { period: 3, vFactor: 0.9 });

    // Different vFactor should produce different results
    const last07 = result07[result07.length - 1].value;
    const last09 = result09[result09.length - 1].value;

    if (last07 !== null && last09 !== null) {
      expect(last07).not.toBeCloseTo(last09, 5);
    }
  });
});
