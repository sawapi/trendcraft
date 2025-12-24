/**
 * Williams %R indicator
 *
 * Williams %R is a momentum indicator that measures overbought/oversold levels.
 * It's the inverse of the Fast Stochastic Oscillator.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Williams %R options
 */
export type WilliamsROptions = {
  /** Period for Williams %R calculation (default: 14) */
  period?: number;
};

/**
 * Calculate Williams %R
 *
 * Williams %R = (Highest High - Close) / (Highest High - Lowest Low) × -100
 *
 * Range: -100 to 0
 * - Above -20: Overbought (potential sell signal)
 * - Below -80: Oversold (potential buy signal)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Williams %R options
 * @returns Series of Williams %R values (range: -100 to 0)
 *
 * @example
 * ```ts
 * const willR = williamsR(candles); // Default 14-period
 * const willR7 = williamsR(candles, { period: 7 });
 *
 * // Check for overbought/oversold
 * const isOverbought = willR[i].value > -20;
 * const isOversold = willR[i].value < -80;
 * ```
 */
export function williamsR(
  candles: Candle[] | NormalizedCandle[],
  options: WilliamsROptions = {},
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 1) {
    throw new Error("Williams %R period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Find highest high and lowest low over the period
    let highestHigh = Number.NEGATIVE_INFINITY;
    let lowestLow = Number.POSITIVE_INFINITY;

    for (let j = i - period + 1; j <= i; j++) {
      if (normalized[j].high > highestHigh) {
        highestHigh = normalized[j].high;
      }
      if (normalized[j].low < lowestLow) {
        lowestLow = normalized[j].low;
      }
    }

    // Calculate Williams %R
    let willR: number | null = null;
    const range = highestHigh - lowestLow;
    if (range !== 0) {
      willR = ((highestHigh - normalized[i].close) / range) * -100;
    } else {
      willR = -50; // Neutral when no range
    }

    result.push({ time: normalized[i].time, value: willR });
  }

  return result;
}
