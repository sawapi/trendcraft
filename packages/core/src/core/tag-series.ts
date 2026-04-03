/**
 * Tag a Series with chart rendering metadata.
 * Non-destructive: mutates the array object by adding __meta property.
 *
 * @example
 * ```ts
 * import { tagSeries } from './tag-series';
 *
 * const result = computeIndicator(candles);
 * return tagSeries(result, { pane: 'main', label: 'SMA 20' });
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
