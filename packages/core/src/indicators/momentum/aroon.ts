/**
 * Aroon Indicator
 *
 * Measures the time since the last high/low within a lookback period.
 * Used to identify trends and potential reversals.
 *
 * Aroon Up = ((period - bars since highest high) / period) × 100
 * Aroon Down = ((period - bars since lowest low) / period) × 100
 * Aroon Oscillator = Aroon Up - Aroon Down
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { AROON_META } from "../indicator-meta";

/**
 * Aroon options
 */
export type AroonOptions = {
  /** Period for Aroon calculation (default: 25) */
  period?: number;
};

/**
 * Aroon value
 */
export type AroonValue = {
  /** Aroon Up (0-100) */
  up: number | null;
  /** Aroon Down (0-100) */
  down: number | null;
  /** Aroon Oscillator (Up - Down, range: -100 to 100) */
  oscillator: number | null;
};

/**
 * Calculate Aroon Indicator
 *
 * Interpretation:
 * - Aroon Up > 70: Strong uptrend
 * - Aroon Down > 70: Strong downtrend
 * - Aroon Up crossing above Aroon Down: Bullish signal
 * - Oscillator > 0: Bullish, < 0: Bearish
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Aroon options
 * @returns Series of Aroon values
 *
 * @example
 * ```ts
 * const aroonData = aroon(candles, { period: 25 });
 * const { up, down, oscillator } = aroonData[i].value;
 *
 * if (up > 70 && down < 30) {
 *   // Strong uptrend
 * }
 * ```
 */
export function aroon(
  candles: Candle[] | NormalizedCandle[],
  options: AroonOptions = {},
): Series<AroonValue> {
  const { period = 25 } = options;

  if (period < 1) throw new Error("Aroon period must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<AroonValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      result.push({
        time: normalized[i].time,
        value: { up: null, down: null, oscillator: null },
      });
      continue;
    }

    // Find bars since highest high and lowest low
    let highestIdx = i;
    let lowestIdx = i;

    for (let j = i - period; j <= i; j++) {
      if (normalized[j].high >= normalized[highestIdx].high) {
        highestIdx = j;
      }
      if (normalized[j].low <= normalized[lowestIdx].low) {
        lowestIdx = j;
      }
    }

    const barsSinceHigh = i - highestIdx;
    const barsSinceLow = i - lowestIdx;

    const up = ((period - barsSinceHigh) / period) * 100;
    const down = ((period - barsSinceLow) / period) * 100;
    const oscillator = up - down;

    result.push({
      time: normalized[i].time,
      value: { up, down, oscillator },
    });
  }

  return tagSeries(result, AROON_META);
}
