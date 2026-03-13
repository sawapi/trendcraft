import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { gapAnalysis } from "../price/gap-analysis";

describe("gapAnalysis", () => {
  const makeCandles = (
    data: Array<{ open: number; high: number; low: number; close: number }>,
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should return empty for empty input", () => {
    expect(gapAnalysis([])).toEqual([]);
  });

  it("should return no gap for first candle", () => {
    const candles = makeCandles([{ open: 100, high: 110, low: 90, close: 100 }]);
    const result = gapAnalysis(candles);
    expect(result[0].value.type).toBeNull();
  });

  it("should detect gap up (full)", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 100 },
      { open: 115, high: 120, low: 112, close: 118 }, // Open > prev High (110)
    ]);

    const result = gapAnalysis(candles, { minGapPercent: 0 });

    expect(result[1].value.type).toBe("up");
    expect(result[1].value.gapPercent).toBe(15); // (115-100)/100 * 100
    expect(result[1].value.classification).toBe("full");
  });

  it("should detect gap up (partial)", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 100 },
      { open: 105, high: 115, low: 103, close: 112 }, // Open > prev Close but < prev High
    ]);

    const result = gapAnalysis(candles, { minGapPercent: 0 });

    expect(result[1].value.type).toBe("up");
    expect(result[1].value.classification).toBe("partial");
  });

  it("should detect gap down (full)", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 100 },
      { open: 85, high: 88, low: 82, close: 86 }, // Open < prev Low (90)
    ]);

    const result = gapAnalysis(candles, { minGapPercent: 0 });

    expect(result[1].value.type).toBe("down");
    expect(result[1].value.gapPercent).toBe(15); // (100-85)/100 * 100
    expect(result[1].value.classification).toBe("full");
  });

  it("should detect gap down (partial)", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 100 },
      { open: 95, high: 98, low: 92, close: 96 }, // Open < prev Close but > prev Low
    ]);

    const result = gapAnalysis(candles, { minGapPercent: 0 });

    expect(result[1].value.type).toBe("down");
    expect(result[1].value.classification).toBe("partial");
  });

  it("should filter gaps below minimum percentage", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 100 },
      { open: 100.3, high: 105, low: 99, close: 103 }, // 0.3% gap, below 0.5% threshold
    ]);

    const result = gapAnalysis(candles); // default minGapPercent = 0.5
    expect(result[1].value.type).toBeNull();
  });

  it("should track gap fill", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 100 },
      { open: 115, high: 120, low: 112, close: 118 }, // Gap up, prev close = 100
      { open: 118, high: 119, low: 116, close: 117 }, // Not filled (low 116 > 100)
      { open: 117, high: 117, low: 98, close: 99 }, // Filled! (low 98 <= 100)
    ]);

    const result = gapAnalysis(candles, { minGapPercent: 0 });

    // Gap at index 1 should eventually be marked as filled
    expect(result[1].value.filled).toBe(true);
  });

  it("should handle no gap when prices are continuous", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 100 },
      { open: 100, high: 108, low: 92, close: 105 },
      { open: 105, high: 112, low: 98, close: 108 },
    ]);

    const result = gapAnalysis(candles);
    expect(result[1].value.type).toBeNull();
    expect(result[2].value.type).toBeNull();
  });
});
