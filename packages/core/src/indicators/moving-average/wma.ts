/**
 * Weighted Moving Average (WMA) indicator
 *
 * WMA gives more weight to recent prices, making it more responsive
 * to price changes than SMA.
 */

import { getPrice, isNormalized } from "../../core/normalize";
import { normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * WMA options
 */
export type WmaOptions = {
  /** Period for WMA calculation */
  period: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Weighted Moving Average
 *
 * WMA = (P1 * n + P2 * (n-1) + ... + Pn * 1) / (n * (n+1) / 2)
 *
 * Where:
 * - P1 = most recent price
 * - Pn = oldest price
 * - n = period
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - WMA options (period, source)
 * @returns Series of WMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const wma20 = wma(candles, { period: 20 });
 * const wmaHigh = wma(candles, { period: 10, source: 'high' });
 * ```
 */
export function wma(
  candles: Candle[] | NormalizedCandle[],
  options: WmaOptions,
): Series<number | null> {
  const { period, source = "close" } = options;

  if (period < 1) {
    throw new Error("WMA period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("WMA period must be an integer");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  // Denominator: n * (n + 1) / 2
  const weightSum = (period * (period + 1)) / 2;

  // Optimized O(n) sliding window algorithm for WMA
  // WMA = (P0*n + P1*(n-1) + ... + P(n-1)*1) / weightSum
  // For sliding: WMA_new = (WMA_old * weightSum - simpleSum + P_new * n) / weightSum
  // where simpleSum = P0 + P1 + ... + P(n-1) (sum of prices in window)

  // Handle initial null values (not enough data)
  for (let i = 0; i < period - 1 && i < normalized.length; i++) {
    result.push({ time: normalized[i].time, value: null });
  }

  if (normalized.length < period) {
    return tagSeries(result, { pane: "main", label: "WMA" });
  }

  // Calculate initial weighted sum and simple sum
  let weightedSum = 0;
  let simpleSum = 0;
  for (let i = 0; i < period; i++) {
    const price = getPrice(normalized[i], source);
    const weight = i + 1; // Weight increases from 1 to period
    weightedSum += price * weight;
    simpleSum += price;
  }
  result.push({ time: normalized[period - 1].time, value: weightedSum / weightSum });

  // Slide the window - O(1) per iteration
  // When window slides: old weights shift down, new element gets weight=period
  // weightedSum_new = weightedSum - simpleSum + newPrice * period
  // simpleSum_new = simpleSum - oldestPrice + newPrice
  for (let i = period; i < normalized.length; i++) {
    const newPrice = getPrice(normalized[i], source);
    const oldPrice = getPrice(normalized[i - period], source);

    // Remove contribution of all old weights shifting down (= simpleSum)
    // and add new price with highest weight
    weightedSum = weightedSum - simpleSum + newPrice * period;

    // Update simple sum for next iteration
    simpleSum = simpleSum - oldPrice + newPrice;

    result.push({ time: normalized[i].time, value: weightedSum / weightSum });
  }

  return tagSeries(result, { pane: "main", label: "WMA" });
}
