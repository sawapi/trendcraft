/**
 * Price Volume Trend (PVT) indicator
 *
 * PVT is similar to OBV but weights volume by the percentage change in price,
 * providing a more nuanced view of volume flow.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Calculate Price Volume Trend
 *
 * PVT = Previous PVT + Volume × ((Close - Previous Close) / Previous Close)
 *
 * Interpretation:
 * - Rising PVT confirms uptrend
 * - Falling PVT confirms downtrend
 * - Divergence between PVT and price can signal reversals
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of PVT values (null for first bar)
 *
 * @example
 * ```ts
 * const pvtData = pvt(candles);
 * // Compare PVT direction with price direction for divergence
 * ```
 */
export function pvt(candles: Candle[] | NormalizedCandle[]): Series<number | null> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  if (normalized.length === 0) return result;

  result.push({ time: normalized[0].time, value: 0 });

  let cumPvt = 0;

  for (let i = 1; i < normalized.length; i++) {
    const prevClose = normalized[i - 1].close;
    const close = normalized[i].close;
    const volume = normalized[i].volume;

    if (prevClose !== 0) {
      cumPvt += volume * ((close - prevClose) / prevClose);
    }

    result.push({ time: normalized[i].time, value: cumPvt });
  }

  return tagSeries(result, { kind: "pvt", overlay: false, label: "PVT" });
}
