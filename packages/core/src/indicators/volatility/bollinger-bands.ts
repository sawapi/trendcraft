/**
 * Bollinger Bands indicator
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { centeredMoments } from "../../core/statistics";
import { tagSeries, withLabelParams } from "../../core/tag-series";
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
    return tagSeries(result, withLabelParams(BB_META, [period, stdDev]));
  }

  // Window prices, kept in a plain array so each bar's statistics come from
  // the values themselves rather than from running sums.
  const window: number[] = [];
  for (let i = 0; i < period; i++) window.push(getPrice(normalized[i], source));

  // Helper to compute result for current window
  const computeResult = (index: number) => {
    // Two-pass: a running sum-of-squares cancels catastrophically at high
    // price levels (bands collapsing to zero width), and its error grows with
    // the length of the stream. This keeps the documented identity
    // `upper === middle + stdDev * standardDeviation(...)` exact at any price
    // level; see centeredMoments.
    const { mean: middle, sumSqDev } = centeredMoments(window);
    const standardDeviation = Math.sqrt(sumSqDev / period);

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
  result.push(computeResult(period - 1));

  // Slide the window one bar at a time
  for (let i = period; i < normalized.length; i++) {
    window.shift();
    window.push(getPrice(normalized[i], source));

    result.push(computeResult(i));
  }

  return tagSeries(result, withLabelParams(BB_META, [period, stdDev]));
}
