/**
 * Opening Range Breakout (ORB) indicator
 *
 * Detects the opening range (high/low of the first N minutes of a session)
 * and identifies breakouts above or below that range.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Opening Range options
 */
export type OpeningRangeOptions = {
  /** Number of minutes for the opening range (default: 30) */
  minutes?: number;
  /**
   * How sessions are determined:
   * - 'day': Reset at the start of each calendar day (default)
   * - number: Reset every N candles (useful for fixed-interval data)
   */
  sessionResetPeriod?: "day" | number;
};

/**
 * Opening Range value
 */
export type OpeningRangeValue = {
  /** Opening range high */
  high: number | null;
  /** Opening range low */
  low: number | null;
  /** Breakout direction: 'above', 'below', or null */
  breakout: "above" | "below" | null;
};

/**
 * Calculate Opening Range Breakout
 *
 * 1. Identify the first N minutes of each session
 * 2. Record the high and low of that opening range
 * 3. After the opening range period, detect breakouts
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Opening Range options
 * @returns Series of Opening Range values
 *
 * @example
 * ```ts
 * // 30-minute opening range with daily session reset
 * const orb = openingRange(candles);
 *
 * // 15-minute opening range
 * const orb15 = openingRange(candles, { minutes: 15 });
 *
 * // Fixed session reset every 78 candles (e.g., 5-min bars in 6.5hr session)
 * const orbFixed = openingRange(candles, { minutes: 30, sessionResetPeriod: 78 });
 * ```
 */
export function openingRange(
  candles: Candle[] | NormalizedCandle[],
  options: OpeningRangeOptions = {},
): Series<OpeningRangeValue> {
  const { minutes = 30, sessionResetPeriod = "day" } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<OpeningRangeValue> = [];
  const MS_PER_DAY = 86400000;
  const openingRangeMs = minutes * 60 * 1000;

  let sessionStartTime = -1;
  let lastDayIndex = -1;
  let sessionStartBarIndex = 0;
  let orHigh = Number.NEGATIVE_INFINITY;
  let orLow = Number.POSITIVE_INFINITY;
  let orEstablished = false;

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];

    // Detect session reset
    let shouldReset = false;
    if (sessionResetPeriod === "day") {
      const currentDayIndex = Math.floor(candle.time / MS_PER_DAY);
      if (currentDayIndex !== lastDayIndex) {
        shouldReset = true;
        lastDayIndex = currentDayIndex;
      }
    } else {
      if (i === 0 || i - sessionStartBarIndex >= sessionResetPeriod) {
        shouldReset = true;
      }
    }

    if (shouldReset) {
      sessionStartTime = candle.time;
      sessionStartBarIndex = i;
      orHigh = Number.NEGATIVE_INFINITY;
      orLow = Number.POSITIVE_INFINITY;
      orEstablished = false;
    }

    const elapsed = candle.time - sessionStartTime;

    if (!orEstablished && elapsed < openingRangeMs) {
      // Within opening range — track high/low
      if (candle.high > orHigh) orHigh = candle.high;
      if (candle.low < orLow) orLow = candle.low;

      result.push({
        time: candle.time,
        value: {
          high: orHigh === Number.NEGATIVE_INFINITY ? null : orHigh,
          low: orLow === Number.POSITIVE_INFINITY ? null : orLow,
          breakout: null,
        },
      });
    } else {
      // Opening range is established
      if (!orEstablished) {
        // First bar after OR period — include this bar in OR if it starts exactly at the boundary
        orEstablished = true;
      }

      if (orHigh === Number.NEGATIVE_INFINITY || orLow === Number.POSITIVE_INFINITY) {
        // No valid opening range data
        result.push({
          time: candle.time,
          value: { high: null, low: null, breakout: null },
        });
        continue;
      }

      let breakout: "above" | "below" | null = null;
      if (candle.close > orHigh) {
        breakout = "above";
      } else if (candle.close < orLow) {
        breakout = "below";
      }

      result.push({
        time: candle.time,
        value: { high: orHigh, low: orLow, breakout },
      });
    }
  }

  return result;
}
