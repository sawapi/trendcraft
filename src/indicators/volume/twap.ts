/**
 * Time-Weighted Average Price (TWAP)
 *
 * Equal-weighted average of typical prices within a session,
 * commonly used as an execution benchmark.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * TWAP options
 */
export type TwapOptions = {
  /**
   * Session reset logic:
   * - 'session': Reset at the start of each day (default)
   * - number: Reset every N candles
   */
  sessionResetPeriod?: "session" | number;
};

/**
 * Calculate Time-Weighted Average Price
 *
 * TWAP = Cumulative Sum of Typical Prices / Count (within session)
 * Typical Price = (High + Low + Close) / 3
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of TWAP values
 *
 * @example
 * ```ts
 * const result = twap(candles);
 * ```
 */
export function twap(
  candles: Candle[] | NormalizedCandle[],
  options: TwapOptions = {},
): Series<number | null> {
  const { sessionResetPeriod = "session" } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];
  const MS_PER_DAY = 86400000;

  let cumTp = 0;
  let count = 0;
  let lastDayIndex = -1;
  let sessionStart = 0;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    const currentDayIndex = Math.floor(c.time / MS_PER_DAY);

    // Check if we need to reset
    const shouldReset =
      (sessionResetPeriod === "session" &&
        currentDayIndex !== lastDayIndex &&
        lastDayIndex !== -1) ||
      (typeof sessionResetPeriod === "number" && i - sessionStart >= sessionResetPeriod);

    if (shouldReset) {
      cumTp = 0;
      count = 0;
      sessionStart = i;
    }

    lastDayIndex = currentDayIndex;

    const tp = (c.high + c.low + c.close) / 3;
    cumTp += tp;
    count++;

    result.push({
      time: c.time,
      value: cumTp / count,
    });
  }

  return result;
}
