/**
 * Rate of Change (ROC) indicator
 *
 * ROC measures the percentage change in price between the current price
 * and the price n periods ago.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { ROC_META } from "../indicator-meta";

/**
 * ROC options
 */
export type RocOptions = {
  /** Period for ROC calculation (default: 12) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Rate of Change
 *
 * ROC = ((Current Price - Price n periods ago) / Price n periods ago) × 100
 *
 * Interpretation:
 * - Positive ROC: Price is higher than n periods ago (bullish momentum)
 * - Negative ROC: Price is lower than n periods ago (bearish momentum)
 * - ROC crossing zero line can signal trend changes
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - ROC options
 * @returns Series of ROC values (percentage)
 *
 * @example
 * ```ts
 * const rocData = roc(candles); // Default 12-period ROC
 * const rocCustom = roc(candles, { period: 9 });
 *
 * // Check momentum
 * const isBullish = rocData[i].value > 0;
 * const isBearish = rocData[i].value < 0;
 * ```
 */
export function roc(
  candles: Candle[] | NormalizedCandle[],
  options: RocOptions = {},
): Series<number | null> {
  const { period = 12, source = "close" } = options;

  if (period < 1) {
    throw new Error("ROC period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    const currentPrice = getPrice(normalized[i], source);
    const pastPrice = getPrice(normalized[i - period], source);

    let rocValue: number | null = null;
    if (pastPrice !== 0) {
      rocValue = ((currentPrice - pastPrice) / pastPrice) * 100;
    } else {
      rocValue = 0;
    }

    result.push({ time: normalized[i].time, value: rocValue });
  }

  return tagSeries(result, ROC_META);
}
