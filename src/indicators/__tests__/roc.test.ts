import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { roc } from "../momentum/roc";

describe("roc", () => {
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
    expect(() => roc(candles, { period: 0 })).toThrow("ROC period must be at least 1");
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = roc(candles, { period: 5 });

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeNull();
  });

  it("should calculate ROC correctly", () => {
    const candles = makeCandles([100, 110, 120, 130, 140]);
    const result = roc(candles, { period: 2 });

    // ROC = ((Current - Past) / Past) × 100
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    // Index 2: (120 - 100) / 100 × 100 = 20%
    expect(result[2].value).toBe(20);
    // Index 3: (130 - 110) / 110 × 100 ≈ 18.18%
    expect(result[3].value).toBeCloseTo(18.18, 1);
    // Index 4: (140 - 120) / 120 × 100 ≈ 16.67%
    expect(result[4].value).toBeCloseTo(16.67, 1);
  });

  it("should show positive ROC for rising prices", () => {
    const candles = makeCandles([100, 110, 120]);
    const result = roc(candles, { period: 1 });

    expect(result[1].value).toBe(10);  // (110-100)/100 × 100
    expect(result[2].value).toBeCloseTo(9.09, 1);  // (120-110)/110 × 100
  });

  it("should show negative ROC for falling prices", () => {
    const candles = makeCandles([120, 110, 100]);
    const result = roc(candles, { period: 1 });

    expect(result[1].value).toBeCloseTo(-8.33, 1);  // (110-120)/120 × 100
    expect(result[2].value).toBeCloseTo(-9.09, 1);  // (100-110)/110 × 100
  });

  it("should return zero for unchanged prices", () => {
    const candles = makeCandles([100, 100, 100]);
    const result = roc(candles, { period: 1 });

    expect(result[1].value).toBe(0);
    expect(result[2].value).toBe(0);
  });

  it("should use different price sources", () => {
    const candles: NormalizedCandle[] = [
      { time: 1700000000000, open: 100, high: 120, low: 80, close: 100, volume: 1000 },
      { time: 1700000086400000, open: 100, high: 130, low: 85, close: 110, volume: 1100 },
    ];

    const rocClose = roc(candles, { period: 1, source: "close" });
    const rocHigh = roc(candles, { period: 1, source: "high" });

    expect(rocClose[1].value).toBe(10);  // (110-100)/100 × 100
    expect(rocHigh[1].value).toBeCloseTo(8.33, 1);  // (130-120)/120 × 100
  });

  it("should handle zero past price", () => {
    const candles = makeCandles([0, 100, 200]);
    const result = roc(candles, { period: 1 });

    // First valid ROC would divide by 0, should return 0
    expect(result[1].value).toBe(0);
  });

  it("should handle empty array", () => {
    expect(roc([], { period: 5 })).toEqual([]);
  });

  it("should preserve time values in result", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = roc(candles, { period: 1 });

    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
    expect(result[2].time).toBe(candles[2].time);
  });
});
