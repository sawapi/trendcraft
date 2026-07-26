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
  getIctSessions,
  isInAnyBreak,
  isInSessionWindow,
  type SessionDefinition,
  sessionOccurrenceKey,
} from "./session-definition";
import { getTzDateTime, type TzDateTime } from "./tz-utils";

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
  let activeOccurrence = -1;

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
    let matchedLocal: TzDateTime | null = null;
    for (const session of sessionDefs) {
      const local = getTzDateTime(candle.time, session.timezone);
      if (isInSessionWindow(local.hour, local.minute, session)) {
        matchedSession = session;
        matchedHour = local.hour;
        matchedMinute = local.minute;
        matchedLocal = local;
        break;
      }
    }
    const matchedName = matchedSession?.name ?? null;
    const inBreak =
      matchedSession !== null &&
      matchedSession.breaks !== undefined &&
      isInAnyBreak(matchedHour, matchedMinute, matchedSession.breaks);

    const occurrence =
      matchedSession === null || matchedLocal === null
        ? -1
        : sessionOccurrenceKey(matchedLocal, matchedSession);

    // The same session starting again — the day it opened on changed. Data
    // holding only in-session bars never leaves the window, so without this the
    // session never completes and no range is ever published.
    const rolledOver =
      matchedName !== null && matchedName === activeSessionName && occurrence !== activeOccurrence;
    activeOccurrence = occurrence;

    // Handle session transitions
    if (matchedName !== activeSessionName || rolledOver) {
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
