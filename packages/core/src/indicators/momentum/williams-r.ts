/**
 * Williams %R indicator
 *
 * Williams %R is a momentum indicator that measures overbought/oversold levels.
 * It's the inverse of the Fast Stochastic Oscillator.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { WILLIAMS_R_META } from "../indicator-meta";

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

  // Optimized O(n) algorithm using monotonic deques
  // Monotonic decreasing deque for max (front = index of max in window)
  const maxDeque: number[] = [];
  // Monotonic increasing deque for min (front = index of min in window)
  const minDeque: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const high = normalized[i].high;
    const low = normalized[i].low;

    // Remove elements outside the window from front
    while (maxDeque.length > 0 && maxDeque[0] <= i - period) {
      maxDeque.shift();
    }
    while (minDeque.length > 0 && minDeque[0] <= i - period) {
      minDeque.shift();
    }

    // For max deque: remove smaller elements from back
    while (maxDeque.length > 0 && normalized[maxDeque[maxDeque.length - 1]].high <= high) {
      maxDeque.pop();
    }
    maxDeque.push(i);

    // For min deque: remove larger elements from back
    while (minDeque.length > 0 && normalized[minDeque[minDeque.length - 1]].low >= low) {
      minDeque.pop();
    }
    minDeque.push(i);

    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      // Get highest high and lowest low from deque fronts
      const highestHigh = normalized[maxDeque[0]].high;
      const lowestLow = normalized[minDeque[0]].low;

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
  }

  return tagSeries(result, WILLIAMS_R_META);
}
