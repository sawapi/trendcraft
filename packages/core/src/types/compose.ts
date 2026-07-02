/**
 * Composable Indicator Algebra types
 *
 * Type definitions for the pipe/compose API that enables
 * chaining indicators: e.g. `ema(rsi(candles, 14), 9)`.
 */
import type { NormalizedCandle, Series } from "./candle";

/**
 * A function that takes candles and produces a series
 */
export type IndicatorFn<T = number | null> = (candles: NormalizedCandle[]) => Series<T>;

/**
 * A function that transforms one series into another
 */
export type SeriesTransformFn<TIn = number | null, TOut = number | null> = (
  series: Series<TIn>,
) => Series<TOut>;

/**
 * Options for converting Series to pseudo-candles
 */
export type SeriesToCandlesOptions = {
  /**
   * What to fill open/high/low with: the series value (`"value"`, default)
   * or 0 (`"zero"`). `close` always carries the series value.
   */
  fillMode?: "value" | "zero";
};
