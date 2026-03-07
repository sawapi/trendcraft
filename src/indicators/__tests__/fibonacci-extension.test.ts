import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { fibonacciExtension } from "../price/fibonacci-extension";

describe("fibonacciExtension", () => {
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
    const result = fibonacciExtension([]);
    expect(result).toEqual([]);
  });

  it("should return null levels when not enough swing points", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 },
      { o: 102, h: 110, l: 100, c: 108 },
      { o: 108, h: 112, l: 106, c: 110 },
    ]);

    const result = fibonacciExtension(candles);
    expect(result.length).toBe(3);
    for (const r of result) {
      expect(r.value.levels).toBeNull();
      expect(r.value.direction).toBeNull();
    }
  });

  it("should calculate bullish extension (Low→High→Low)", () => {
    // A=Low(70) at idx 1, B=High(130) at idx 3, C=Low(90) at idx 5
    // C(90) > A(70) and C(90) < B(130) → valid bullish retracement
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 101 }, // 0
      { o: 101, h: 102, l: 70, c: 72 }, // 1 - swing low A (70)
      { o: 72, h: 110, l: 80, c: 108 }, // 2
      { o: 108, h: 130, l: 100, c: 128 }, // 3 - swing high B (130)
      { o: 128, h: 125, l: 95, c: 98 }, // 4
      { o: 98, h: 100, l: 90, c: 95 }, // 5 - swing low C (90)
      { o: 95, h: 105, l: 93, c: 102 }, // 6
    ]);

    const result = fibonacciExtension(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.direction).toBe("bullish");
    expect(last.pointA).toBe(70);
    expect(last.pointB).toBe(130);
    expect(last.pointC).toBe(90);
    expect(last.levels).not.toBeNull();

    // move = |130 - 70| = 60
    // bullish: level = C + ratio * move = 90 + ratio * 60
    expect(last.levels?.["0"]).toBeCloseTo(90); // 0%
    expect(last.levels?.["0.618"]).toBeCloseTo(127.08); // 61.8%
    expect(last.levels?.["1"]).toBeCloseTo(150); // 100%
    expect(last.levels?.["1.272"]).toBeCloseTo(166.32); // 127.2%
    expect(last.levels?.["1.618"]).toBeCloseTo(187.08); // 161.8%
    expect(last.levels?.["2"]).toBeCloseTo(210); // 200%
    expect(last.levels?.["2.618"]).toBeCloseTo(247.08); // 261.8%
  });

  it("should calculate bearish extension (High→Low→High)", () => {
    // A=High(130) at idx 1, B=Low(70) at idx 3, C=High(110) at idx 5
    // C(110) < A(130) and C(110) > B(70) → valid bearish retracement
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 101 }, // 0
      { o: 101, h: 130, l: 99, c: 128 }, // 1 - swing high A (130)
      { o: 128, h: 125, l: 75, c: 78 }, // 2
      { o: 78, h: 85, l: 70, c: 80 }, // 3 - swing low B (70)
      { o: 80, h: 100, l: 78, c: 98 }, // 4
      { o: 98, h: 110, l: 95, c: 108 }, // 5 - swing high C (110)
      { o: 108, h: 105, l: 90, c: 92 }, // 6
    ]);

    const result = fibonacciExtension(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.direction).toBe("bearish");
    expect(last.pointA).toBe(130);
    expect(last.pointB).toBe(70);
    expect(last.pointC).toBe(110);
    expect(last.levels).not.toBeNull();

    // move = |70 - 130| = 60
    // bearish: level = C - ratio * move = 110 - ratio * 60
    expect(last.levels?.["0"]).toBeCloseTo(110); // 0%
    expect(last.levels?.["1"]).toBeCloseTo(50); // 100%
    expect(last.levels?.["1.618"]).toBeCloseTo(12.92); // 161.8%
  });

  it("should support custom levels", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 101 },
      { o: 101, h: 102, l: 70, c: 72 }, // swing low A
      { o: 72, h: 110, l: 80, c: 108 },
      { o: 108, h: 130, l: 100, c: 128 }, // swing high B
      { o: 128, h: 125, l: 95, c: 98 },
      { o: 98, h: 100, l: 90, c: 95 }, // swing low C
      { o: 95, h: 105, l: 93, c: 102 },
    ]);

    const result = fibonacciExtension(candles, {
      leftBars: 1,
      rightBars: 1,
      levels: [0, 1, 2],
    });
    const last = result[result.length - 1].value;

    expect(last.levels).not.toBeNull();
    expect(Object.keys(last.levels!)).toHaveLength(3);
  });

  it("should reject invalid retracement (C not between A and B)", () => {
    // A=Low(80) at idx 1, B=High(100) at idx 3, C=Low(70) at idx 5
    // C(70) < A(80), so NOT a valid retracement
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 101 },
      { o: 101, h: 102, l: 80, c: 82 }, // swing low A (80)
      { o: 82, h: 95, l: 85, c: 93 },
      { o: 93, h: 100, l: 88, c: 98 }, // swing high B (100)
      { o: 98, h: 95, l: 75, c: 78 },
      { o: 78, h: 80, l: 70, c: 75 }, // swing low C (70) < A=80, invalid
      { o: 75, h: 85, l: 73, c: 80 },
    ]);

    const result = fibonacciExtension(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.levels).toBeNull();
  });
});
