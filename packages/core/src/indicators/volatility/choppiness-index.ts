/**
 * Choppiness Index indicator
 *
 * Measures whether the market is choppy (range-bound) or trending.
 * Values near 100 indicate choppiness, values near 0 indicate strong trend.
 * Common thresholds: above 61.8 = choppy, below 38.2 = trending.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { CHOPPINESS_META } from "../indicator-meta";

/**
 * Choppiness Index options
 */
export type ChoppinessIndexOptions = {
  /** Period for calculation (default: 14) */
  period?: number;
};

/**
 * Calculate Choppiness Index
 *
 * CHOP = 100 * LOG10(SUM(ATR(1), period) / (Highest High - Lowest Low)) / LOG10(period)
 *
 * Where:
 * - ATR(1) = True Range for each bar
 * - Highest High = highest high over the period
 * - Lowest Low = lowest low over the period
 *
 * Interpretation:
 * - Values near 100: Market is choppy/range-bound
 * - Values near 0: Market is trending strongly
 * - Above 61.8: Consolidating
 * - Below 38.2: Trending
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Choppiness Index options
 * @returns Series of Choppiness Index values (0-100, null for insufficient data)
 *
 * @example
 * ```ts
 * const chop = choppinessIndex(candles); // Default 14-period
 * const chop7 = choppinessIndex(candles, { period: 7 });
 * ```
 */
export function choppinessIndex(
  candles: Candle[] | NormalizedCandle[],
  options: ChoppinessIndexOptions = {},
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 2) {
    throw new Error("Choppiness Index period must be at least 2");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];

  // Calculate True Range for each bar (TR requires previous close, so index 0 has no TR)
  const trueRanges: number[] = new Array(normalized.length).fill(0);
  for (let i = 1; i < normalized.length; i++) {
    const current = normalized[i];
    const prevClose = normalized[i - 1].close;
    trueRanges[i] = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose),
    );
  }

  const log10Period = Math.log10(period);

  for (let i = 0; i < normalized.length; i++) {
    // Need at least period bars of TR data (starting from index 1)
    if (i < period) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Sum of True Range over period
    let trSum = 0;
    let highestHigh = Number.NEGATIVE_INFINITY;
    let lowestLow = Number.POSITIVE_INFINITY;

    for (let j = i - period + 1; j <= i; j++) {
      trSum += trueRanges[j];
      highestHigh = Math.max(highestHigh, normalized[j].high);
      lowestLow = Math.min(lowestLow, normalized[j].low);
    }

    const range = highestHigh - lowestLow;
    if (range <= 0) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    const chopValue = (100 * Math.log10(trSum / range)) / log10Period;
    result.push({ time: normalized[i].time, value: chopValue });
  }

  return tagSeries(result, CHOPPINESS_META);
}
