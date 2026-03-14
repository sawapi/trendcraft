/**
 * Standard Deviation indicator
 *
 * Calculates the rolling standard deviation of price, measuring
 * the dispersion of price from its mean.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Standard Deviation options
 */
export type StandardDeviationOptions = {
  /** Period for calculation (default: 20) */
  period?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Standard Deviation
 *
 * StdDev = sqrt(sum((price - mean)^2) / N)
 *
 * Uses population standard deviation (dividing by N, not N-1) to match
 * the convention used by most charting platforms and TA-Lib.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Standard Deviation options
 * @returns Series of standard deviation values (null for insufficient data)
 *
 * @example
 * ```ts
 * const sd = standardDeviation(candles); // 20-period StdDev
 * const sd10 = standardDeviation(candles, { period: 10 });
 * ```
 */
export function standardDeviation(
  candles: Candle[] | NormalizedCandle[],
  options: StandardDeviationOptions = {},
): Series<number | null> {
  const { period = 20, source = "close" } = options;

  if (period < 1) {
    throw new Error("Standard Deviation period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Calculate mean
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += prices[j];
    }
    const mean = sum / period;

    // Calculate variance (population)
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = prices[j] - mean;
      sumSqDiff += diff * diff;
    }

    const stdDev = Math.sqrt(sumSqDiff / period);
    result.push({ time: normalized[i].time, value: stdDev });
  }

  return result;
}
