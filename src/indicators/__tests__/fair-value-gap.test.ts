import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { fairValueGap, getNearestFvg, getUnfilledFvgs } from "../price/fair-value-gap";

describe("fairValueGap", () => {
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

  it("should throw if minGapPercent is negative", () => {
    const candles = makeCandles([{ o: 100, h: 105, l: 95, c: 102 }]);
    expect(() => fairValueGap(candles, { minGapPercent: -1 })).toThrow(
      "minGapPercent must be non-negative",
    );
  });

  it("should throw if maxActiveFvgs is less than 1", () => {
    const candles = makeCandles([{ o: 100, h: 105, l: 95, c: 102 }]);
    expect(() => fairValueGap(candles, { maxActiveFvgs: 0 })).toThrow(
      "maxActiveFvgs must be at least 1",
    );
  });

  it("should return empty array for empty input", () => {
    const result = fairValueGap([]);
    expect(result).toEqual([]);
  });

  it("should detect bullish FVG (gap up)", () => {
    // Bullish FVG: candle[0].high < candle[2].low
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 104 }, // 0 - high = 105
      { o: 108, h: 115, l: 107, c: 114 }, // 1 - middle candle (big move)
      { o: 116, h: 120, l: 110, c: 118 }, // 2 - low = 110, gap: 105-110
    ]);

    const result = fairValueGap(candles);

    expect(result[2].value.newBullishFvg).toBe(true);
    expect(result[2].value.newFvg).not.toBeNull();
    expect(result[2].value.newFvg?.type).toBe("bullish");
    expect(result[2].value.newFvg?.low).toBe(105); // candle[0].high
    expect(result[2].value.newFvg?.high).toBe(110); // candle[2].low
  });

  it("should detect bearish FVG (gap down)", () => {
    // Bearish FVG: candle[0].low > candle[2].high
    const candles = makeCandles([
      { o: 120, h: 122, l: 115, c: 116 }, // 0 - low = 115
      { o: 110, h: 112, l: 105, c: 106 }, // 1 - middle candle (big move down)
      { o: 104, h: 108, l: 100, c: 102 }, // 2 - high = 108, gap: 108-115
    ]);

    const result = fairValueGap(candles);

    expect(result[2].value.newBearishFvg).toBe(true);
    expect(result[2].value.newFvg).not.toBeNull();
    expect(result[2].value.newFvg?.type).toBe("bearish");
    expect(result[2].value.newFvg?.high).toBe(115); // candle[0].low
    expect(result[2].value.newFvg?.low).toBe(108); // candle[2].high
  });

  it("should not detect FVG when there is no gap", () => {
    // No gap: candle[0].high >= candle[2].low
    const candles = makeCandles([
      { o: 100, h: 110, l: 98, c: 108 }, // 0 - high = 110
      { o: 108, h: 112, l: 106, c: 110 }, // 1
      { o: 110, h: 115, l: 108, c: 114 }, // 2 - low = 108, overlaps with high
    ]);

    const result = fairValueGap(candles);

    expect(result[2].value.newBullishFvg).toBe(false);
    expect(result[2].value.newBearishFvg).toBe(false);
  });

  it("should track active FVGs", () => {
    // Candles designed so only one FVG is created at index 2
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 104 }, // 0 - high = 105
      { o: 108, h: 115, l: 107, c: 114 }, // 1
      { o: 116, h: 120, l: 110, c: 118 }, // 2 - low = 110, bullish FVG (105-110)
      { o: 118, h: 119, l: 117, c: 118 }, // 3 - no new FVG (117 > 110)
      { o: 118, h: 119, l: 117, c: 118 }, // 4 - no new FVG
    ]);

    const result = fairValueGap(candles);

    // FVG should remain active
    expect(result[4].value.activeBullishFvgs.length).toBe(1);
    expect(result[4].value.activeBullishFvgs[0].high).toBe(110);
    expect(result[4].value.activeBullishFvgs[0].low).toBe(105);
  });

  it("should mark FVG as filled when price returns", () => {
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 104 }, // 0 - high = 105
      { o: 108, h: 115, l: 107, c: 114 }, // 1
      { o: 116, h: 120, l: 110, c: 118 }, // 2 - low = 110, bullish FVG (105-110)
      { o: 118, h: 119, l: 117, c: 117 }, // 3 - price stays above, no new FVG
      { o: 117, h: 118, l: 106, c: 107 }, // 4 - price drops into FVG (fills)
    ]);

    const result = fairValueGap(candles);

    // FVG should be filled
    expect(result[4].value.filledFvgs.length).toBeGreaterThanOrEqual(1);
    const filledFvg = result[4].value.filledFvgs.find((f) => f.high === 110);
    expect(filledFvg).toBeDefined();
    expect(filledFvg?.filled).toBe(true);
    expect(filledFvg?.filledIndex).toBe(4);
  });

  it("should respect minGapPercent", () => {
    // Small gap that should be filtered out
    const candles = makeCandles([
      { o: 100, h: 100.5, l: 99, c: 100.3 }, // 0 - high = 100.5
      { o: 101, h: 102, l: 100.8, c: 101.5 }, // 1
      { o: 101.5, h: 103, l: 100.6, c: 102 }, // 2 - low = 100.6, gap = 0.1 (0.1%)
    ]);

    const result = fairValueGap(candles, { minGapPercent: 0.5 });

    // Gap is only 0.1%, should not be detected with 0.5% minimum
    expect(result[2].value.newBullishFvg).toBe(false);
  });

  it("should limit active FVGs to maxActiveFvgs", () => {
    // Create many FVGs
    const candles = makeCandles([
      { o: 100, h: 105, l: 98, c: 104 }, // 0
      { o: 108, h: 115, l: 107, c: 114 }, // 1
      { o: 118, h: 125, l: 117, c: 124 }, // 2 - FVG 1
      { o: 128, h: 135, l: 127, c: 134 }, // 3
      { o: 138, h: 145, l: 137, c: 144 }, // 4 - FVG 2
      { o: 148, h: 155, l: 147, c: 154 }, // 5
      { o: 158, h: 165, l: 157, c: 164 }, // 6 - FVG 3
    ]);

    const result = fairValueGap(candles, { maxActiveFvgs: 2 });

    // Should only keep 2 most recent FVGs
    expect(result[result.length - 1].value.activeBullishFvgs.length).toBeLessThanOrEqual(2);
  });

  describe("getUnfilledFvgs", () => {
    it("should return unfilled FVGs at end of series", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 98, c: 104 }, // 0 - high = 105
        { o: 108, h: 115, l: 107, c: 114 }, // 1
        { o: 116, h: 120, l: 110, c: 118 }, // 2 - low = 110, bullish FVG
      ]);

      const { bullish, bearish } = getUnfilledFvgs(candles);

      expect(bullish.length).toBe(1);
      expect(bearish.length).toBe(0);
    });

    it("should return empty arrays for empty input", () => {
      const { bullish, bearish } = getUnfilledFvgs([]);
      expect(bullish).toEqual([]);
      expect(bearish).toEqual([]);
    });
  });

  describe("getNearestFvg", () => {
    it("should find nearest FVG to current price", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 98, c: 104 }, // 0
        { o: 108, h: 115, l: 107, c: 114 }, // 1
        { o: 116, h: 120, l: 110, c: 118 }, // 2 - bullish FVG (105-110)
        { o: 118, h: 120, l: 116, c: 112 }, // 3 - close at 112, near FVG
      ]);

      const nearest = getNearestFvg(candles);

      expect(nearest).not.toBeNull();
      expect(nearest?.type).toBe("bullish");
    });

    it("should return null for empty input", () => {
      const nearest = getNearestFvg([]);
      expect(nearest).toBeNull();
    });

    it("should return null when no FVGs exist", () => {
      // No gaps
      const candles = makeCandles([
        { o: 100, h: 105, l: 98, c: 104 },
        { o: 104, h: 108, l: 102, c: 106 },
        { o: 106, h: 110, l: 104, c: 108 },
      ]);

      const nearest = getNearestFvg(candles);
      expect(nearest).toBeNull();
    });
  });
});
