/**
 * Data normalization utilities
 */

import type { Candle, NormalizedCandle, PriceSource } from "../types";

/**
 * Convert time value to epoch milliseconds
 */
export function normalizeTime(time: number | string): number {
  if (typeof time === "number") {
    // If the number is too small, assume it's seconds and convert to ms
    if (time < 1e12) {
      return time * 1000;
    }
    return time;
  }

  // Parse ISO string
  const parsed = Date.parse(time);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid time format: ${time}`);
  }
  return parsed;
}

/**
 * Normalize a single candle
 */
export function normalizeCandle(candle: Candle): NormalizedCandle {
  return {
    time: normalizeTime(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

/**
 * Normalize an array of candles and sort by time ascending
 */
export function normalizeCandles(candles: Candle[]): NormalizedCandle[] {
  return candles.map(normalizeCandle).sort((a, b) => a.time - b.time);
}

/**
 * Extract price value from candle based on source type
 */
export function getPrice(candle: NormalizedCandle, source: PriceSource): number {
  switch (source) {
    case "open":
      return candle.open;
    case "high":
      return candle.high;
    case "low":
      return candle.low;
    case "close":
      return candle.close;
    case "volume":
      return candle.volume;
    case "hl2":
      return (candle.high + candle.low) / 2;
    case "hlc3":
      return (candle.high + candle.low + candle.close) / 3;
    case "ohlc4":
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    default:
      return candle.close;
  }
}

/**
 * Extract price series from candles
 */
export function getPriceSeries(candles: NormalizedCandle[], source: PriceSource): number[] {
  return candles.map((c) => getPrice(c, source));
}
