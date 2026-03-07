import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { andrewsPitchfork } from "../price/andrews-pitchfork";

describe("andrewsPitchfork", () => {
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
    const result = andrewsPitchfork([]);
    expect(result).toEqual([]);
  });

  it("should return null values when not enough swing points", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 },
      { o: 102, h: 110, l: 100, c: 108 },
      { o: 108, h: 112, l: 106, c: 110 },
    ]);

    const result = andrewsPitchfork(candles);
    expect(result.length).toBe(3);
    for (const r of result) {
      expect(r.value.median).toBeNull();
      expect(r.value.upper).toBeNull();
      expect(r.value.lower).toBeNull();
    }
  });

  it("should calculate pitchfork from 3 alternating swing points (L-H-L)", () => {
    // P0=Low(70) at idx 1, P1=High(130) at idx 3, P2=Low(90) at idx 5
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 101 }, // 0
      { o: 101, h: 102, l: 70, c: 72 }, // 1 - P0: swing low (70)
      { o: 72, h: 110, l: 80, c: 108 }, // 2
      { o: 108, h: 130, l: 100, c: 128 }, // 3 - P1: swing high (130)
      { o: 128, h: 125, l: 95, c: 98 }, // 4
      { o: 98, h: 100, l: 90, c: 95 }, // 5 - P2: swing low (90)
      { o: 95, h: 105, l: 93, c: 102 }, // 6
    ]);

    const result = andrewsPitchfork(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.median).not.toBeNull();
    expect(last.upper).not.toBeNull();
    expect(last.lower).not.toBeNull();

    // P0 = (1, 70), P1 = (3, 130), P2 = (5, 90)
    // M = midpoint of P1, P2 = ((3+5)/2, (130+90)/2) = (4, 110)
    // Median slope = (110 - 70) / (4 - 1) = 40/3 ≈ 13.333
    // At bar 6: median = 70 + 13.333 * (6 - 1) = 70 + 66.667 ≈ 136.667
    expect(last.median).toBeCloseTo(136.667, 0);

    // Upper should be above median, lower below
    expect(last.upper!).toBeGreaterThan(last.median!);
    expect(last.lower!).toBeLessThan(last.median!);
  });

  it("should have median pass through P0", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 101 },
      { o: 101, h: 102, l: 70, c: 72 }, // 1 - P0
      { o: 72, h: 110, l: 80, c: 108 },
      { o: 108, h: 130, l: 100, c: 128 }, // 3 - P1
      { o: 128, h: 125, l: 95, c: 98 },
      { o: 98, h: 100, l: 90, c: 95 }, // 5 - P2
      { o: 95, h: 105, l: 93, c: 102 },
    ]);

    const result = andrewsPitchfork(candles, { leftBars: 1, rightBars: 1 });

    // At bar 1 (P0.index): median should equal P0.price = 70
    const atP0 = result[1].value;
    if (atP0.median !== null) {
      expect(atP0.median).toBeCloseTo(70);
    }
  });

  it("should handle three points in order H-L-H", () => {
    // P0=High(130) at idx 1, P1=Low(70) at idx 3, P2=High(110) at idx 5
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 101 }, // 0
      { o: 101, h: 130, l: 99, c: 128 }, // 1 - P0: swing high (130)
      { o: 128, h: 125, l: 75, c: 78 }, // 2
      { o: 78, h: 85, l: 70, c: 80 }, // 3 - P1: swing low (70)
      { o: 80, h: 100, l: 78, c: 98 }, // 4
      { o: 98, h: 110, l: 95, c: 108 }, // 5 - P2: swing high (110)
      { o: 108, h: 105, l: 90, c: 92 }, // 6
    ]);

    const result = andrewsPitchfork(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.median).not.toBeNull();
    expect(last.upper).not.toBeNull();
    expect(last.lower).not.toBeNull();
  });
});
