import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { candlestickPatterns } from "../index";

describe("single candle patterns", () => {
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

  // Helper: create downtrend context (5 declining candles) + test candle
  const withDowntrend = (testCandle: NormalizedCandle): NormalizedCandle[] => {
    const trend: NormalizedCandle[] = [];
    for (let i = 0; i < 5; i++) {
      const price = 120 - i * 5;
      trend.push(makeCandle(1000 + i, price + 2, price + 3, price - 1, price));
    }
    return [...trend, testCandle];
  };

  // Helper: create uptrend context + test candle
  const withUptrend = (testCandle: NormalizedCandle): NormalizedCandle[] => {
    const trend: NormalizedCandle[] = [];
    for (let i = 0; i < 5; i++) {
      const price = 80 + i * 5;
      trend.push(makeCandle(1000 + i, price - 2, price + 1, price - 3, price));
    }
    return [...trend, testCandle];
  };

  it("should detect hammer in downtrend", () => {
    // Hammer: small body at top, long lower shadow, tiny upper shadow
    const hammer = makeCandle(2000, 100, 101, 90, 101);
    const candles = withDowntrend(hammer);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const hammerPattern = last.patterns.find((p) => p.name === "hammer");
    expect(hammerPattern).toBeDefined();
    expect(hammerPattern?.direction).toBe("bullish");
    expect(last.hasBullish).toBe(true);
  });

  it("should detect hanging man in uptrend", () => {
    // Same shape as hammer but in uptrend
    const hangingMan = makeCandle(2000, 100, 101, 90, 101);
    const candles = withUptrend(hangingMan);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "hanging_man");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect shooting star in uptrend", () => {
    // Small body at bottom, long upper shadow
    // body=2, upper shadow=12, lower shadow=0. upper>=body*2 ✓, lower<=body*0.5 ✓
    const star = makeCandle(2000, 102, 114, 100, 100);
    const candles = withUptrend(star);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "shooting_star");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect inverted hammer in downtrend", () => {
    // body=2, upper shadow=12, lower shadow=0. upper>=body*2 ✓, lower<=body*0.5 ✓
    const invHammer = makeCandle(2000, 102, 114, 100, 100);
    const candles = withDowntrend(invHammer);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "inverted_hammer");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect doji", () => {
    // Very small body (open ≈ close)
    const doji = makeCandle(2000, 100, 105, 95, 100.2);
    const result = candlestickPatterns([doji], { requireTrend: false });
    const patterns = result[0].value.patterns;

    const pattern = patterns.find((p) => p.name === "doji");
    expect(pattern).toBeDefined();
  });

  it("should detect doji as bullish in downtrend", () => {
    const doji = makeCandle(2000, 100, 105, 95, 100.2);
    const candles = withDowntrend(doji);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "doji");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect doji as bearish in uptrend", () => {
    const doji = makeCandle(2000, 100, 105, 95, 100.2);
    const candles = withUptrend(doji);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "doji");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should not detect doji when no trend and requireTrend is true", () => {
    // Single candle with no prior trend context
    const doji = makeCandle(2000, 100, 105, 95, 100.2);
    const result = candlestickPatterns([doji], { requireTrend: true });
    const patterns = result[0].value.patterns;

    const pattern = patterns.find((p) => p.name === "doji");
    expect(pattern).toBeUndefined();
  });

  it("should detect bullish marubozu", () => {
    // Body covers almost entire range (open ≈ low, close ≈ high)
    const marubozu = makeCandle(2000, 100, 110.1, 99.9, 110);
    const result = candlestickPatterns([marubozu], { requireTrend: false });
    const patterns = result[0].value.patterns;

    const pattern = patterns.find((p) => p.name === "bullish_marubozu");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect bearish marubozu", () => {
    const marubozu = makeCandle(2000, 110, 110.1, 99.9, 100);
    const result = candlestickPatterns([marubozu], { requireTrend: false });
    const patterns = result[0].value.patterns;

    const pattern = patterns.find((p) => p.name === "bearish_marubozu");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should detect spinning top", () => {
    // Small body with long shadows on both sides
    const spinning = makeCandle(2000, 100, 108, 92, 101);
    const result = candlestickPatterns([spinning], { requireTrend: false });
    const patterns = result[0].value.patterns;

    const pattern = patterns.find((p) => p.name === "spinning_top");
    expect(pattern).toBeDefined();
  });

  it("should detect spinning top as bullish in downtrend", () => {
    const spinning = makeCandle(2000, 100, 108, 92, 101);
    const candles = withDowntrend(spinning);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "spinning_top");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bullish");
  });

  it("should detect spinning top as bearish in uptrend", () => {
    const spinning = makeCandle(2000, 100, 108, 92, 101);
    const candles = withUptrend(spinning);
    const result = candlestickPatterns(candles);
    const last = result[result.length - 1].value;

    const pattern = last.patterns.find((p) => p.name === "spinning_top");
    expect(pattern).toBeDefined();
    expect(pattern?.direction).toBe("bearish");
  });

  it("should not detect patterns on flat candle (range = 0)", () => {
    const flat = makeCandle(2000, 100, 100, 100, 100);
    const result = candlestickPatterns([flat], { requireTrend: false });

    expect(result[0].value.patterns).toHaveLength(0);
  });

  it("should handle empty array", () => {
    expect(candlestickPatterns([])).toEqual([]);
  });

  it("should respect pattern filter", () => {
    const doji = makeCandle(2000, 100, 105, 95, 100.2);
    const result = candlestickPatterns([doji], {
      requireTrend: false,
      patterns: ["hammer"], // Only detect hammer, not doji
    });

    expect(result[0].value.patterns).toHaveLength(0);
  });
});
