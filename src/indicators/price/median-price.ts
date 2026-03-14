/**
 * Median Price, Typical Price, and Weighted Close indicators
 *
 * These are basic price transform indicators used as inputs for other indicators.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Calculate Median Price
 *
 * Median Price = (High + Low) / 2
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of median price values
 *
 * @example
 * ```ts
 * const mp = medianPrice(candles);
 * ```
 */
export function medianPrice(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  return normalized.map((c) => ({
    time: c.time,
    value: (c.high + c.low) / 2,
  }));
}

/**
 * Calculate Typical Price
 *
 * Typical Price = (High + Low + Close) / 3
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of typical price values
 *
 * @example
 * ```ts
 * const tp = typicalPrice(candles);
 * ```
 */
export function typicalPrice(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  return normalized.map((c) => ({
    time: c.time,
    value: (c.high + c.low + c.close) / 3,
  }));
}

/**
 * Calculate Weighted Close
 *
 * Weighted Close = (High + Low + Close × 2) / 4
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of weighted close values
 *
 * @example
 * ```ts
 * const wc = weightedClose(candles);
 * ```
 */
export function weightedClose(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  return normalized.map((c) => ({
    time: c.time,
    value: (c.high + c.low + c.close * 2) / 4,
  }));
}
