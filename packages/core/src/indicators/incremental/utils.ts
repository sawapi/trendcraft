/**
 * Shared utilities for incremental indicators
 */

import type { NormalizedCandle, PriceSource } from "../../types";

/**
 * Extract a price value from a candle based on the specified source.
 *
 * @param candle - Normalized candle
 * @param source - Which price field to use
 */
export function getSourcePrice(candle: NormalizedCandle, source: PriceSource): number {
  switch (source) {
    case "open":
      return candle.open;
    case "high":
      return candle.high;
    case "low":
      return candle.low;
    case "close":
      return candle.close;
    case "hl2":
      return (candle.high + candle.low) / 2;
    case "hlc3":
      return (candle.high + candle.low + candle.close) / 3;
    case "ohlc4":
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    case "volume":
      return candle.volume;
    default:
      return candle.close;
  }
}

/**
 * Create a synthetic NormalizedCandle from a single value.
 * Useful for feeding computed values into sub-indicators that expect candles.
 *
 * @param time - Timestamp
 * @param value - Value to use for all OHLC fields
 */
export function makeCandle(time: number, value: number): NormalizedCandle {
  return { time, open: value, high: value, low: value, close: value, volume: 0 };
}
