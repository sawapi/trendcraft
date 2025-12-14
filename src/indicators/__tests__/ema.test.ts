import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { ema } from "../moving-average/ema";

describe("ema", () => {
  // Helper to create simple candles with just close prices
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
    expect(() => ema(candles, { period: 0 })).toThrow("EMA period must be at least 1");
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = ema(candles, { period: 5 });

    expect(result).toHaveLength(3);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeNull();
  });

  it("should use SMA for first EMA value", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = ema(candles, { period: 3 });

    // First EMA is SMA of first 3 values: (10 + 20 + 30) / 3 = 20
    expect(result[2].value).toBe(20);
  });

  it("should calculate EMA correctly", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = ema(candles, { period: 3 });

    // Multiplier = 2 / (3 + 1) = 0.5
    // EMA[2] = 20 (SMA)
    // EMA[3] = 40 * 0.5 + 20 * 0.5 = 30
    // EMA[4] = 50 * 0.5 + 30 * 0.5 = 40

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBe(20);
    expect(result[3].value).toBe(30);
    expect(result[4].value).toBe(40);
  });

  it("should give more weight to recent prices", () => {
    // EMA should react faster to price changes than SMA
    const candles = makeCandles([100, 100, 100, 150, 150]);
    const result = ema(candles, { period: 3 });

    // After price jumps from 100 to 150, EMA should move toward 150
    // but not reach it immediately
    expect(result[3].value).toBeGreaterThan(100);
    expect(result[3].value).toBeLessThan(150);
    expect(result[4].value).toBeGreaterThan(result[3].value as number);
  });

  it("should handle period 1 (equals price)", () => {
    const candles = makeCandles([100, 200, 300]);
    const result = ema(candles, { period: 1 });

    // With period 1, multiplier = 2/2 = 1, so EMA = current price
    expect(result[0].value).toBe(100);
    expect(result[1].value).toBe(200);
    expect(result[2].value).toBe(300);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = ema(candles, { period: 2 });

    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
    expect(result[2].time).toBe(candles[2].time);
  });

  it("should handle empty array", () => {
    expect(ema([], { period: 5 })).toEqual([]);
  });
});
