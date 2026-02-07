import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { candlestickPatterns } from "../index";

describe("triple candle patterns", () => {
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

  it("should detect morning star in downtrend", () => {
    const candles = withDowntrend([
      makeCandle(2000, 105, 106, 98, 99), // large bearish
      makeCandle(2001, 97, 98, 96, 97.5), // small body, gaps down
      makeCandle(2002, 98, 106, 97, 104), // large bullish, closes into first body
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "morning_star");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
    expect(pattern?.candleCount).toBe(3);
  });

  it("should detect evening star in uptrend", () => {
    const candles = withUptrend([
      makeCandle(2000, 99, 106, 98, 105), // large bullish
      makeCandle(2001, 106, 108, 105, 106.5), // small body, gaps up
      makeCandle(2002, 105, 106, 98, 100), // large bearish, closes into first body
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "evening_star");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect three white soldiers", () => {
    const candles = [
      makeCandle(1000, 100, 106, 99, 105), // bullish
      makeCandle(1001, 103, 111, 102, 110), // opens within prev body, higher close
      makeCandle(1002, 108, 116, 107, 115), // opens within prev body, higher close
    ];
    const result = candlestickPatterns(candles, { requireTrend: false });
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "three_white_soldiers");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
    expect(pattern?.confidence).toBe(85);
  });

  it("should detect three black crows", () => {
    const candles = [
      makeCandle(1000, 115, 116, 108, 110), // bearish
      makeCandle(1001, 112, 113, 103, 105), // opens within prev body, lower close
      makeCandle(1002, 107, 108, 98, 100), // opens within prev body, lower close
    ];
    const result = candlestickPatterns(candles, { requireTrend: false });
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "three_black_crows");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect three inside up in downtrend", () => {
    const candles = withDowntrend([
      makeCandle(2000, 105, 106, 95, 96), // large bearish
      makeCandle(2001, 98, 103, 97, 102), // small bullish inside prev body
      makeCandle(2002, 103, 108, 102, 107), // bullish, close above c0 open
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "three_inside_up");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect three inside down in uptrend", () => {
    const candles = withUptrend([
      makeCandle(2000, 95, 106, 94, 105), // large bullish
      makeCandle(2001, 103, 104, 97, 98), // small bearish inside prev body
      makeCandle(2002, 97, 98, 90, 93), // bearish, close below c0 open
    ]);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "three_inside_down");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should not detect triple patterns with fewer than 3 candles", () => {
    const candles = [makeCandle(1000, 100, 105, 95, 102), makeCandle(1001, 102, 107, 97, 104)];
    const result = candlestickPatterns(candles, { requireTrend: false });

    for (const r of result) {
      const triplePatterns = r.value.patterns.filter((p) => p.candleCount === 3);
      expect(triplePatterns).toHaveLength(0);
    }
  });

  it("should not false-positive on random candles", () => {
    // Create candles that should NOT trigger morning star
    // (no gap down between c0 and c1)
    const candles = [
      makeCandle(1000, 100, 105, 98, 99),
      makeCandle(1001, 100, 103, 99, 100), // No gap, body not small enough relative to range for some
      makeCandle(1002, 101, 106, 100, 105),
    ];
    const result = candlestickPatterns(candles, { requireTrend: false });
    const last = result[result.length - 1].value;

    const morningStar = last.patterns.find((p) => p.name === "morning_star");
    expect(morningStar).toBeUndefined();
  });
});
