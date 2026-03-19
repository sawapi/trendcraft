import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { wma } from "../moving-average/wma";

describe("wma", () => {
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
    expect(() => wma(candles, { period: 0 })).toThrow("WMA period must be at least 1");
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = wma(candles, { period: 5 });

    expect(result).toHaveLength(3);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeNull();
  });

  it("should calculate WMA correctly with period 3", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = wma(candles, { period: 3 });

    // WMA formula: (P1 * 3 + P2 * 2 + P3 * 1) / (3 + 2 + 1)
    // Weight sum = 3 * 4 / 2 = 6
    expect(result).toHaveLength(5);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    // Index 2: (30*3 + 20*2 + 10*1) / 6 = (90 + 40 + 10) / 6 = 140/6 ≈ 23.33
    expect(result[2].value).toBeCloseTo(23.333, 2);
    // Index 3: (40*3 + 30*2 + 20*1) / 6 = (120 + 60 + 20) / 6 = 200/6 ≈ 33.33
    expect(result[3].value).toBeCloseTo(33.333, 2);
    // Index 4: (50*3 + 40*2 + 30*1) / 6 = (150 + 80 + 30) / 6 = 260/6 ≈ 43.33
    expect(result[4].value).toBeCloseTo(43.333, 2);
  });

  it("should give more weight to recent prices", () => {
    const candles = makeCandles([10, 20, 30]);
    const result = wma(candles, { period: 3 });

    // WMA should be higher than SMA when prices are rising
    // WMA = (30*3 + 20*2 + 10*1) / 6 = 23.33
    // SMA would be (10 + 20 + 30) / 3 = 20
    expect(result[2].value).toBeGreaterThan(20);
  });

  it("should calculate WMA with period 1", () => {
    const candles = makeCandles([10, 20, 30]);
    const result = wma(candles, { period: 1 });

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

    const wmaClose = wma(candles, { period: 3, source: "close" });
    const wmaHigh = wma(candles, { period: 3, source: "high" });
    const wmaLow = wma(candles, { period: 3, source: "low" });

    // WMA for close: (130*3 + 120*2 + 110*1) / 6 = (390 + 240 + 110) / 6 = 123.33
    expect(wmaClose[2].value).toBeCloseTo(123.333, 2);
    // WMA for high: (140*3 + 130*2 + 120*1) / 6 = (420 + 260 + 120) / 6 = 133.33
    expect(wmaHigh[2].value).toBeCloseTo(133.333, 2);
    // WMA for low: (100*3 + 90*2 + 80*1) / 6 = (300 + 180 + 80) / 6 = 93.33
    expect(wmaLow[2].value).toBeCloseTo(93.333, 2);
  });

  it("should handle empty array", () => {
    expect(wma([], { period: 5 })).toEqual([]);
  });

  it("should throw on non-integer period", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => wma(candles, { period: 5.5 })).toThrow("WMA period must be an integer");
  });
});
