/**
 * Plugin system types for TrendCraft
 *
 * Enables type-safe custom indicator extensions via the `.use()` method.
 */

import type { NormalizedCandle, Series } from "./candle";

/**
 * Indicator plugin definition
 *
 * @typeParam K - Unique name used as cache key prefix
 * @typeParam TOptions - Options object shape
 * @typeParam TValue - Series value type produced by the indicator
 *
 * @example
 * ```ts
 * const myPlugin: IndicatorPlugin<"myEma", { period: number }, number | null> = {
 *   name: "myEma",
 *   compute: (candles, opts) => ema(candles, opts),
 *   defaultOptions: { period: 20 },
 * };
 * ```
 */
export interface IndicatorPlugin<
  K extends string,
  TOptions extends Record<string, unknown>,
  TValue,
> {
  /** Unique name used as cache key prefix */
  readonly name: K;
  /** Compute indicator from candles */
  compute: (candles: NormalizedCandle[], options: TOptions) => Series<TValue>;
  /** Default options */
  defaultOptions: TOptions;
  /**
   * Generate cache key from options.
   * If omitted, defaults to `name` + JSON.stringify(options).
   */
  buildKey?: (options: TOptions) => string;
}

/**
 * Helper to define a type-safe indicator plugin
 *
 * @example
 * ```ts
 * import { defineIndicator } from "trendcraft";
 * import { sma } from "trendcraft";
 *
 * const mySma = defineIndicator({
 *   name: "mySma" as const,
 *   compute: (candles, opts) => sma(candles, opts),
 *   defaultOptions: { period: 20, source: "close" as const },
 * });
 *
 * const result = TrendCraft.from(candles).use(mySma, { period: 50 }).compute();
 * ```
 */
export function defineIndicator<
  K extends string,
  TOptions extends Record<string, unknown>,
  TValue,
>(
  plugin: IndicatorPlugin<K, TOptions, TValue>,
): IndicatorPlugin<K, TOptions, TValue> {
  return plugin;
}
