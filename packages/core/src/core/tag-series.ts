/**
 * Tag a Series with chart rendering metadata.
 * Non-destructive: mutates the array object by adding __meta property.
 *
 * @example
 * ```ts
 * import { tagSeries } from './tag-series';
 *
 * const result = computeIndicator(candles);
 * return tagSeries(result, { pane: 'main', label: 'SMA(20)' });
 * ```
 */

import type { Series, SeriesMeta, TaggedSeries } from "../types/candle";

export function tagSeries<T>(series: Series<T>, meta: SeriesMeta): TaggedSeries<T> {
  // Skip tagging empty arrays to preserve toEqual([]) in tests
  if (series.length === 0) return series as TaggedSeries<T>;
  const tagged = series as TaggedSeries<T>;
  tagged.__meta = meta;
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
 * import { withLabelParams, SMA_META } from "trendcraft";
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
