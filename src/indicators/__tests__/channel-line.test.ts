import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { channelLine } from "../price/channel-line";

describe("channelLine", () => {
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
    const result = channelLine([]);
    expect(result).toEqual([]);
  });

  it("should return null values when not enough swing points", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 95, c: 102 },
      { o: 102, h: 110, l: 100, c: 108 },
      { o: 108, h: 112, l: 106, c: 110 },
    ]);

    const result = channelLine(candles);
    expect(result.length).toBe(3);
    for (const r of result) {
      expect(r.value.upper).toBeNull();
      expect(r.value.lower).toBeNull();
      expect(r.value.middle).toBeNull();
      expect(r.value.direction).toBeNull();
    }
  });

  it("should detect uptrend channel from ascending swing lows", () => {
    // Two ascending swing lows with a swing high between
    // idx 1: swing low (70), idx 3: swing high (130), idx 5: swing low (85)
    const candles = makeCandles([
      { o: 100, h: 102, l: 98, c: 101 },   // 0
      { o: 101, h: 103, l: 70, c: 72 },    // 1 - swing low (70)
      { o: 72, h: 110, l: 80, c: 108 },    // 2
      { o: 108, h: 130, l: 100, c: 128 },  // 3 - swing high (130)
      { o: 128, h: 125, l: 90, c: 92 },    // 4
      { o: 92, h: 100, l: 85, c: 95 },     // 5 - swing low (85) > 70 = uptrend
      { o: 95, h: 110, l: 93, c: 108 },    // 6
    ]);

    const result = channelLine(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.direction).toBe("up");
    expect(last.upper).not.toBeNull();
    expect(last.lower).not.toBeNull();
    expect(last.middle).not.toBeNull();
    expect(last.upper!).toBeGreaterThan(last.lower!);
    expect(last.middle!).toBeCloseTo((last.upper! + last.lower!) / 2);
  });

  it("should detect downtrend channel from descending swing highs", () => {
    // Two descending swing highs with swing low between
    // idx 1: swing high (130), idx 3: swing low (70), idx 5: swing high (120)
    const candles = makeCandles([
      { o: 100, h: 102, l: 98, c: 101 },   // 0
      { o: 101, h: 130, l: 99, c: 128 },   // 1 - swing high (130)
      { o: 128, h: 125, l: 75, c: 78 },    // 2
      { o: 78, h: 85, l: 70, c: 80 },      // 3 - swing low (70)
      { o: 80, h: 110, l: 78, c: 108 },    // 4
      { o: 108, h: 120, l: 95, c: 118 },   // 5 - swing high (120) < 130 = downtrend
      { o: 118, h: 115, l: 90, c: 92 },    // 6
    ]);

    const result = channelLine(candles, { leftBars: 1, rightBars: 1 });
    const last = result[result.length - 1].value;

    expect(last.direction).toBe("down");
    expect(last.upper).not.toBeNull();
    expect(last.lower).not.toBeNull();
  });
});
