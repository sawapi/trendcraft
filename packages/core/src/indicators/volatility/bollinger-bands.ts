/**
 * Bollinger Bands indicator
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type {
  BollingerBandsOptions,
  BollingerBandsValue,
  Candle,
  NormalizedCandle,
  Series,
} from "../../types";
import { BB_META } from "../indicator-meta";

/**
 * Calculate Bollinger Bands
 *
 * Middle Band = SMA(period)
 * Upper Band = Middle Band + (stdDev * Standard Deviation)
 * Lower Band = Middle Band - (stdDev * Standard Deviation)
 * %B = (Price - Lower Band) / (Upper Band - Lower Band)
 * Bandwidth = (Upper Band - Lower Band) / Middle Band
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Bollinger Bands options (period=20, stdDev=2, source='close')
 * @returns Series of Bollinger Bands values
 *
 * @example
 * ```ts
 * const bb = bollingerBands(candles);
 * const bbCustom = bollingerBands(candles, { period: 10, stdDev: 1.5 });
 * ```
 */
export function bollingerBands(
  candles: Candle[] | NormalizedCandle[],
  options: BollingerBandsOptions = {},
): Series<BollingerBandsValue> {
  const { period = 20, stdDev = 2, source = "close" } = options;

  if (period < 1) {
    throw new Error("Bollinger Bands period must be at least 1");
  }

  if (stdDev <= 0) {
    throw new Error("Standard deviation multiplier must be positive");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<BollingerBandsValue> = [];

  // Optimized O(n) algorithm using sliding window for mean and variance
  // Uses online algorithm for computing variance with O(1) updates

  // Handle initial null values (not enough data)
  for (let i = 0; i < period - 1 && i < normalized.length; i++) {
    result.push({
      time: normalized[i].time,
      value: {
        upper: null,
        middle: null,
        lower: null,
        percentB: null,
        bandwidth: null,
      },
    });
  }

  if (normalized.length < period) {
    return tagSeries(result, BB_META);
  }

  // Calculate initial window statistics
  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < period; i++) {
    const price = getPrice(normalized[i], source);
    sum += price;
    sumSquares += price * price;
  }

  // Helper to compute result for current window
  const computeResult = (index: number, windowSum: number, windowSumSquares: number) => {
    const middle = windowSum / period;
    // Variance = E[X²] - E[X]² = (sumSquares/n) - (sum/n)²
    const variance = windowSumSquares / period - middle * middle;
    // Handle numerical precision issues (variance should never be negative)
    const standardDeviation = Math.sqrt(Math.max(0, variance));

    const upper = middle + stdDev * standardDeviation;
    const lower = middle - stdDev * standardDeviation;

    const currentPrice = getPrice(normalized[index], source);
    const bandWidth = upper - lower;

    const percentB = bandWidth !== 0 ? (currentPrice - lower) / bandWidth : 0.5;
    const bandwidth = middle !== 0 ? bandWidth / middle : 0;

    return {
      time: normalized[index].time,
      value: { upper, middle, lower, percentB, bandwidth },
    };
  };

  // First valid result
  result.push(computeResult(period - 1, sum, sumSquares));

  // Slide the window - O(1) per iteration
  for (let i = period; i < normalized.length; i++) {
    const newPrice = getPrice(normalized[i], source);
    const oldPrice = getPrice(normalized[i - period], source);

    // Update running sums
    sum += newPrice - oldPrice;
    sumSquares += newPrice * newPrice - oldPrice * oldPrice;

    result.push(computeResult(i, sum, sumSquares));
  }

  return tagSeries(result, BB_META);
}
