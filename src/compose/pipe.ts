/**
 * Composable Indicator Algebra — pipe and compose functions
 *
 * Enables functional chaining and composition of indicator transforms.
 */

import type { Candle, NormalizedCandle, Series } from "../types";
import { seriesToCandles } from "./adapters";

/**
 * Apply an indicator function that expects candles to a Series.
 * Internally converts Series to pseudo-candles.
 *
 * @param series - Input series (output from a previous indicator)
 * @param indicator - Indicator function that accepts candles
 * @param options - Options to pass to the indicator
 * @returns Output series from the indicator
 *
 * @example
 * ```ts
 * const rsiSeries = rsi(candles, { period: 14 });
 * const smoothed = applyIndicator(rsiSeries, ema, { period: 9 });
 * // Equivalent to: ema(seriesToCandles(rsi(candles, 14)), { period: 9 })
 * ```
 */
export function applyIndicator<TOpts, TOut>(
  series: Series<number | null>,
  indicator: (candles: Candle[] | NormalizedCandle[], options: TOpts) => Series<TOut>,
  options: TOpts,
): Series<TOut>;
export function applyIndicator<TOut>(
  series: Series<number | null>,
  indicator: (candles: Candle[] | NormalizedCandle[]) => Series<TOut>,
): Series<TOut>;
export function applyIndicator<TOpts, TOut>(
  series: Series<number | null>,
  indicator: (candles: Candle[] | NormalizedCandle[], options?: TOpts) => Series<TOut>,
  options?: TOpts,
): Series<TOut> {
  const pseudoCandles = seriesToCandles(series);
  return indicator(pseudoCandles, options);
}

/**
 * Pipe a value through a series of transform functions.
 * First argument is the source (candles or series), followed by transform steps.
 *
 * @example
 * ```ts
 * // EMA of RSI
 * const result = pipe(
 *   candles,
 *   c => rsi(c, { period: 14 }),
 *   s => applyIndicator(s, ema, { period: 9 }),
 * );
 *
 * // Bollinger Bands of MACD histogram
 * const result = pipe(
 *   candles,
 *   c => macd(c),
 *   s => extractField(s, "histogram"),
 *   s => applyIndicator(s, bollingerBands, { period: 20 }),
 * );
 * ```
 */
export function pipe<A, B>(source: A, fn1: (a: A) => B): B;
export function pipe<A, B, C>(source: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
export function pipe<A, B, C, D>(
  source: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  source: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
  fn4: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  source: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
  fn4: (d: D) => E,
  fn5: (e: E) => F,
): F;
export function pipe(source: unknown, ...fns: Array<(x: unknown) => unknown>): unknown {
  return fns.reduce((acc, fn) => fn(acc), source);
}

/**
 * Compose multiple transforms into a single function.
 * Applied right-to-left (mathematical convention).
 *
 * @example
 * ```ts
 * const smoothedRsi = compose(
 *   (s: Series<number|null>) => applyIndicator(s, ema, { period: 9 }),
 *   (c: NormalizedCandle[]) => rsi(c, { period: 14 }),
 * );
 * const result = smoothedRsi(candles);
 * ```
 */
export function compose<A, B>(fn1: (a: A) => B): (a: A) => B;
export function compose<A, B, C>(fn2: (b: B) => C, fn1: (a: A) => B): (a: A) => C;
export function compose<A, B, C, D>(
  fn3: (c: C) => D,
  fn2: (b: B) => C,
  fn1: (a: A) => B,
): (a: A) => D;
export function compose<A, B, C, D, E>(
  fn4: (d: D) => E,
  fn3: (c: C) => D,
  fn2: (b: B) => C,
  fn1: (a: A) => B,
): (a: A) => E;
export function compose(...fns: Array<(x: unknown) => unknown>): (x: unknown) => unknown {
  return (x: unknown) => fns.reduceRight((acc, fn) => fn(acc), x);
}

/**
 * Create an indicator step for use in pipe() that converts Series to candles and applies an indicator.
 * This is a convenience wrapper around applyIndicator for cleaner pipe chains.
 *
 * @param indicator - Indicator function that accepts candles
 * @param options - Options to pass to the indicator
 * @returns A transform function that can be used in pipe()
 *
 * @example
 * ```ts
 * const result = pipe(
 *   candles,
 *   c => rsi(c, { period: 14 }),
 *   through(ema, { period: 9 }),
 *   through(sma, { period: 3 }),
 * );
 * ```
 */
export function through<TOpts, TOut>(
  indicator: (candles: Candle[] | NormalizedCandle[], options: TOpts) => Series<TOut>,
  options: TOpts,
): (series: Series<number | null>) => Series<TOut>;
export function through<TOut>(
  indicator: (candles: Candle[] | NormalizedCandle[]) => Series<TOut>,
): (series: Series<number | null>) => Series<TOut>;
export function through<TOpts, TOut>(
  indicator: (candles: Candle[] | NormalizedCandle[], options?: TOpts) => Series<TOut>,
  options?: TOpts,
): (series: Series<number | null>) => Series<TOut> {
  return (series) => applyIndicator(series, indicator, options);
}
