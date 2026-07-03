/**
 * Tag a Series with chart rendering metadata.
 * Non-destructive: mutates the array object by adding a non-enumerable
 * __meta property.
 *
 * @example
 * ```ts
 * import { tagSeries } from './tag-series';
 *
 * const result = sma(candles, { period: 20 });
 * const tagged = tagSeries(result, { overlay: true, label: 'SMA(20)' });
 * ```
 */

import type { Series, SeriesMeta, TaggedSeries } from "../types/candle";

export function tagSeries<T>(series: Series<T>, meta: SeriesMeta): TaggedSeries<T> {
  // Skip tagging empty arrays to preserve toEqual([]) in tests
  if (series.length === 0) return series as TaggedSeries<T>;
  const tagged = series as TaggedSeries<T>;
  // Non-enumerable per the TaggedSeries contract (see types/candle.ts):
  // __meta must not leak into Object.keys / for...in over the array.
  // Writable + configurable so an already-tagged series can be re-tagged.
  Object.defineProperty(tagged, "__meta", {
    value: meta,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  return tagged;
}

/**
 * Build a new SeriesMeta with the base label enriched by parameter values.
 *
 * Used by indicator functions so that multi-instance usage (e.g. three SMAs
 * on the same chart) produces distinguishable labels without the caller
 * having to name each one manually.
 *
 * Format:
 *   - No params            → `"SMA"`
 *   - One param            → `"SMA(20)"`
 *   - Multiple params      → `"MACD(12, 26, 9)"`
 *
 * Params are emitted in the order given. Values that are `undefined` or
 * `null` are skipped.
 *
 * @example
 * ```ts
 * import { withLabelParams } from "./tag-series";
 * import { SMA_META, MACD_META } from "../indicators/indicator-meta";
 *
 * withLabelParams(SMA_META, [20]);                   // label: "SMA(20)"
 * withLabelParams(MACD_META, [12, 26, 9]);           // label: "MACD(12, 26, 9)"
 * withLabelParams(MACD_META, [12, undefined, 9]);    // label: "MACD(12, 9)"
 * ```
 */
export function withLabelParams(
  meta: SeriesMeta,
  params: readonly (number | string | null | undefined)[],
): SeriesMeta {
  const visible = params.filter((p): p is number | string => p !== null && p !== undefined);
  if (visible.length === 0) return meta;
  return { ...meta, label: `${meta.label}(${visible.join(", ")})` };
}
