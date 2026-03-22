import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { williamsR } from "../momentum/williams-r";

describe("williamsR", () => {
  // Helper to create candles with OHLC data
  const makeCandles = (
    data: Array<{ high: number; low: number; close: number }>,
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100 }]);
    expect(() => williamsR(candles, { period: 0 })).toThrow(
      "Williams %R period must be at least 1",
    );
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = williamsR(candles, { period: 5 });
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
  });

  it("should calculate Williams %R correctly", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
      { high: 130, low: 110, close: 115 },
    ]);

    const result = williamsR(candles, { period: 3 });

    // Williams %R = (Highest High - Close) / (Highest High - Lowest Low) × -100
    // Over 3 periods: Highest High = 130, Lowest Low = 90
    // Current close = 115
    // %R = (130 - 115) / (130 - 90) × -100 = 15/40 × -100 = -37.5

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeCloseTo(-37.5, 1);
  });

  it("should be in range -100 to 0", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 90 }, // Close at low = -100
      { high: 120, low: 100, close: 120 }, // Close at high = 0
      { high: 130, low: 110, close: 120 }, // Close in middle
    ]);

    const result = williamsR(candles, { period: 1 });

    expect(result[0].value).toBe(-100); // Close at low
    expect(result[1].value).toBeCloseTo(0, 5); // Close at high (-0 is equal to 0 mathematically)
    expect(result[2].value).toBe(-50); // Close in middle
  });

  it("should identify overbought conditions (%R > -20)", () => {
    const candles = makeCandles([
      { high: 100, low: 80, close: 90 },
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 118 }, // Close near high
    ]);

    const result = williamsR(candles, { period: 3 });

    // Close (118) is near highest high (120)
    // %R = (120 - 118) / (120 - 80) × -100 = -5
    const lastValue = result[result.length - 1].value;
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThan(-20); // Overbought
  });

  it("should identify oversold conditions (%R < -80)", () => {
    const candles = makeCandles([
      { high: 120, low: 100, close: 110 },
      { high: 110, low: 90, close: 100 },
      { high: 100, low: 80, close: 82 }, // Close near low
    ]);

    const result = williamsR(candles, { period: 3 });

    // Close (82) is near lowest low (80)
    // %R = (120 - 82) / (120 - 80) × -100 = -95
    const lastValue = result[result.length - 1].value;
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeLessThan(-80); // Oversold
  });

  it("should handle zero range", () => {
    const candles = makeCandles([
      { high: 100, low: 100, close: 100 },
      { high: 100, low: 100, close: 100 },
      { high: 100, low: 100, close: 100 },
    ]);

    const result = williamsR(candles, { period: 3 });

    // When high = low, return neutral value (-50)
    expect(result[2].value).toBe(-50);
  });

  it("should handle empty array", () => {
    expect(williamsR([])).toEqual([]);
  });

  it("should preserve time values in result", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = williamsR(candles);
    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
  });
});
