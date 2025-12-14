import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { sma } from "../moving-average/sma";

describe("sma", () => {
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
    expect(() => sma(candles, { period: 0 })).toThrow("SMA period must be at least 1");
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = sma(candles, { period: 5 });

    expect(result).toHaveLength(3);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeNull();
  });

  it("should calculate SMA correctly with period 3", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = sma(candles, { period: 3 });

    expect(result).toHaveLength(5);
    expect(result[0].value).toBeNull(); // Not enough data
    expect(result[1].value).toBeNull(); // Not enough data
    expect(result[2].value).toBe(20); // (10 + 20 + 30) / 3
    expect(result[3].value).toBe(30); // (20 + 30 + 40) / 3
    expect(result[4].value).toBe(40); // (30 + 40 + 50) / 3
  });

  it("should calculate SMA with period 1", () => {
    const candles = makeCandles([10, 20, 30]);
    const result = sma(candles, { period: 1 });

    expect(result[0].value).toBe(10);
    expect(result[1].value).toBe(20);
    expect(result[2].value).toBe(30);
  });

  it("should use different price sources", () => {
    const candles: NormalizedCandle[] = [
      { time: 1700000000000, open: 100, high: 120, low: 80, close: 110, volume: 1000 },
      { time: 1700000086400000, open: 110, high: 130, low: 90, close: 120, volume: 1100 },
      { time: 1700000172800000, open: 120, high: 140, low: 100, close: 130, volume: 1200 },
    ];

    const smaClose = sma(candles, { period: 3, source: "close" });
    const smaHigh = sma(candles, { period: 3, source: "high" });
    const smaLow = sma(candles, { period: 3, source: "low" });

    expect(smaClose[2].value).toBe(120); // (110 + 120 + 130) / 3
    expect(smaHigh[2].value).toBe(130); // (120 + 130 + 140) / 3
    expect(smaLow[2].value).toBe(90); // (80 + 90 + 100) / 3
  });

  it("should preserve time values in result", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = sma(candles, { period: 2 });

    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
    expect(result[2].time).toBe(candles[2].time);
  });

  it("should handle empty array", () => {
    expect(sma([], { period: 5 })).toEqual([]);
  });
});
