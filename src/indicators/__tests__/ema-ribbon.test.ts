import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { emaRibbon } from "../moving-average/ema-ribbon";

describe("emaRibbon", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    }));

  it("should return empty for empty input", () => {
    expect(emaRibbon([])).toEqual([]);
  });

  it("should throw if fewer than 2 periods", () => {
    const candles = makeCandles([100]);
    expect(() => emaRibbon(candles, { periods: [8] })).toThrow();
  });

  it("should return null bullish/expanding for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = emaRibbon(candles, { periods: [3, 5, 8] });

    // With period 8, first 7 values have nulls
    expect(result[0].value.bullish).toBeNull();
    expect(result[0].value.expanding).toBeNull();
  });

  it("should detect bullish alignment in strong uptrend", () => {
    const closes: number[] = [];
    for (let i = 0; i < 100; i++) {
      closes.push(100 + i * 3);
    }
    const candles = makeCandles(closes);
    const result = emaRibbon(candles, { periods: [5, 10, 20] });

    // After warmup, should be bullish in a strong uptrend
    const last = result[result.length - 1].value;
    expect(last.bullish).toBe(true);
  });

  it("should have correct number of values per bar", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = emaRibbon(candles, { periods: [2, 3, 4] });

    result.forEach((r) => {
      expect(r.value.values).toHaveLength(3);
    });
  });

  it("should sort periods ascending", () => {
    const closes: number[] = [];
    for (let i = 0; i < 30; i++) {
      closes.push(100 + i);
    }
    const candles = makeCandles(closes);
    // Pass unsorted periods
    const result = emaRibbon(candles, { periods: [10, 3, 5] });

    // values should be [EMA(3), EMA(5), EMA(10)] (sorted ascending)
    // In uptrend, EMA(3) should be above EMA(10)
    const last = result[result.length - 1].value;
    if (last.values[0] !== null && last.values[2] !== null) {
      expect(last.values[0]!).toBeGreaterThan(last.values[2]!);
    }
  });

  it("should preserve timestamps", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = emaRibbon(candles, { periods: [2, 3] });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
