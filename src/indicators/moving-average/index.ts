/**
 * Moving Average indicators — smooth price data to identify trends
 *
 * - **SMA**: Simple Moving Average — equal-weighted mean over N periods
 * - **EMA**: Exponential Moving Average — more weight on recent prices
 * - **WMA**: Weighted Moving Average — linearly weighted
 * - **VWMA**: Volume-Weighted Moving Average — weighted by volume
 * - **KAMA**: Kaufman Adaptive MA — adjusts speed to market noise
 * - **T3**: Tillson T3 — ultra-smooth, low-lag triple EMA
 * - **HMA**: Hull Moving Average — reduced lag with WMA combination
 *
 * @module
 */
export { sma } from "./sma";
export { ema } from "./ema";
export { wma } from "./wma";
export type { WmaOptions } from "./wma";
export { vwma } from "./vwma";
export type { VwmaOptions } from "./vwma";
export { kama } from "./kama";
export type { KamaOptions } from "./kama";
export { t3 } from "./t3";
export type { T3Options } from "./t3";
export { hma } from "./hma";
export type { HmaOptions } from "./hma";
