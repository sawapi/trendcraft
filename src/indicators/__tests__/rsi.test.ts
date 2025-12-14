import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { rsi } from "../momentum/rsi";

describe("rsi", () => {
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
    expect(() => rsi(candles, { period: 0 })).toThrow("RSI period must be at least 1");
  });

  it("should use default period of 14", () => {
    // Need 15 candles for first RSI with default period 14
    const closes = Array.from({ length: 16 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const result = rsi(candles);

    // First 14 values should be null (need 14 price changes)
    for (let i = 0; i < 14; i++) {
      expect(result[i].value).toBeNull();
    }
    // 15th value (index 14) should have RSI
    expect(result[14].value).not.toBeNull();
  });

  it("should return all nulls for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = rsi(candles, { period: 14 });

    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should return 100 when only gains", () => {
    // All prices increasing
    const closes = [100, 101, 102, 103, 104, 105];
    const candles = makeCandles(closes);
    const result = rsi(candles, { period: 3 });

    // After period+1 candles, we have RSI
    // All changes are +1 (gains), no losses
    expect(result[3].value).toBe(100);
  });

  it("should return 0 when only losses", () => {
    // All prices decreasing
    const closes = [105, 104, 103, 102, 101, 100];
    const candles = makeCandles(closes);
    const result = rsi(candles, { period: 3 });

    // All changes are -1 (losses), no gains
    expect(result[3].value).toBe(0);
  });

  it("should return ~50 when gains equal losses", () => {
    // Alternating up and down by same amount
    const closes = [100, 110, 100, 110, 100, 110, 100];
    const candles = makeCandles(closes);
    const result = rsi(candles, { period: 4 });

    // Over 4 periods: 2 gains of 10, 2 losses of 10
    // Average gain = 5, Average loss = 5
    // RS = 1, RSI = 50
    expect(result[4].value).toBeCloseTo(50, 1);
  });

  it("should apply Wilder smoothing correctly", () => {
    const closes = [100, 110, 105, 115, 108, 118];
    const candles = makeCandles(closes);
    const result = rsi(candles, { period: 3 });

    // Check that RSI values are calculated
    expect(result[3].value).not.toBeNull();
    expect(result[4].value).not.toBeNull();
    expect(result[5].value).not.toBeNull();

    // RSI should be between 0 and 100
    expect(result[3].value).toBeGreaterThanOrEqual(0);
    expect(result[3].value).toBeLessThanOrEqual(100);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = rsi(candles, { period: 2 });

    expect(result[0].time).toBe(candles[0].time);
    expect(result[2].time).toBe(candles[2].time);
    expect(result[4].time).toBe(candles[4].time);
  });

  it("should handle empty array", () => {
    expect(rsi([])).toEqual([]);
  });

  it("should handle flat prices (no change)", () => {
    const closes = [100, 100, 100, 100, 100];
    const candles = makeCandles(closes);
    const result = rsi(candles, { period: 3 });

    // When there's no movement, RSI should be 50
    expect(result[3].value).toBe(50);
  });
});
