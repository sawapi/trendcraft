/**
 * Batch ⇔ Incremental Bridge
 *
 * Utility to process an entire candle array through an incremental indicator,
 * producing the same output format as batch functions.
 */

import type { IndicatorValue, NormalizedCandle } from "../../types";
import type { IncrementalIndicator } from "./types";

/**
 * Process all candles through an incremental indicator and return a Series.
 *
 * This is the key bridge function for consistency testing:
 * `processAll(createXxx(opts), candles)` should produce identical output
 * to the batch `xxx(candles, opts)`.
 *
 * @param indicator - An incremental indicator instance
 * @param candles - Array of candles to process
 * @returns Array of indicator values matching batch output format
 *
 * @example
 * ```ts
 * import { createSma } from "trendcraft/incremental";
 * import { sma } from "trendcraft";
 *
 * const candles = [...];
 * const batch = sma(candles, { period: 20 });
 * const incremental = processAll(createSma({ period: 20 }), candles);
 * // batch and incremental should be identical
 * ```
 */
export function processAll<TValue>(
  indicator: IncrementalIndicator<TValue>,
  candles: NormalizedCandle[],
): IndicatorValue<TValue>[] {
  const results: IndicatorValue<TValue>[] = [];
  for (const candle of candles) {
    results.push(indicator.next(candle));
  }
  return results;
}
