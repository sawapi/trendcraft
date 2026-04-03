/**
 * Coppock Curve indicator
 *
 * Originally designed by Edwin Coppock to identify long-term buying
 * opportunities in the S&P 500 and Dow Industrials.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Coppock Curve options
 */
export type CoppockCurveOptions = {
  /** WMA smoothing period (default: 10) */
  wmaPeriod?: number;
  /** Long ROC period (default: 14) */
  longRocPeriod?: number;
  /** Short ROC period (default: 11) */
  shortRocPeriod?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Coppock Curve
 *
 * Coppock = WMA(ROC(longPeriod) + ROC(shortPeriod), wmaPeriod)
 *
 * Interpretation:
 * - Buy signal when Coppock turns up from below zero
 * - Originally monthly data only, but applicable to other timeframes
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Coppock Curve options
 * @returns Series of Coppock Curve values (null for insufficient data)
 *
 * @example
 * ```ts
 * const cc = coppockCurve(candles);
 * // Buy when value crosses above zero from negative territory
 * ```
 */
export function coppockCurve(
  candles: Candle[] | NormalizedCandle[],
  options: CoppockCurveOptions = {},
): Series<number | null> {
  const { wmaPeriod = 10, longRocPeriod = 14, shortRocPeriod = 11, source = "close" } = options;

  if (wmaPeriod < 1 || longRocPeriod < 1 || shortRocPeriod < 1) {
    throw new Error("Coppock Curve periods must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));
  const maxRocPeriod = Math.max(longRocPeriod, shortRocPeriod);

  // Calculate combined ROC
  const combinedRoc: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < maxRocPeriod) {
      combinedRoc.push(null);
      continue;
    }

    const longBase = prices[i - longRocPeriod];
    const shortBase = prices[i - shortRocPeriod];

    if (longBase === 0 || shortBase === 0) {
      combinedRoc.push(null);
      continue;
    }

    const longRoc = ((prices[i] - longBase) / longBase) * 100;
    const shortRoc = ((prices[i] - shortBase) / shortBase) * 100;
    combinedRoc.push(longRoc + shortRoc);
  }

  // Apply WMA to combined ROC
  for (let i = 0; i < normalized.length; i++) {
    if (combinedRoc[i] === null) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Check if we have enough valid values for WMA
    let valid = true;
    for (let j = i - wmaPeriod + 1; j <= i; j++) {
      if (j < 0 || combinedRoc[j] === null) {
        valid = false;
        break;
      }
    }

    if (!valid) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Calculate WMA
    let weightedSum = 0;
    let weightTotal = 0;
    for (let j = 0; j < wmaPeriod; j++) {
      const weight = j + 1;
      weightedSum += weight * (combinedRoc[i - wmaPeriod + 1 + j] as number);
      weightTotal += weight;
    }

    result.push({ time: normalized[i].time, value: weightedSum / weightTotal });
  }

  return tagSeries(result, { overlay: false, label: "Coppock", referenceLines: [0] });
}
