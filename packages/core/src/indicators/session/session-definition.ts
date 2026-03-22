/**
 * Session Definition and Detection
 *
 * Defines trading sessions (ICT standard or custom) and detects
 * which session each candle belongs to based on UTC time.
 *
 * Note: All times are in UTC. ICT sessions are converted from ET (UTC-5).
 * DST is ignored for simplicity — sessions use fixed UTC offsets.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Definition of a trading session with start/end times in UTC
 */
export type SessionDefinition = {
  name: string;
  /** Start hour in UTC (0-23) */
  startHour: number;
  /** Start minute (0-59) */
  startMinute: number;
  /** End hour in UTC (0-23) */
  endHour: number;
  /** End minute (0-59) */
  endMinute: number;
};

/**
 * Information about which session a bar belongs to
 */
export type SessionInfo = {
  /** Which session this bar belongs to (null if outside all sessions) */
  session: string | null;
  /** Whether this bar is within any defined session */
  inSession: boolean;
  /** Index of the bar within the current session (0-based) */
  barIndex: number;
  /** Session open price (first bar's open) */
  sessionOpen: number | null;
  /** Session high so far */
  sessionHigh: number | null;
  /** Session low so far */
  sessionLow: number | null;
};

/**
 * Returns the standard ICT sessions in UTC (converted from ET, UTC-5).
 *
 * - Asia: 00:00-05:00 UTC (19:00-00:00 ET)
 * - London: 07:00-10:00 UTC (02:00-05:00 ET)
 * - NY AM: 13:30-16:00 UTC (08:30-11:00 ET)
 * - NY PM: 18:30-21:00 UTC (13:30-16:00 ET)
 *
 * Note: DST is ignored; times use fixed UTC-5 offset.
 *
 * @returns Array of ICT session definitions
 *
 * @example
 * ```ts
 * const sessions = getIctSessions();
 * // [{ name: "Asia", startHour: 0, ... }, ...]
 * ```
 */
export function getIctSessions(): SessionDefinition[] {
  return [
    { name: "Asia", startHour: 0, startMinute: 0, endHour: 5, endMinute: 0 },
    {
      name: "London",
      startHour: 7,
      startMinute: 0,
      endHour: 10,
      endMinute: 0,
    },
    {
      name: "NY AM",
      startHour: 13,
      startMinute: 30,
      endHour: 16,
      endMinute: 0,
    },
    {
      name: "NY PM",
      startHour: 18,
      startMinute: 30,
      endHour: 21,
      endMinute: 0,
    },
  ];
}

/**
 * Factory function to create a custom session definition.
 *
 * @param name - Session name
 * @param startHour - Start hour in UTC (0-23)
 * @param startMinute - Start minute (0-59)
 * @param endHour - End hour in UTC (0-23)
 * @param endMinute - End minute (0-59)
 * @returns A SessionDefinition object
 *
 * @example
 * ```ts
 * const custom = defineSession("Pre-Market", 8, 0, 9, 30);
 * ```
 */
export function defineSession(
  name: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): SessionDefinition {
  return { name, startHour, startMinute, endHour, endMinute };
}

/**
 * Check if a given UTC time (hour + minute) is within a session.
 * Handles both normal sessions (start < end) and midnight-crossing sessions.
 */
export function isInSession(hour: number, minute: number, session: SessionDefinition): boolean {
  const timeMinutes = hour * 60 + minute;
  const startMinutes = session.startHour * 60 + session.startMinute;
  const endMinutes = session.endHour * 60 + session.endMinute;

  if (startMinutes <= endMinutes) {
    // Normal session (no midnight crossing)
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }
  // Session crosses midnight (e.g., 22:00 - 05:00)
  return timeMinutes >= startMinutes || timeMinutes < endMinutes;
}

/**
 * Detect which session each candle belongs to.
 *
 * For each candle, determines the matching session based on UTC time.
 * Tracks session open/high/low, resetting when session changes.
 * If a candle falls outside all sessions, session fields are null.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param sessions - Session definitions (default: ICT sessions)
 * @returns Series of SessionInfo values
 *
 * @example
 * ```ts
 * import { detectSessions, getIctSessions } from "trendcraft";
 *
 * const result = detectSessions(candles);
 * result.forEach(({ value }) => {
 *   if (value.inSession) {
 *     console.log(`${value.session}: O=${value.sessionOpen} H=${value.sessionHigh} L=${value.sessionLow}`);
 *   }
 * });
 * ```
 */
export function detectSessions(
  candles: Candle[] | NormalizedCandle[],
  sessions?: SessionDefinition[],
): Series<SessionInfo> {
  if (candles.length === 0) return [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const sessionDefs = sessions ?? getIctSessions();
  const result: Series<SessionInfo> = [];

  let currentSessionName: string | null = null;
  let barIndex = 0;
  let sessionOpen: number | null = null;
  let sessionHigh: number | null = null;
  let sessionLow: number | null = null;

  for (const candle of normalized) {
    // candle.time is in milliseconds after normalization
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

    // Check if session changed
    if (matchedSession !== currentSessionName) {
      currentSessionName = matchedSession;
      barIndex = 0;
      if (matchedSession !== null) {
        sessionOpen = candle.open;
        sessionHigh = candle.high;
        sessionLow = candle.low;
      } else {
        sessionOpen = null;
        sessionHigh = null;
        sessionLow = null;
      }
    } else if (matchedSession !== null) {
      barIndex++;
      sessionHigh = Math.max(sessionHigh ?? candle.high, candle.high);
      sessionLow = Math.min(sessionLow ?? candle.low, candle.low);
    }

    result.push({
      time: candle.time,
      value: {
        session: matchedSession,
        inSession: matchedSession !== null,
        barIndex,
        sessionOpen,
        sessionHigh,
        sessionLow,
      },
    });
  }

  return result;
}
