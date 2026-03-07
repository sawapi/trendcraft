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

  it("should have correct null structure for period=2", () => {
    // With period=2, each cascaded EMA needs 2 values to seed:
    // e1 starts at index 1 (needs 2 prices)
    // e2 starts at index 2 (needs 2 e1 values: indices 1,2)
    // e3 at index 3, e4 at 4, e5 at 5, e6 at 6
    // So first non-null T3 should be at index 6
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const result = t3(candles, { period: 2 });

    // Indices 0-5 should be null
    for (let i = 0; i < 6; i++) {
      expect(result[i].value).toBeNull();
    }
    // Index 6 should have a value
    expect(result[6].value).not.toBeNull();
    // All subsequent values should be non-null
    for (let i = 6; i < result.length; i++) {
      expect(result[i].value).not.toBeNull();
    }
  });

  it("should match hand-calculated reference for period=1", () => {
    // With period=1, EMA seed = SMA(1) = first value itself
    // EMA with period=1 has multiplier = 2/(1+1) = 1.0, so EMA = current value
    // Each cascaded EMA just passes through the value
    // T3 with period=1 should equal the input price for all bars
    const closes = [100, 105, 110, 108, 112];
    const candles = makeCandles(closes);
    const result = t3(candles, { period: 1 });

    for (let i = 0; i < closes.length; i++) {
      expect(result[i].value).not.toBeNull();
      expect(result[i].value).toBeCloseTo(closes[i], 5);
    }
  });

  it("should maintain contiguous non-null values after warmup", () => {
    // Verify cascaded EMAs don't produce null gaps after initial warmup
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 20);
    const candles = makeCandles(closes);
    const result = t3(candles, { period: 3 });

    let firstNonNull = -1;
    for (let i = 0; i < result.length; i++) {
      if (result[i].value !== null) {
        firstNonNull = i;
        break;
      }
    }
    expect(firstNonNull).toBeGreaterThan(0);

    // After the first non-null, all remaining should be non-null
    for (let i = firstNonNull; i < result.length; i++) {
      expect(result[i].value).not.toBeNull();
    }
  });
});
