/**
 * Highest/Lowest price indicators
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, HighestLowestOptions, NormalizedCandle, Series } from "../../types";

/**
 * Result type for highest/lowest
 */
export type HighestLowestValue = {
  highest: number | null;
  lowest: number | null;
};

/**
 * Calculate Highest and Lowest values over n periods
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options (period, source='high'/'low')
 * @returns Series of highest/lowest values
 *
 * @example
 * ```ts
 * const hl20 = highestLowest(candles, { period: 20 });
 * console.log(hl20[i].value.highest); // 20-period high
 * console.log(hl20[i].value.lowest);  // 20-period low
 * ```
 */
export function highestLowest(
  candles: Candle[] | NormalizedCandle[],
  options: HighestLowestOptions,
): Series<HighestLowestValue> {
  const { period } = options;

  if (period < 1) {
    throw new Error("Period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<HighestLowestValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({
        time: normalized[i].time,
        value: { highest: null, lowest: null },
      });
    } else {
      let highest = Number.NEGATIVE_INFINITY;
      let lowest = Number.POSITIVE_INFINITY;

      for (let j = 0; j < period; j++) {
        const candle = normalized[i - j];
        if (candle.high > highest) highest = candle.high;
        if (candle.low < lowest) lowest = candle.low;
      }

      result.push({
        time: normalized[i].time,
        value: { highest, lowest },
      });
    }
  }

  return result;
}

/**
 * Calculate only highest high over n periods
 *
 * @param candles - Array of candles
 * @param period - Lookback period
 * @returns Series of highest values
 */
export function highest(
  candles: Candle[] | NormalizedCandle[],
  period: number,
): Series<number | null> {
  if (period < 1) {
    throw new Error("Period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      let max = Number.NEGATIVE_INFINITY;
      for (let j = 0; j < period; j++) {
        if (normalized[i - j].high > max) {
          max = normalized[i - j].high;
        }
      }
      result.push({ time: normalized[i].time, value: max });
    }
  }

  return result;
}

/**
 * Calculate only lowest low over n periods
 *
 * @param candles - Array of candles
 * @param period - Lookback period
 * @returns Series of lowest values
 */
export function lowest(
  candles: Candle[] | NormalizedCandle[],
  period: number,
): Series<number | null> {
  if (period < 1) {
    throw new Error("Period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      let min = Number.POSITIVE_INFINITY;
      for (let j = 0; j < period; j++) {
        if (normalized[i - j].low < min) {
          min = normalized[i - j].low;
        }
      }
      result.push({ time: normalized[i].time, value: min });
    }
  }

  return result;
}
