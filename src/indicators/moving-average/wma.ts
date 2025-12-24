/**
 * Weighted Moving Average (WMA) indicator
 *
 * WMA gives more weight to recent prices, making it more responsive
 * to price changes than SMA.
 */

import { getPrice, isNormalized } from "../../core/normalize";
import { normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * WMA options
 */
export type WmaOptions = {
  /** Period for WMA calculation */
  period: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Weighted Moving Average
 *
 * WMA = (P1 * n + P2 * (n-1) + ... + Pn * 1) / (n * (n+1) / 2)
 *
 * Where:
 * - P1 = most recent price
 * - Pn = oldest price
 * - n = period
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - WMA options (period, source)
 * @returns Series of WMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const wma20 = wma(candles, { period: 20 });
 * const wmaHigh = wma(candles, { period: 10, source: 'high' });
 * ```
 */
export function wma(
  candles: Candle[] | NormalizedCandle[],
  options: WmaOptions,
): Series<number | null> {
  const { period, source = "close" } = options;

  if (period < 1) {
    throw new Error("WMA period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  // Denominator: n * (n + 1) / 2
  const weightSum = (period * (period + 1)) / 2;

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      // Not enough data yet
      result.push({ time: normalized[i].time, value: null });
    } else {
      // Calculate weighted average
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const weight = period - j; // Most recent has highest weight
        sum += getPrice(normalized[i - j], source) * weight;
      }
      result.push({ time: normalized[i].time, value: sum / weightSum });
    }
  }

  return result;
}
