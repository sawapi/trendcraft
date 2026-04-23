/**
 * Session Breakout Detection
 *
 * After a trading session ends, tracks its high/low range.
 * When price breaks above or below that range, emits a breakout signal.
 * Only tracks the most recent completed session.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import {
  type SessionDefinition,
  getIctSessions,
  isInAnyBreak,
  isInSessionWindow,
} from "./session-definition";
import { getTzHourMinute } from "./tz-utils";

/**
 * Options for sessionBreakout
 */
export type SessionBreakoutOptions = {
  /** Session definitions (default: ICT sessions) */
  sessions?: SessionDefinition[];
};

/**
 * Breakout status relative to the most recent completed session
 */
export type SessionBreakoutValue = {
  /** Previous session name that formed the range */
  fromSession: string | null;
  /** Breakout direction */
  breakout: "above" | "below" | null;
  /** Previous session high */
  rangeHigh: number | null;
  /** Previous session low */
  rangeLow: number | null;
};

/**
 * Detect breakouts from the most recent completed session range.
 *
 * Tracks each session's high/low while it is active. When the session ends,
 * its range becomes the reference. Subsequent bars are checked for breakouts
 * above the range high or below the range low.
 *
 * Only the most recently completed session is tracked at any time.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Session breakout options
 * @returns Series of SessionBreakoutValue
 *
 * @example
 * ```ts
 * import { sessionBreakout } from "trendcraft";
 *
 * const breakouts = sessionBreakout(candles);
 * breakouts.forEach(({ value }) => {
 *   if (value.breakout) {
 *     console.log(`Breakout ${value.breakout} from ${value.fromSession} range [${value.rangeLow}-${value.rangeHigh}]`);
 *   }
 * });
 * ```
 */
export function sessionBreakout(
  candles: Candle[] | NormalizedCandle[],
  options?: SessionBreakoutOptions,
): Series<SessionBreakoutValue> {
  if (candles.length === 0) return [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const sessionDefs = options?.sessions ?? getIctSessions();
  const result: Series<SessionBreakoutValue> = [];

  // Track current active session
  let activeSessionName: string | null = null;
  let activeHigh = Number.NEGATIVE_INFINITY;
  let activeLow = Number.POSITIVE_INFINITY;

  // Most recent completed session range
  let completedSessionName: string | null = null;
  let rangeHigh: number | null = null;
  let rangeLow: number | null = null;

  for (const candle of normalized) {
    // Determine session using the outer window; bars inside a break remain
    // attached to the session but do not update its range. Each session's
    // own timezone is honored.
    let matchedSession: SessionDefinition | null = null;
    let matchedHour = 0;
    let matchedMinute = 0;
    for (const session of sessionDefs) {
      const { hour, minute } = getTzHourMinute(candle.time, session.timezone);
      if (isInSessionWindow(hour, minute, session)) {
        matchedSession = session;
        matchedHour = hour;
        matchedMinute = minute;
        break;
      }
    }
    const matchedName = matchedSession?.name ?? null;
    const inBreak =
      matchedSession !== null &&
      matchedSession.breaks !== undefined &&
      isInAnyBreak(matchedHour, matchedMinute, matchedSession.breaks);

    // Handle session transitions
    if (matchedName !== activeSessionName) {
      // If we had an active session and it just ended, save its range
      if (activeSessionName !== null && activeHigh !== Number.NEGATIVE_INFINITY) {
        completedSessionName = activeSessionName;
        rangeHigh = activeHigh;
        rangeLow = activeLow;
      }

      // Start tracking new session
      if (matchedName !== null) {
        activeSessionName = matchedName;
        if (inBreak) {
          activeHigh = Number.NEGATIVE_INFINITY;
          activeLow = Number.POSITIVE_INFINITY;
        } else {
          activeHigh = candle.high;
          activeLow = candle.low;
        }
      } else {
        activeSessionName = null;
        activeHigh = Number.NEGATIVE_INFINITY;
        activeLow = Number.POSITIVE_INFINITY;
      }
    } else if (matchedName !== null && !inBreak) {
      // Continue tracking current session — skip break bars.
      activeHigh = Math.max(activeHigh, candle.high);
      activeLow = Math.min(activeLow, candle.low);
    }

    // Determine breakout (only when outside a session or in a different session)
    let breakout: "above" | "below" | null = null;
    if (rangeHigh !== null && rangeLow !== null) {
      if (candle.close > rangeHigh) {
        breakout = "above";
      } else if (candle.close < rangeLow) {
        breakout = "below";
      }
    }

    result.push({
      time: candle.time,
      value: {
        fromSession: completedSessionName,
        breakout,
        rangeHigh,
        rangeLow,
      },
    });
  }

  return tagSeries(result, { kind: "sessionBreakout", overlay: true, label: "Session BO" });
}
