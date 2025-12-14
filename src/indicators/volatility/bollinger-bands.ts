/**
 * Bollinger Bands indicator
 */

import { getPrice, normalizeCandles } from "../../core/normalize";
import type {
  BollingerBandsOptions,
  BollingerBandsValue,
  Candle,
  NormalizedCandle,
  Series,
} from "../../types";

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
  options: BollingerBandsOptions = {}
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

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      // Not enough data
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
    } else {
      // Calculate SMA and Standard Deviation
      let sum = 0;
      const values: number[] = [];

      for (let j = 0; j < period; j++) {
        const price = getPrice(normalized[i - j], source);
        sum += price;
        values.push(price);
      }

      const middle = sum / period;

      // Calculate standard deviation
      let squaredDiffSum = 0;
      for (const value of values) {
        squaredDiffSum += (value - middle) ** 2;
      }
      const standardDeviation = Math.sqrt(squaredDiffSum / period);

      const upper = middle + stdDev * standardDeviation;
      const lower = middle - stdDev * standardDeviation;

      const currentPrice = getPrice(normalized[i], source);
      const bandWidth = upper - lower;

      // %B: position within bands (0 = lower, 1 = upper)
      const percentB = bandWidth !== 0 ? (currentPrice - lower) / bandWidth : 0.5;

      // Bandwidth: volatility measure
      const bandwidth = middle !== 0 ? bandWidth / middle : 0;

      result.push({
        time: normalized[i].time,
        value: {
          upper,
          middle,
          lower,
          percentB,
          bandwidth,
        },
      });
    }
  }

  return result;
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
