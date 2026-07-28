/**
 * Time-Weighted Average Price (TWAP)
 *
 * Equal-weighted average of typical prices within a session,
 * commonly used as an execution benchmark.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import {
  assertSessionResetCompatible,
  resolveSessionMembership,
  type SessionDefinition,
} from "../session/session-definition";

/**
 * TWAP options
 */
export type TwapOptions = {
  /**
   * Session reset logic:
   * - 'session': Reset at the start of each day (default)
   * - number: Reset every N candles
   *
   * Cannot be combined with `session`, which brings its own boundaries.
   */
  sessionResetPeriod?: "session" | number;
  /**
   * Trading session the average belongs to.
   *
   * Without it, the average restarts at UTC midnight, which is not when any
   * exchange's trading day begins — for US equities it is 19:00 or 20:00 New
   * York time, after the close — so one reset period runs from a day's
   * post-market through the next day's pre-market, regular session and
   * post-market. With it, the average restarts when the session does, in the
   * session's own timezone, and only bars inside the session contribute: bars
   * outside the window, and bars inside one of its breaks, produce `null` and
   * leave the running totals untouched.
   *
   * Handles sessions that cross midnight and days when the clock shifts for
   * DST.
   */
  session?: SessionDefinition;
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
  const { sessionResetPeriod = "session", session } = options;

  if (session) {
    assertSessionResetCompatible("twap", "sessionResetPeriod", sessionResetPeriod, "session");
  }

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

  if (session) {
    // Session-anchored: the average covers one session occurrence, restarting
    // when the session does rather than at UTC midnight.
    let currentOccurrence = -1;

    for (const c of normalized) {
      const membership = resolveSessionMembership(c.time, session);

      if (!membership.active) {
        // Outside the window, or inside a break: not part of the session's
        // average, and must not move the running totals either.
        result.push({ time: c.time, value: null });
        continue;
      }

      if (membership.occurrenceKey !== currentOccurrence) {
        cumTp = 0;
        count = 0;
        currentOccurrence = membership.occurrenceKey;
      }

      cumTp += (c.high + c.low + c.close) / 3;
      count++;

      result.push({ time: c.time, value: cumTp / count });
    }

    return result;
  }

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
