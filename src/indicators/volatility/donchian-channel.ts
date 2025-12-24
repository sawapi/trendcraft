/**
 * Donchian Channel
 * Shows highest high and lowest low over N periods
 * Used for breakout strategies (Turtle Trading)
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Donchian Channel values
 */
export type DonchianValue = {
  /** Upper band (highest high over period) */
  upper: number | null;
  /** Middle band (average of upper and lower) */
  middle: number | null;
  /** Lower band (lowest low over period) */
  lower: number | null;
};

/**
 * Options for Donchian Channel calculation
 */
export type DonchianOptions = {
  /** Period for channel calculation (default: 20) */
  period?: number;
};

/**
 * Calculate Donchian Channel
 *
 * The Donchian Channel shows the highest high and lowest low over N periods.
 * Originally developed for commodity trading and popularized by the Turtle Traders.
 *
 * Calculation:
 * - Upper Band = Highest High over N periods
 * - Lower Band = Lowest Low over N periods
 * - Middle Band = (Upper + Lower) / 2
 *
 * Trading signals:
 * - Price breaking above upper band = bullish breakout
 * - Price breaking below lower band = bearish breakout
 * - Turtle Trading: buy on 20-day high, sell on 10-day low
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Donchian Channel options
 * @returns Series of Donchian Channel values
 *
 * @example
 * ```ts
 * const donchian = donchianChannel(candles, { period: 20 });
 * const { upper, middle, lower } = donchian[i].value;
 *
 * if (currentPrice > upper) {
 *   // Breakout - potential buy signal
 * }
 * ```
 */
export function donchianChannel(
  candles: Candle[] | NormalizedCandle[],
  options: DonchianOptions = {},
): Series<DonchianValue> {
  const { period = 20 } = options;

  if (period < 1) {
    throw new Error("Donchian Channel period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<DonchianValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      // Not enough data yet
      result.push({
        time: normalized[i].time,
        value: { upper: null, middle: null, lower: null },
      });
      continue;
    }

    // Find highest high and lowest low over the period
    let highestHigh = Number.NEGATIVE_INFINITY;
    let lowestLow = Number.POSITIVE_INFINITY;

    for (let j = i - period + 1; j <= i; j++) {
      if (normalized[j].high > highestHigh) {
        highestHigh = normalized[j].high;
      }
      if (normalized[j].low < lowestLow) {
        lowestLow = normalized[j].low;
      }
    }

    const middle = (highestHigh + lowestLow) / 2;

    result.push({
      time: normalized[i].time,
      value: {
        upper: highestHigh,
        middle,
        lower: lowestLow,
      },
    });
  }

  return result;
}
