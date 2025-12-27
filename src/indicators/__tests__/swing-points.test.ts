import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { getSwingHighs, getSwingLows, swingPoints } from "../price/swing-points";

describe("swingPoints", () => {
  // Helper to create candles with OHLC
  const makeCandles = (
    data: Array<{ o: number; h: number; l: number; c: number }>,
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.o,
      high: d.h,
      low: d.l,
      close: d.c,
      volume: 1000,
    }));

  it("should throw if leftBars is less than 1", () => {
    const candles = makeCandles([{ o: 100, h: 105, l: 95, c: 102 }]);
    expect(() => swingPoints(candles, { leftBars: 0 })).toThrow("leftBars must be at least 1");
  });

  it("should throw if rightBars is less than 1", () => {
    const candles = makeCandles([{ o: 100, h: 105, l: 95, c: 102 }]);
    expect(() => swingPoints(candles, { rightBars: 0 })).toThrow("rightBars must be at least 1");
  });

  it("should return empty array for empty input", () => {
    const result = swingPoints([]);
    expect(result).toEqual([]);
  });

  it("should detect swing high correctly with period=1", () => {
    // Pattern: lower - highest - lower (clear swing high at index 1)
    const candles = makeCandles([
      { o: 100, h: 105, l: 99, c: 104 }, // 0 - high = 105
      { o: 104, h: 120, l: 103, c: 118 }, // 1 - high = 120 (swing high)
      { o: 118, h: 110, l: 108, c: 109 }, // 2 - high = 110
    ]);

    const result = swingPoints(candles, { leftBars: 1, rightBars: 1 });

    // Swing high at index 1 should be detected when i=2
    expect(result[1].value.isSwingHigh).toBe(true);
    expect(result[2].value.swingHighPrice).toBe(120);
  });

  it("should detect swing low correctly with period=1", () => {
    // Pattern: higher - lowest - higher (clear swing low at index 1)
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 }, // 0 - low = 95
      { o: 102, h: 104, l: 80, c: 82 }, // 1 - low = 80 (swing low)
      { o: 82, h: 90, l: 85, c: 88 }, // 2 - low = 85
    ]);

    const result = swingPoints(candles, { leftBars: 1, rightBars: 1 });

    // Swing low at index 1 should be detected
    expect(result[1].value.isSwingLow).toBe(true);
    expect(result[2].value.swingLowPrice).toBe(80);
  });

  it("should track bars since last swing", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 99, c: 104 }, // 0
      { o: 104, h: 120, l: 103, c: 118 }, // 1 - swing high
      { o: 118, h: 110, l: 108, c: 109 }, // 2
      { o: 109, h: 108, l: 106, c: 107 }, // 3
      { o: 107, h: 106, l: 104, c: 105 }, // 4
    ]);

    const result = swingPoints(candles, { leftBars: 1, rightBars: 1 });

    // At index 4, swing high was at index 1, so swingHighIndex should be 3
    expect(result[4].value.swingHighIndex).toBe(3);
  });

  it("should handle both swing high and low", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 }, // 0
      { o: 102, h: 120, l: 100, c: 118 }, // 1 - swing high
      { o: 118, h: 110, l: 108, c: 109 }, // 2
      { o: 109, h: 108, l: 80, c: 82 }, // 3 - swing low
      { o: 82, h: 90, l: 85, c: 88 }, // 4
    ]);

    const result = swingPoints(candles, { leftBars: 1, rightBars: 1 });

    // Check swing high at index 1
    expect(result[1].value.isSwingHigh).toBe(true);
    // Check swing low at index 3
    expect(result[3].value.isSwingLow).toBe(true);
  });

  it("should not detect swing when values are equal", () => {
    // All highs are the same - no swing high
    const candles = makeCandles([
      { o: 100, h: 105, l: 99, c: 101 },
      { o: 101, h: 105, l: 100, c: 102 },
      { o: 102, h: 105, l: 101, c: 103 },
    ]);

    const result = swingPoints(candles, { leftBars: 1, rightBars: 1 });

    // No swing should be detected since all highs are equal
    const hasSwingHigh = result.some((r) => r.value.isSwingHigh);
    expect(hasSwingHigh).toBe(false);
  });

  describe("getSwingHighs", () => {
    it("should return array of swing high points", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 104 }, // 0
        { o: 104, h: 120, l: 103, c: 118 }, // 1 - swing high
        { o: 118, h: 110, l: 108, c: 109 }, // 2
      ]);

      const highs = getSwingHighs(candles, { leftBars: 1, rightBars: 1 });

      expect(highs.length).toBe(1);
      expect(highs[0].price).toBe(120);
      expect(highs[0].index).toBe(1);
    });
  });

  describe("getSwingLows", () => {
    it("should return array of swing low points", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 95, c: 102 }, // 0
        { o: 102, h: 104, l: 80, c: 82 }, // 1 - swing low
        { o: 82, h: 90, l: 85, c: 88 }, // 2
      ]);

      const lows = getSwingLows(candles, { leftBars: 1, rightBars: 1 });

      expect(lows.length).toBe(1);
      expect(lows[0].price).toBe(80);
      expect(lows[0].index).toBe(1);
    });
  });
});
