/**
 * Series utility functions for combining and transforming time-aligned indicator data.
 *
 * TrendCraft indicators return `Series<T>` (arrays of `{ time, value }`).
 * These utilities handle time-alignment and value transformation.
 */

import type { IndicatorValue, Series } from "../types";

/**
 * Combine two series by aligning on timestamp and applying a merge function.
 * Only produces output for timestamps that exist in both series.
 *
 * @param a - First series
 * @param b - Second series
 * @param fn - Merge function receiving values from both series
 * @returns New series with merged values
 *
 * @example
 * ```ts
 * import { sma, rsi, zipSeries } from "trendcraft";
 *
 * const sma20 = sma(candles, { period: 20 });
 * const rsi14 = rsi(candles);
 *
 * // Combine: buy score = inverse RSI normalized + distance from SMA
 * const combined = zipSeries(sma20, rsi14, (smaVal, rsiVal) => ({
 *   sma: smaVal,
 *   rsi: rsiVal,
 *   spread: smaVal - rsiVal,
 * }));
 * ```
 */
export function zipSeries<A, B, R>(
  a: Series<A>,
  b: Series<B>,
  fn: (aVal: A, bVal: B) => R,
): Series<R> {
  // Build a time→value map from the shorter series for O(n+m) lookup
  const isASmaller = a.length <= b.length;
  const smaller = isASmaller ? a : b;
  const larger = isASmaller ? b : a;

  const timeMap = new Map<number, number>();
  for (let i = 0; i < smaller.length; i++) {
    timeMap.set(smaller[i].time, i);
  }

  const result: Series<R> = [];
  for (let i = 0; i < larger.length; i++) {
    const matchIdx = timeMap.get(larger[i].time);
    if (matchIdx !== undefined) {
      const aVal = isASmaller ? (smaller[matchIdx].value as A) : (larger[i].value as A);
      const bVal = isASmaller ? (larger[i].value as B) : (smaller[matchIdx].value as B);
      result.push({ time: larger[i].time, value: fn(aVal, bVal) });
    }
  }

  return result;
}

/**
 * Transform each value in a series while preserving timestamps.
 *
 * @param series - Input series
 * @param fn - Transform function applied to each value
 * @returns New series with transformed values
 *
 * @example
 * ```ts
 * import { rsi, mapSeries } from "trendcraft";
 *
 * const rsi14 = rsi(candles);
 *
 * // Normalize RSI to 0-1 range
 * const normalized = mapSeries(rsi14, (val) => val / 100);
 *
 * // Boolean signal series
 * const oversold = mapSeries(rsi14, (val) => val < 30);
 * ```
 */
export function mapSeries<T, R>(series: Series<T>, fn: (value: T, index: number) => R): Series<R> {
  return series.map((item, i) => ({
    time: item.time,
    value: fn(item.value, i),
  }));
}

/**
 * Filter a series by a predicate on its values, preserving timestamps.
 *
 * @param series - Input series
 * @param predicate - Filter function
 * @returns Filtered series
 *
 * @example
 * ```ts
 * import { rsi, filterSeries } from "trendcraft";
 *
 * const rsi14 = rsi(candles);
 * const oversoldPoints = filterSeries(rsi14, (val) => val < 30);
 * ```
 */
export function filterSeries<T>(
  series: Series<T>,
  predicate: (value: T, index: number) => boolean,
): Series<T> {
  return series.filter((item, i) => predicate(item.value, i));
}

/**
 * Align a series to a target series by timestamp.
 * For each timestamp in the target, finds the matching or most recent prior value in the source.
 * Useful for aligning higher-timeframe indicators to lower-timeframe data.
 *
 * @param source - Source series to align
 * @param target - Target series providing the timestamps
 * @returns Aligned series matching target timestamps
 *
 * @example
 * ```ts
 * import { sma, resample, alignSeries } from "trendcraft";
 *
 * const weeklyCandles = resample(dailyCandles, { value: 1, unit: "week" });
 * const weeklySma = sma(weeklyCandles, { period: 20 });
 *
 * // Align weekly SMA to daily timestamps
 * const dailyAlignedWeeklySma = alignSeries(weeklySma, dailySma);
 * ```
 */
export function alignSeries<T>(source: Series<T>, target: Series<unknown>): Series<T | null> {
  if (source.length === 0) {
    return target.map((t) => ({ time: t.time, value: null }));
  }

  const result: Series<T | null> = [];
  let srcIdx = 0;

  for (const t of target) {
    // Advance source index to the most recent value at or before target time
    while (srcIdx < source.length - 1 && source[srcIdx + 1].time <= t.time) {
      srcIdx++;
    }

    if (source[srcIdx].time <= t.time) {
      result.push({ time: t.time, value: source[srcIdx].value });
    } else {
      result.push({ time: t.time, value: null });
    }
  }

  return result;
}
