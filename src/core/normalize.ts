/**
 * Data normalization utilities
 */

import type { Candle, NormalizedCandle, PriceSource } from "../types";

/**
 * Convert time value to epoch milliseconds
 *
 * Heuristic for numeric timestamps:
 * - Values < 1e10 are treated as Unix seconds (covers up to ~2286)
 * - Values >= 1e10 and < 1e13 are treated as Unix milliseconds
 * - Values >= 1e13 are treated as microseconds and converted to ms
 */
export function normalizeTime(time: number | string): number {
  if (typeof time === "number") {
    // Unix seconds: < 1e10 (covers dates up to ~2286-11-20)
    if (time < 1e10) {
      return time * 1000;
    }
    // Microseconds: >= 1e13 (e.g., 1703500800000000)
    if (time >= 1e13) {
      return Math.floor(time / 1000);
    }
    // Milliseconds: 1e10 <= time < 1e13
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

/**
 * Check if candles are already normalized (time is a number)
 *
 * Use this to avoid redundant normalization when candles may have already been normalized.
 *
 * @param candles - Array of candles to check
 * @returns true if candles are normalized (time is a number), false otherwise
 *
 * @example
 * ```ts
 * const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
 * ```
 */
export function isNormalized(
  candles: Candle[] | NormalizedCandle[],
): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
