import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { autoTrendLine } from "../price/auto-trend-line";

describe("autoTrendLine", () => {
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

  it("should return empty array for empty input", () => {
    const result = autoTrendLine([]);
    expect(result).toEqual([]);
  });

  it("should return null values when not enough swing points", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 },
      { o: 102, h: 110, l: 100, c: 108 },
      { o: 108, h: 112, l: 106, c: 110 },
    ]);

    const result = autoTrendLine(candles);
    expect(result.length).toBe(3);
    for (const r of result) {
      expect(r.value.resistance).toBeNull();
      expect(r.value.support).toBeNull();
    }
  });

  it("should calculate resistance line from two swing highs", () => {
    // Two swing highs at idx 1 (110) and idx 3 (120)
    const candles = makeCandles([
      { o: 95, h: 97, l: 93, c: 96 },   // 0
      { o: 96, h: 110, l: 95, c: 108 },  // 1 - swing high (110)
      { o: 108, h: 105, l: 90, c: 92 },  // 2
      { o: 92, h: 120, l: 91, c: 118 },  // 3 - swing high (120)
      { o: 118, h: 115, l: 110, c: 112 }, // 4
    ]);

    const result = autoTrendLine(candles, { leftBars: 1, rightBars: 1 });

    // After second swing high at idx 3, resistance line should be defined
    const last = result[result.length - 1].value;
    expect(last.resistance).not.toBeNull();

    // Slope = (120 - 110) / (3 - 1) = 5
    // At bar 4: 110 + 5 * (4 - 1) = 125
    expect(last.resistance).toBeCloseTo(125);
  });

  it("should calculate support line from two swing lows", () => {
    // Need enough candles so that two swing lows are confirmed
    // leftBars=1, rightBars=1: valid indices 1..len-2
    // Swing low at idx 1 (80) and idx 5 (85)
    const candles = makeCandles([
      { o: 110, h: 115, l: 108, c: 112 },  // 0
      { o: 112, h: 113, l: 80, c: 82 },    // 1 - swing low (80)
      { o: 82, h: 120, l: 95, c: 118 },    // 2 - swing high
      { o: 118, h: 115, l: 100, c: 105 },  // 3
      { o: 105, h: 110, l: 98, c: 108 },   // 4
      { o: 108, h: 109, l: 85, c: 87 },    // 5 - swing low (85)
      { o: 87, h: 100, l: 90, c: 98 },     // 6
    ]);

    const result = autoTrendLine(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;
    expect(last.support).not.toBeNull();

    // Slope = (85 - 80) / (5 - 1) = 1.25
    // At bar 6: 80 + 1.25 * (6 - 1) = 86.25
    expect(last.support).toBeCloseTo(86.25);
  });

  it("should return null resistance/support before enough data", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 },
      { o: 102, h: 110, l: 100, c: 108 }, // 1 swing high only
      { o: 108, h: 105, l: 90, c: 92 },
    ]);

    const result = autoTrendLine(candles, { leftBars: 1, rightBars: 1 });
    // Only one swing high, no resistance line yet
    for (const r of result) {
      expect(r.value.resistance).toBeNull();
    }
  });
});
