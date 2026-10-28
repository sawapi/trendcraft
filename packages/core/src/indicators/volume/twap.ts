/**
 * Time-Weighted Average Price (TWAP)
 *
 * Equal-weighted average of typical prices within a session,
 * commonly used as an execution benchmark.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { assertResetPeriod } from "../../utils/validate-period";
import { TWAP_META } from "../indicator-meta";
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
   * Only the default `'session'` may be combined with `session`, which brings
   * its own boundaries; a bar count throws.
   */
  sessionResetPeriod?: "session" | number;
  /**
   * Trading session the average belongs to.
   *
   * Without it, the average restarts at UTC midnight rather than at a session
   * boundary. For a series limited to regular trading hours the two often
   * coincide — a US equity day sits inside one UTC date — but it breaks once
   * the series carries extended hours: UTC midnight is 19:00 or 20:00 in New
   * York, part-way through the post-market, so one reset period runs from
   * there through the next day's pre-market, regular session and post-market.
   * It never lines up for a session that itself crosses UTC midnight.
   *
   * With it, the average restarts when the session does, in the
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
 * @throws If `sessionResetPeriod` is not `"session"` or a positive integer, or
 *   a bar count is combined with `session`
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
  assertResetPeriod("TWAP sessionResetPeriod", sessionResetPeriod, ["session"]);

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

    return tagSeries(result, TWAP_META);
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

  return tagSeries(result, TWAP_META);
}
