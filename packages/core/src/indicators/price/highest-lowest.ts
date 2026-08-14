/**
 * Highest/Lowest price indicators
 */

import { getPriceSeries, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, HighestLowestOptions, NormalizedCandle, Series } from "../../types";
import { assertPeriod } from "../../utils/validate-period";

/**
 * Result type for highest/lowest
 */
export type HighestLowestValue = {
  highest: number | null;
  lowest: number | null;
};

/**
 * Calculate Highest and Lowest values over n periods
 *
 * By default the highest is taken from candle highs and the lowest from
 * candle lows. Pass `source` to compute both extremes from a single price
 * series (e.g. `source: "close"` for close-based ranges).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options (period, source)
 * @returns Series of highest/lowest values
 *
 * @example
 * ```ts
 * const hl20 = highestLowest(candles, { period: 20 });
 * console.log(hl20[i].value.highest); // 20-period high
 * console.log(hl20[i].value.lowest);  // 20-period low
 *
 * const closeRange = highestLowest(candles, { period: 20, source: "close" });
 * console.log(closeRange[i].value.highest); // 20-period highest close
 * ```
 */
export function highestLowest(
  candles: Candle[] | NormalizedCandle[],
  options: HighestLowestOptions,
): Series<HighestLowestValue> {
  const { period, source } = options;

  assertPeriod("Period", period);

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Default: highest from highs, lowest from lows. With `source`, both
  // extremes come from that single price series.
  const sourceValues = source ? getPriceSeries(normalized, source) : null;
  const maxValues = sourceValues ?? normalized.map((c) => c.high);
  const minValues = sourceValues ?? normalized.map((c) => c.low);

  const result: Series<HighestLowestValue> = [];

  // Optimized O(n) algorithm using monotonic deques
  // Deques store indices of potential max/min candidates

  // Monotonic decreasing deque for max (front = index of max in window)
  const maxDeque: number[] = [];
  // Monotonic increasing deque for min (front = index of min in window)
  const minDeque: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const high = maxValues[i];
    const low = minValues[i];

    // Remove elements outside the window from front
    while (maxDeque.length > 0 && maxDeque[0] <= i - period) {
      maxDeque.shift();
    }
    while (minDeque.length > 0 && minDeque[0] <= i - period) {
      minDeque.shift();
    }

    // For max deque: remove smaller elements from back (they can't be max)
    while (maxDeque.length > 0 && maxValues[maxDeque[maxDeque.length - 1]] <= high) {
      maxDeque.pop();
    }
    maxDeque.push(i);

    // For min deque: remove larger elements from back (they can't be min)
    while (minDeque.length > 0 && minValues[minDeque[minDeque.length - 1]] >= low) {
      minDeque.pop();
    }
    minDeque.push(i);

    if (i < period - 1) {
      result.push({
        time: normalized[i].time,
        value: { highest: null, lowest: null },
      });
    } else {
      // Front of deques contain indices of max/min in current window
      result.push({
        time: normalized[i].time,
        value: {
          highest: maxValues[maxDeque[0]],
          lowest: minValues[minDeque[0]],
        },
      });
    }
  }

  return tagSeries(result, { kind: "highestLowest", overlay: true, label: "HiLo" });
}

/**
 * Calculate only highest high over n periods
 *
 * @param candles - Array of candles
 * @param period - Lookback period
 * @returns Series of highest values
 */
export function highest(
  candles: Candle[] | NormalizedCandle[],
  period: number,
): Series<number | null> {
  assertPeriod("Period", period);

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  // Optimized O(n) using monotonic decreasing deque
  const maxDeque: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const high = normalized[i].high;

    // Remove elements outside the window
    while (maxDeque.length > 0 && maxDeque[0] <= i - period) {
      maxDeque.shift();
    }

    // Remove smaller elements from back
    while (maxDeque.length > 0 && normalized[maxDeque[maxDeque.length - 1]].high <= high) {
      maxDeque.pop();
    }
    maxDeque.push(i);

    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      result.push({ time: normalized[i].time, value: normalized[maxDeque[0]].high });
    }
  }

  return result;
}

/**
 * Calculate only lowest low over n periods
 *
 * @param candles - Array of candles
 * @param period - Lookback period
 * @returns Series of lowest values
 */
export function lowest(
  candles: Candle[] | NormalizedCandle[],
  period: number,
): Series<number | null> {
  assertPeriod("Period", period);

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  // Optimized O(n) using monotonic increasing deque
  const minDeque: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const low = normalized[i].low;

    // Remove elements outside the window
    while (minDeque.length > 0 && minDeque[0] <= i - period) {
      minDeque.shift();
    }

    // Remove larger elements from back
    while (minDeque.length > 0 && normalized[minDeque[minDeque.length - 1]].low >= low) {
      minDeque.pop();
    }
    minDeque.push(i);

    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      result.push({ time: normalized[i].time, value: normalized[minDeque[0]].low });
    }
  }

  return result;
}
