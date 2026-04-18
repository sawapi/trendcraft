/**
 * Donchian Channel
 * Shows highest high and lowest low over N periods
 * Used for breakout strategies (Turtle Trading)
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { DONCHIAN_META } from "../indicator-meta";

/**
 * Donchian Channel values
 */
export type DonchianValue = {
  /** Upper band (highest high over period) */
  upper: number | null;
  /** Middle band (average of upper and lower) */
  middle: number | null;
  /** Lower band (lowest low over period) */
  lower: number | null;
};

/**
 * Options for Donchian Channel calculation
 */
export type DonchianOptions = {
  /** Period for channel calculation (default: 20) */
  period?: number;
};

/**
 * Calculate Donchian Channel
 *
 * The Donchian Channel shows the highest high and lowest low over N periods.
 * Originally developed for commodity trading and popularized by the Turtle Traders.
 *
 * Calculation:
 * - Upper Band = Highest High over N periods
 * - Lower Band = Lowest Low over N periods
 * - Middle Band = (Upper + Lower) / 2
 *
 * Trading signals:
 * - Price breaking above upper band = bullish breakout
 * - Price breaking below lower band = bearish breakout
 * - Turtle Trading: buy on 20-day high, sell on 10-day low
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Donchian Channel options
 * @returns Series of Donchian Channel values
 *
 * @example
 * ```ts
 * const donchian = donchianChannel(candles, { period: 20 });
 * const { upper, middle, lower } = donchian[i].value;
 *
 * if (currentPrice > upper) {
 *   // Breakout - potential buy signal
 * }
 * ```
 */
export function donchianChannel(
  candles: Candle[] | NormalizedCandle[],
  options: DonchianOptions = {},
): Series<DonchianValue> {
  const { period = 20 } = options;

  if (period < 1) {
    throw new Error("Donchian Channel period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<DonchianValue> = [];

  // Optimized O(n) algorithm using monotonic deques
  // Deques store indices of potential max/min candidates

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

    // For max deque: remove smaller elements from back (they can't be max)
    while (maxDeque.length > 0 && normalized[maxDeque[maxDeque.length - 1]].high <= high) {
      maxDeque.pop();
    }
    maxDeque.push(i);

    // For min deque: remove larger elements from back (they can't be min)
    while (minDeque.length > 0 && normalized[minDeque[minDeque.length - 1]].low >= low) {
      minDeque.pop();
    }
    minDeque.push(i);

    if (i < period - 1) {
      // Not enough data yet
      result.push({
        time: normalized[i].time,
        value: { upper: null, middle: null, lower: null },
      });
    } else {
      // Front of deques contain indices of max/min in current window
      const highestHigh = normalized[maxDeque[0]].high;
      const lowestLow = normalized[minDeque[0]].low;
      const middle = (highestHigh + lowestLow) / 2;

      result.push({
        time: normalized[i].time,
        value: {
          upper: highestHigh,
          middle,
          lower: lowestLow,
        },
      });
    }
  }

  return tagSeries(result, withLabelParams(DONCHIAN_META, [period]));
}
