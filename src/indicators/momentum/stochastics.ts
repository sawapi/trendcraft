/**
 * Stochastic Oscillator
 * Compares closing price to price range over a period
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Stochastic oscillator result
 */
export type StochasticsValue = {
  /** %K line (fast stochastic) */
  k: number | null;
  /** %D line (slow stochastic, SMA of %K) */
  d: number | null;
};

/**
 * Options for Stochastic calculation
 */
export type StochasticsOptions = {
  /** %K period (default: 14) */
  kPeriod?: number;
  /** %D smoothing period (default: 3) */
  dPeriod?: number;
  /** Additional smoothing for slow stochastic (default: 3, set to 1 for fast) */
  slowing?: number;
};

/**
 * Calculate Stochastic Oscillator
 *
 * Fast Stochastic: slowing = 1
 * Slow Stochastic: slowing = 3 (default)
 *
 * Formula:
 * Raw %K = 100 × (Close - Lowest Low) / (Highest High - Lowest Low)
 * %K = SMA(Raw %K, slowing)
 * %D = SMA(%K, dPeriod)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Stochastic options
 * @returns Series of stochastic values
 *
 * @example
 * ```ts
 * // Slow Stochastic (default)
 * const slow = stochastics(candles);
 *
 * // Fast Stochastic
 * const fast = stochastics(candles, { slowing: 1 });
 *
 * // Custom periods
 * const custom = stochastics(candles, { kPeriod: 9, dPeriod: 3, slowing: 3 });
 * ```
 */
export function stochastics(
  candles: Candle[] | NormalizedCandle[],
  options: StochasticsOptions = {},
): Series<StochasticsValue> {
  const { kPeriod = 14, dPeriod = 3, slowing = 3 } = options;

  if (kPeriod < 1) throw new Error("kPeriod must be at least 1");
  if (dPeriod < 1) throw new Error("dPeriod must be at least 1");
  if (slowing < 1) throw new Error("slowing must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Step 1: Calculate Raw %K
  const rawK: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (i < kPeriod - 1) {
      rawK.push(null);
      continue;
    }

    let highestHigh = Number.NEGATIVE_INFINITY;
    let lowestLow = Number.POSITIVE_INFINITY;

    for (let j = 0; j < kPeriod; j++) {
      const candle = normalized[i - j];
      if (candle.high > highestHigh) highestHigh = candle.high;
      if (candle.low < lowestLow) lowestLow = candle.low;
    }

    const range = highestHigh - lowestLow;
    if (range === 0) {
      rawK.push(50); // If no range, return middle value
    } else {
      rawK.push((100 * (normalized[i].close - lowestLow)) / range);
    }
  }

  // Step 2: Apply slowing (SMA of Raw %K) to get %K
  const kValues = applySma(rawK, slowing);

  // Step 3: Calculate %D (SMA of %K)
  const dValues = applySma(kValues, dPeriod);

  // Build result
  const result: Series<StochasticsValue> = [];
  for (let i = 0; i < normalized.length; i++) {
    result.push({
      time: normalized[i].time,
      value: {
        k: kValues[i],
        d: dValues[i],
      },
    });
  }

  return result;
}

/**
 * Calculate Fast Stochastic (convenience function)
 */
export function fastStochastics(
  candles: Candle[] | NormalizedCandle[],
  options: Omit<StochasticsOptions, "slowing"> = {},
): Series<StochasticsValue> {
  return stochastics(candles, { ...options, slowing: 1 });
}

/**
 * Calculate Slow Stochastic (convenience function)
 */
export function slowStochastics(
  candles: Candle[] | NormalizedCandle[],
  options: Omit<StochasticsOptions, "slowing"> = {},
): Series<StochasticsValue> {
  return stochastics(candles, { ...options, slowing: 3 });
}

/**
 * Apply Simple Moving Average to a series
 */
function applySma(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    // Count valid values in window
    let sum = 0;
    let count = 0;

    for (let j = 0; j < period && i - j >= 0; j++) {
      const val = values[i - j];
      if (val !== null) {
        sum += val;
        count++;
      }
    }

    if (count === period) {
      result.push(sum / period);
    } else {
      result.push(null);
    }
  }

  return result;
}
