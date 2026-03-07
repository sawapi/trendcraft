import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { fibonacciRetracement } from "../price/fibonacci-retracement";

describe("fibonacciRetracement", () => {
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

  it("should return empty array for empty input", () => {
    const result = fibonacciRetracement([]);
    expect(result).toEqual([]);
  });

  it("should return null levels when not enough data for swing points", () => {
    // Only 3 candles, not enough for leftBars=10, rightBars=10
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 },
      { o: 102, h: 110, l: 100, c: 108 },
      { o: 108, h: 112, l: 106, c: 110 },
    ]);

    const result = fibonacciRetracement(candles);

    expect(result.length).toBe(3);
    for (const r of result) {
      expect(r.value.levels).toBeNull();
      expect(r.value.trend).toBeNull();
    }
  });

  it("should calculate uptrend retracement levels (swing high after swing low)", () => {
    // Create data where swing low comes first, then swing high
    // leftBars=1, rightBars=1 for simpler testing
    // Pattern: descend to low, then ascend to high, then pull back
    const candles = makeCandles([
      { o: 110, h: 115, l: 108, c: 112 }, // 0
      { o: 112, h: 113, l: 80, c: 82 }, // 1 - swing low (80)
      { o: 82, h: 90, l: 85, c: 88 }, // 2
      { o: 88, h: 120, l: 86, c: 118 }, // 3 - swing high (120)
      { o: 118, h: 115, l: 110, c: 112 }, // 4 - levels should be calculated
    ]);

    const result = fibonacciRetracement(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.trend).toBe("up");
    expect(last.swingHigh).toBe(120);
    expect(last.swingLow).toBe(80);
    expect(last.levels).not.toBeNull();

    // range = 120 - 80 = 40
    // up trend: level = swingHigh - ratio * range
    expect(last.levels?.["0"]).toBeCloseTo(120); // 0%: 120 - 0*40 = 120
    expect(last.levels?.["0.236"]).toBeCloseTo(110.56); // 23.6%: 120 - 0.236*40 = 110.56
    expect(last.levels?.["0.382"]).toBeCloseTo(104.72); // 38.2%: 120 - 0.382*40 = 104.72
    expect(last.levels?.["0.5"]).toBeCloseTo(100); // 50%: 120 - 0.5*40 = 100
    expect(last.levels?.["0.618"]).toBeCloseTo(95.28); // 61.8%: 120 - 0.618*40 = 95.28
    expect(last.levels?.["0.786"]).toBeCloseTo(88.56); // 78.6%: 120 - 0.786*40 = 88.56
    expect(last.levels?.["1"]).toBeCloseTo(80); // 100%: 120 - 1*40 = 80
  });

  it("should calculate downtrend retracement levels (swing low after swing high)", () => {
    // Create data where swing high comes first, then swing low
    const candles = makeCandles([
      { o: 90, h: 92, l: 88, c: 91 }, // 0
      { o: 91, h: 120, l: 90, c: 118 }, // 1 - swing high (120)
      { o: 118, h: 115, l: 105, c: 108 }, // 2
      { o: 108, h: 105, l: 80, c: 82 }, // 3 - swing low (80)
      { o: 82, h: 90, l: 85, c: 88 }, // 4 - levels should be calculated
    ]);

    const result = fibonacciRetracement(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.trend).toBe("down");
    expect(last.swingHigh).toBe(120);
    expect(last.swingLow).toBe(80);
    expect(last.levels).not.toBeNull();

    // range = 120 - 80 = 40
    // down trend: level = swingLow + ratio * range
    expect(last.levels?.["0"]).toBeCloseTo(80); // 0%: 80 + 0*40 = 80
    expect(last.levels?.["0.236"]).toBeCloseTo(89.44); // 23.6%: 80 + 0.236*40 = 89.44
    expect(last.levels?.["0.382"]).toBeCloseTo(95.28); // 38.2%: 80 + 0.382*40 = 95.28
    expect(last.levels?.["0.5"]).toBeCloseTo(100); // 50%: 80 + 0.5*40 = 100
    expect(last.levels?.["0.618"]).toBeCloseTo(104.72); // 61.8%: 80 + 0.618*40 = 104.72
    expect(last.levels?.["0.786"]).toBeCloseTo(111.44); // 78.6%: 80 + 0.786*40 = 111.44
    expect(last.levels?.["1"]).toBeCloseTo(120); // 100%: 80 + 1*40 = 120
  });

  it("should support custom levels", () => {
    const candles = makeCandles([
      { o: 110, h: 115, l: 108, c: 112 },
      { o: 112, h: 113, l: 80, c: 82 }, // swing low
      { o: 82, h: 90, l: 85, c: 88 },
      { o: 88, h: 120, l: 86, c: 118 }, // swing high
      { o: 118, h: 115, l: 110, c: 112 },
    ]);

    const result = fibonacciRetracement(candles, {
      leftBars: 1,
      rightBars: 1,
      levels: [0, 0.5, 1],
    });
    const last = result[result.length - 1].value;

    expect(last.levels).not.toBeNull();
    // Only 3 levels should be present
    expect(Object.keys(last.levels!)).toHaveLength(3);
    expect(last.levels?.["0"]).toBeCloseTo(120);
    expect(last.levels?.["0.5"]).toBeCloseTo(100);
    expect(last.levels?.["1"]).toBeCloseTo(80);
  });

  it("should update levels when new swing points are confirmed", () => {
    // Longer dataset with multiple swing points
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 103 }, // 0
      { o: 103, h: 104, l: 80, c: 82 }, // 1 - first swing low (80)
      { o: 82, h: 90, l: 85, c: 88 }, // 2
      { o: 88, h: 120, l: 86, c: 118 }, // 3 - first swing high (120)
      { o: 118, h: 115, l: 110, c: 112 }, // 4
      { o: 112, h: 113, l: 70, c: 72 }, // 5 - second swing low (70)
      { o: 72, h: 78, l: 74, c: 76 }, // 6
    ]);

    const result = fibonacciRetracement(candles, { leftBars: 1, rightBars: 1 });

    // After bar 4: uptrend (swing high at 3 > swing low at 1)
    const atBar4 = result[4].value;
    expect(atBar4.trend).toBe("up");
    expect(atBar4.swingHigh).toBe(120);
    expect(atBar4.swingLow).toBe(80);

    // After bar 6: downtrend (swing low at 5 > swing high at 3)
    const atBar6 = result[6].value;
    expect(atBar6.trend).toBe("down");
    expect(atBar6.swingHigh).toBe(120);
    expect(atBar6.swingLow).toBe(70);
  });
});
