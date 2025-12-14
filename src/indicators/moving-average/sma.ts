/**
 * Simple Moving Average (SMA) indicator
 */

import { getPrice } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series, SmaOptions } from "../../types";
import { normalizeCandles } from "../../core/normalize";

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
  options: SmaOptions
): Series<number | null> {
  const { period, source = "close" } = options;

  if (period < 1) {
    throw new Error("SMA period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      // Not enough data yet
      result.push({ time: normalized[i].time, value: null });
    } else {
      // Calculate average of last `period` values
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += getPrice(normalized[i - j], source);
      }
      result.push({ time: normalized[i].time, value: sum / period });
    }
  }

  return result;
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
