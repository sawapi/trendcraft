/**
 * Simple Moving Average (SMA) indicator
 */

import { getPrice, isNormalized } from "../../core/normalize";
import { normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series, SmaOptions } from "../../types";

/**
 * Calculate Simple Moving Average
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - SMA options (period, source)
 * @returns Series of SMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const sma20 = sma(candles, { period: 20 });
 * const smaHigh = sma(candles, { period: 10, source: 'high' });
 * ```
 */
export function sma(
  candles: Candle[] | NormalizedCandle[],
  options: SmaOptions,
): Series<number | null> {
  const { period, source = "close" } = options;

  if (period < 1) {
    throw new Error("SMA period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  // Optimized O(n) sliding window algorithm
  // Instead of recalculating sum for each position, we add new value and remove old value

  // Handle initial null values (not enough data)
  for (let i = 0; i < period - 1 && i < normalized.length; i++) {
    result.push({ time: normalized[i].time, value: null });
  }

  if (normalized.length < period) {
    return result;
  }

  // Calculate initial window sum
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += getPrice(normalized[i], source);
  }
  result.push({ time: normalized[period - 1].time, value: sum / period });

  // Slide the window: add new value, remove old value - O(1) per iteration
  for (let i = period; i < normalized.length; i++) {
    sum += getPrice(normalized[i], source);
    sum -= getPrice(normalized[i - period], source);
    result.push({ time: normalized[i].time, value: sum / period });
  }

  return result;
}
