import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { candlestickPatterns } from "../index";

describe("double candle patterns", () => {
  const makeCandle = (
    time: number,
    open: number,
    high: number,
    low: number,
    close: number,
  ): NormalizedCandle => ({
    time,
    open,
    high,
    low,
    close,
    volume: 1000,
  });

  const withDowntrend = (testCandles: NormalizedCandle[]): NormalizedCandle[] => {
    const trend: NormalizedCandle[] = [];
    for (let i = 0; i < 5; i++) {
      const price = 120 - i * 5;
      trend.push(makeCandle(1000 + i, price + 2, price + 3, price - 1, price));
    }
    return [...trend, ...testCandles];
  };

  const withUptrend = (testCandles: NormalizedCandle[]): NormalizedCandle[] => {
    const trend: NormalizedCandle[] = [];
    for (let i = 0; i < 5; i++) {
      const price = 80 + i * 5;
      trend.push(makeCandle(1000 + i, price - 2, price + 1, price - 3, price));
    }
    return [...trend, ...testCandles];
  };

  it("should detect bullish engulfing in downtrend", () => {
    const candles = withDowntrend([
      makeCandle(2000, 100, 101, 98, 99), // bearish
      makeCandle(2001, 97, 103, 96, 102), // bullish engulfing
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "bullish_engulfing");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
    expect(pattern?.candleCount).toBe(2);
  });

  it("should detect bearish engulfing in uptrend", () => {
    const candles = withUptrend([
      makeCandle(2000, 99, 102, 98, 101), // bullish
      makeCandle(2001, 103, 104, 96, 97), // bearish engulfing
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "bearish_engulfing");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect bullish harami in downtrend", () => {
    const candles = withDowntrend([
      makeCandle(2000, 105, 106, 95, 96), // large bearish
      makeCandle(2001, 98, 102, 97, 101), // small bullish inside
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "bullish_harami");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect bearish harami in uptrend", () => {
    const candles = withUptrend([
      makeCandle(2000, 95, 106, 94, 105), // large bullish
      makeCandle(2001, 103, 104, 97, 98), // small bearish inside
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "bearish_harami");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect tweezer top in uptrend", () => {
    const candles = withUptrend([
      makeCandle(2000, 98, 105, 97, 104), // bullish
      makeCandle(2001, 104, 105, 99, 100), // bearish, same high
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "tweezer_top");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect tweezer bottom in downtrend", () => {
    const candles = withDowntrend([
      makeCandle(2000, 102, 103, 95, 96), // bearish
      makeCandle(2001, 96, 101, 95, 100), // bullish, same low
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "tweezer_bottom");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect piercing line in downtrend", () => {
    const candles = withDowntrend([
      makeCandle(2000, 105, 106, 98, 99), // bearish
      makeCandle(2001, 97, 104, 96, 103), // opens below prev low, closes above prev midpoint
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "piercing_line");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect dark cloud cover in uptrend", () => {
    const candles = withUptrend([
      makeCandle(2000, 99, 105, 98, 104), // bullish
      makeCandle(2001, 106, 107, 100, 100), // opens above prev high, closes below midpoint
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "dark_cloud_cover");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should not detect double patterns at index 0", () => {
    const candles = [makeCandle(1000, 100, 105, 95, 102)];
    const result = candlestickPatterns(candles, { requireTrend: false });

    // No double patterns should be detected on a single candle
    const doublePatterns = result[0].value.patterns.filter((p) => p.candleCount === 2);
    expect(doublePatterns).toHaveLength(0);
  });
});
