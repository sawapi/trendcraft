/**
 * Composable Indicator Algebra — adapter functions
 *
 * Convert between Series and candle formats to enable indicator chaining.
 */

import type { NormalizedCandle, Series } from "../types";
import type { SeriesToCandlesOptions } from "../types/compose";

/**
 * Convert a Series<number|null> to pseudo NormalizedCandle[] for use as input to indicators.
 * Non-null values become OHLC (all the same value), volume = 0.
 * null values get 0 for all prices.
 *
 * @param series - Source series to convert
 * @param options - Conversion options
 * @returns Array of pseudo-candles suitable for indicator functions
 *
 * @example
 * ```ts
 * const rsiSeries = rsi(candles, { period: 14 });
 * const pseudoCandles = seriesToCandles(rsiSeries);
 * const smoothed = ema(pseudoCandles, { period: 9 });
 * ```
 */
export function seriesToCandles(
  series: Series<number | null>,
  _options: SeriesToCandlesOptions = {},
): NormalizedCandle[] {
  return series.map((point) => {
    const v = point.value ?? 0;
    return {
      time: point.time,
      open: v,
      high: v,
      low: v,
      close: v,
      volume: 0,
    };
  });
}

/**
 * Extract a numeric field from a complex series to create a simple Series<number|null>.
 * Useful for extracting MACD histogram, Bollinger %B, etc.
 *
 * @param series - Source series with complex values
 * @param field - The field name to extract
 * @returns Series of extracted numeric values
 *
 * @example
 * ```ts
 * const macdSeries = macd(candles);
 * const histogram = extractField(macdSeries, "histogram");
 * const smoothedHist = pipe(histogram, applyIndicator(ema, { period: 9 }));
 * ```
 */
export function extractField<T extends Record<string, unknown>>(
  series: Series<T>,
  field: keyof T,
): Series<number | null> {
  return series.map((point) => ({
    time: point.time,
    value: (point.value?.[field] as number) ?? null,
  }));
}

/**
 * Map series values through a transform function.
 *
 * @param series - Source series
 * @param fn - Transform function applied to each value
 * @returns New series with transformed values
 *
 * @example
 * ```ts
 * const normalized = mapValues(rsiSeries, v => v !== null ? v / 100 : null);
 * ```
 */
export function mapValues<TIn, TOut>(
  series: Series<TIn>,
  fn: (value: TIn, index: number) => TOut,
): Series<TOut> {
  return series.map((point, i) => ({
    time: point.time,
    value: fn(point.value, i),
  }));
}

/**
 * Combine two series point-by-point (aligned by index, not time).
 * The result length is the minimum of both input lengths.
 *
 * @param a - First series
 * @param b - Second series
 * @param fn - Combiner function applied to each aligned pair
 * @returns New series with combined values
 *
 * @example
 * ```ts
 * const spread = combineSeries(seriesA, seriesB, (a, b) =>
 *   a !== null && b !== null ? a - b : null
 * );
 * ```
 */
export function combineSeries<TA, TB, TOut>(
  a: Series<TA>,
  b: Series<TB>,
  fn: (va: TA, vb: TB, index: number) => TOut,
): Series<TOut> {
  const len = Math.min(a.length, b.length);
  const result: Series<TOut> = [];
  for (let i = 0; i < len; i++) {
    result.push({
      time: a[i].time,
      value: fn(a[i].value, b[i].value, i),
    });
  }
  return result;
}
