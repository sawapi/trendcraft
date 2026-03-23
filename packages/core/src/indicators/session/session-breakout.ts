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
import { type SessionDefinition, getIctSessions, isInSession } from "./session-definition";

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
    const date = new Date(candle.time);
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();

    // Find which session this candle belongs to
    let matchedSession: string | null = null;
    for (const session of sessionDefs) {
      if (isInSession(hour, minute, session)) {
        matchedSession = session.name;
        break;
      }
    }

    // Handle session transitions
    if (matchedSession !== activeSessionName) {
      // If we had an active session and it just ended, save its range
      if (activeSessionName !== null && activeHigh !== Number.NEGATIVE_INFINITY) {
        completedSessionName = activeSessionName;
        rangeHigh = activeHigh;
        rangeLow = activeLow;
      }

      // Start tracking new session
      if (matchedSession !== null) {
        activeSessionName = matchedSession;
        activeHigh = candle.high;
        activeLow = candle.low;
      } else {
        activeSessionName = null;
        activeHigh = Number.NEGATIVE_INFINITY;
        activeLow = Number.POSITIVE_INFINITY;
      }
    } else if (matchedSession !== null) {
      // Continue tracking current session
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

  return tagSeries(result, { pane: "main", label: "Session BO" });
}
