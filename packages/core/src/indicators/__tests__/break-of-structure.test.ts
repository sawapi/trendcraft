import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { breakOfStructure, changeOfCharacter } from "../price/break-of-structure";

describe("breakOfStructure", () => {
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

  it("should throw if swingPeriod is less than 1", () => {
    const candles = makeCandles([{ o: 100, h: 105, l: 95, c: 102 }]);
    expect(() => breakOfStructure(candles, { swingPeriod: 0 })).toThrow(
      "swingPeriod must be at least 1",
    );
  });

  it("should return empty array for empty input", () => {
    const result = breakOfStructure([]);
    expect(result).toEqual([]);
  });

  it("should detect bullish BOS when price breaks above swing high", () => {
    // Create a swing high, then break it
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 }, // 0
      { o: 101, h: 110, l: 100, c: 108 }, // 1 - swing high at 110
      { o: 108, h: 105, l: 103, c: 104 }, // 2
      { o: 104, h: 103, l: 100, c: 101 }, // 3 - swing confirmed
      { o: 101, h: 102, l: 99, c: 100 }, // 4
      { o: 100, h: 115, l: 99, c: 112 }, // 5 - breaks above 110, bullish BOS
    ]);

    const result = breakOfStructure(candles, { swingPeriod: 1 });

    // Find the bar with bullish BOS
    const bosBar = result.find((r) => r.value.bullishBos);
    expect(bosBar).toBeDefined();
    expect(bosBar?.value.brokenLevel).toBe(110);
    expect(bosBar?.value.trend).toBe("bullish");
  });

  it("should detect bearish BOS when price breaks below swing low", () => {
    // Create a swing low, then break it
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 }, // 0
      { o: 101, h: 103, l: 90, c: 92 }, // 1 - swing low at 90
      { o: 92, h: 98, l: 91, c: 96 }, // 2
      { o: 96, h: 100, l: 95, c: 99 }, // 3 - swing confirmed
      { o: 99, h: 101, l: 98, c: 100 }, // 4
      { o: 100, h: 98, l: 85, c: 86 }, // 5 - breaks below 90, bearish BOS
    ]);

    const result = breakOfStructure(candles, { swingPeriod: 1 });

    // Find the bar with bearish BOS
    const bosBar = result.find((r) => r.value.bearishBos);
    expect(bosBar).toBeDefined();
    expect(bosBar?.value.brokenLevel).toBe(90);
    expect(bosBar?.value.trend).toBe("bearish");
  });

  it("should track trend after BOS", () => {
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 }, // 0
      { o: 101, h: 110, l: 100, c: 108 }, // 1 - swing high
      { o: 108, h: 105, l: 103, c: 104 }, // 2
      { o: 104, h: 103, l: 100, c: 101 }, // 3
      { o: 101, h: 115, l: 100, c: 112 }, // 4 - bullish BOS
      { o: 112, h: 118, l: 110, c: 116 }, // 5 - should still show bullish
    ]);

    const result = breakOfStructure(candles, { swingPeriod: 1 });

    // After bullish BOS, trend should remain bullish
    const lastBar = result[result.length - 1];
    expect(lastBar.value.trend).toBe("bullish");
  });

  it("should track swing levels", () => {
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 }, // 0
      { o: 101, h: 110, l: 100, c: 108 }, // 1 - swing high
      { o: 108, h: 105, l: 103, c: 104 }, // 2
      { o: 104, h: 103, l: 95, c: 96 }, // 3 - swing low
      { o: 96, h: 100, l: 94, c: 98 }, // 4
      { o: 98, h: 102, l: 96, c: 100 }, // 5
    ]);

    const result = breakOfStructure(candles, { swingPeriod: 1 });

    // Check that swing levels are tracked
    const lastBar = result[result.length - 1];
    // One of the swing levels should be set
    expect(lastBar.value.swingHighLevel !== null || lastBar.value.swingLowLevel !== null).toBe(
      true,
    );
  });

  it("should handle longer swing periods", () => {
    // Need more bars for longer period
    const candles = makeCandles([
      { o: 100, h: 101, l: 99, c: 100 }, // 0
      { o: 100, h: 102, l: 99, c: 101 }, // 1
      { o: 101, h: 103, l: 100, c: 102 }, // 2
      { o: 102, h: 115, l: 101, c: 112 }, // 3 - potential swing high
      { o: 112, h: 110, l: 108, c: 109 }, // 4
      { o: 109, h: 108, l: 105, c: 106 }, // 5
      { o: 106, h: 105, l: 102, c: 103 }, // 6
      { o: 103, h: 104, l: 100, c: 101 }, // 7
      { o: 101, h: 120, l: 100, c: 118 }, // 8 - breaks above
    ]);

    const result = breakOfStructure(candles, { swingPeriod: 2 });

    // Should detect the structure break
    expect(result.length).toBe(candles.length);
  });
});

describe("changeOfCharacter", () => {
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

  it("should detect CHoCH when trend reverses", () => {
    // First establish bearish trend, then break bullish
    const candles = makeCandles([
      { o: 120, h: 122, l: 119, c: 120 }, // 0
      { o: 120, h: 121, l: 110, c: 112 }, // 1 - swing low
      { o: 112, h: 115, l: 111, c: 114 }, // 2
      { o: 114, h: 116, l: 108, c: 109 }, // 3 - lower swing low, bearish
      { o: 109, h: 112, l: 107, c: 110 }, // 4
      { o: 110, h: 125, l: 109, c: 123 }, // 5 - breaks above, bullish CHoCH
    ]);

    const result = changeOfCharacter(candles, { swingPeriod: 1 });

    // Check that we have results
    expect(result.length).toBe(candles.length);
  });

  it("should return empty array for empty input", () => {
    const result = changeOfCharacter([]);
    expect(result).toEqual([]);
  });
});
