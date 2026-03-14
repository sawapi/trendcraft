/**
 * Composable Indicator Algebra
 *
 * Provides pipe(), compose(), and adapter functions for chaining
 * indicator calculations. Bridges the gap between indicators that
 * accept Candle[] and those that return Series<T>.
 *
 * @example
 * ```ts
 * import { pipe, through, extractField, rsi, ema, macd, bollingerBands } from "trendcraft";
 *
 * // EMA of RSI
 * const smoothedRsi = pipe(
 *   candles,
 *   c => rsi(c, { period: 14 }),
 *   through(ema, { period: 9 }),
 * );
 *
 * // Bollinger Bands of MACD histogram
 * const bbOfHist = pipe(
 *   candles,
 *   c => macd(c),
 *   s => extractField(s, "histogram"),
 *   through(bollingerBands, { period: 20 }),
 * );
 * ```
 */

export { seriesToCandles, extractField, mapValues, combineSeries } from "./adapters";
export { pipe, compose, applyIndicator, through } from "./pipe";
