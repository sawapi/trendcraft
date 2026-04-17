/**
 * Volume Weighted Moving Average (VWMA) indicator
 *
 * VWMA gives more weight to periods with higher volume,
 * making it more reflective of actual traded prices.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { VWMA_META } from "../indicator-meta";

/**
 * VWMA options
 */
export type VwmaOptions = {
  /** Period for VWMA calculation */
  period: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Volume Weighted Moving Average
 *
 * VWMA = Sum(Price * Volume, n) / Sum(Volume, n)
 *
 * When volume is uniform, VWMA equals SMA.
 * When all volumes in the window are 0, returns null.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - VWMA options (period, source)
 * @returns Series of VWMA values (null for insufficient data or zero-volume windows)
 *
 * @example
 * ```ts
 * const vwma20 = vwma(candles, { period: 20 });
 * const vwmaHigh = vwma(candles, { period: 10, source: 'high' });
 * ```
 */
export function vwma(
  candles: Candle[] | NormalizedCandle[],
  options: VwmaOptions,
): Series<number | null> {
  const { period, source = "close" } = options;

  if (period < 1) {
    throw new Error("VWMA period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("VWMA period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  // Handle initial null values (not enough data)
  for (let i = 0; i < period - 1 && i < normalized.length; i++) {
    result.push({ time: normalized[i].time, value: null });
  }

  if (normalized.length < period) {
    return tagSeries(result, withLabelParams(VWMA_META, [period]));
  }

  // Calculate initial window sums
  let sumPV = 0;
  let sumV = 0;
  for (let i = 0; i < period; i++) {
    const price = getPrice(normalized[i], source);
    const vol = normalized[i].volume;
    sumPV += price * vol;
    sumV += vol;
  }
  result.push({
    time: normalized[period - 1].time,
    value: sumV === 0 ? null : sumPV / sumV,
  });

  // Slide the window: add new value, remove old value - O(1) per iteration
  for (let i = period; i < normalized.length; i++) {
    const newPrice = getPrice(normalized[i], source);
    const newVol = normalized[i].volume;
    const oldPrice = getPrice(normalized[i - period], source);
    const oldVol = normalized[i - period].volume;

    sumPV += newPrice * newVol - oldPrice * oldVol;
    sumV += newVol - oldVol;

    result.push({
      time: normalized[i].time,
      value: sumV === 0 ? null : sumPV / sumV,
    });
  }

  return tagSeries(result, withLabelParams(VWMA_META, [period]));
}
