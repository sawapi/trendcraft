import { describe, expect, it } from "vitest";
import { normalizeCandles } from "../../core/normalize";
import type { Candle } from "../../types";
import { detectMarketRegime } from "../market-regime";

/**
 * Generate synthetic candle data with a clear trend and volatility pattern.
 */
function generateCandles(
  count: number,
  options: {
    startPrice?: number;
    trendSlope?: number; // positive = uptrend
    volatility?: number; // ATR-like magnitude
  } = {},
): Candle[] {
  const { startPrice = 100, trendSlope = 0, volatility = 1 } = options;
  const candles: Candle[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price += trendSlope;
    const high = price + volatility;
    const low = price - volatility;
    candles.push({
      time: new Date(2024, 0, i + 1).toISOString(),
      open: price - trendSlope * 0.3,
      high,
      low,
      close: price,
      volume: 1000 + Math.floor(Math.random() * 500),
    });
  }

  return candles;
}

describe("detectMarketRegime", () => {
  it("returns default values for empty candles", () => {
    const result = detectMarketRegime([]);
    expect(result.volatility).toBe("normal");
    expect(result.trend).toBe("sideways");
    expect(result.trendStrength).toBe(0);
  });

  it("returns a valid result shape", () => {
    const candles = generateCandles(100, { trendSlope: 0.5 });
    const result = detectMarketRegime(candles);

    expect(["low", "normal", "high"]).toContain(result.volatility);
    expect(["bullish", "bearish", "sideways"]).toContain(result.trend);
    expect(result.trendStrength).toBeGreaterThanOrEqual(0);
    expect(result.trendStrength).toBeLessThanOrEqual(100);
  });

  it("detects bullish trend with upward sloping data", () => {
    // Strong uptrend: price rises 1 per candle for 120 candles
    const candles = generateCandles(120, { trendSlope: 1, volatility: 0.5 });
    const result = detectMarketRegime(candles);

    expect(result.trend).toBe("bullish");
  });

  it("detects bearish trend with downward sloping data", () => {
    // Strong downtrend: price falls 1 per candle
    const candles = generateCandles(120, {
      startPrice: 200,
      trendSlope: -1,
      volatility: 0.5,
    });
    const result = detectMarketRegime(candles);

    expect(result.trend).toBe("bearish");
  });

  it("works with normalized candles", () => {
    const raw = generateCandles(100, { trendSlope: 0.3 });
    const normalized = normalizeCandles(raw);
    const result = detectMarketRegime(normalized);

    expect(["low", "normal", "high"]).toContain(result.volatility);
    expect(["bullish", "bearish", "sideways"]).toContain(result.trend);
  });

  it("accepts custom options", () => {
    const candles = generateCandles(100, { trendSlope: 0.2 });
    const result = detectMarketRegime(candles, {
      lookback: 40,
      emaShort: 10,
      emaLong: 30,
      adxPeriod: 10,
      sidewaysThreshold: 15,
    });

    expect(["low", "normal", "high"]).toContain(result.volatility);
    expect(["bullish", "bearish", "sideways"]).toContain(result.trend);
  });

  it("handles very few candles gracefully", () => {
    const candles = generateCandles(5);
    const result = detectMarketRegime(candles);

    // Should not throw, and return safe defaults
    expect(result).toBeDefined();
    expect(result.trendStrength).toBeGreaterThanOrEqual(0);
  });
});
