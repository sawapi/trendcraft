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
import { getTzHourMinute } from "./tz-utils";

/**
 * An intra-session break (e.g. lunch break on JPX/HKEX).
 * Start/end times are interpreted in the same timezone as the parent session.
 */
export type SessionBreak = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

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
  /**
   * Optional intra-session breaks (e.g. JPX lunch 11:30-12:30).
   * Bars falling inside a break are considered out-of-session:
   * `inSession=false`, `barIndex` does not advance, and session O/H/L are preserved.
   */
  breaks?: SessionBreak[];
  /**
   * Optional IANA timezone for interpreting startHour/startMinute/endHour/endMinute
   * and any breaks (e.g. "America/New_York", "Asia/Tokyo"). Defaults to "UTC".
   * When set, DST is handled automatically by the runtime's tzdata.
   */
  timezone?: string;
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
 * Returns the JPX (Tokyo Stock Exchange) session in UTC with a lunch break.
 *
 * JPX regular hours (effective 2024-11-05): 09:00–11:30 / 12:30–15:30 JST
 * (UTC+9, no DST). In UTC: 00:00–06:30 with a break at 02:30–03:30.
 *
 * Note: Real JPX market data has no bars during the lunch break; the `breaks`
 * field is for 24×7 data sources (crypto / FX) or synthetic bars that cross
 * the lunch hour and need to be excluded from session statistics.
 *
 * @example
 * ```ts
 * const sessions = getJpxSessions();
 * const info = detectSessions(candles, sessions);
 * ```
 */
export function getJpxSessions(): SessionDefinition[] {
  return [
    {
      name: "JPX",
      startHour: 0,
      startMinute: 0,
      endHour: 6,
      endMinute: 30,
      breaks: [{ startHour: 2, startMinute: 30, endHour: 3, endMinute: 30 }],
    },
  ];
}

/**
 * Returns the HKEX (Hong Kong) session in UTC with a lunch break.
 *
 * HKEX regular hours: 09:30-12:00 / 13:00-16:00 HKT (UTC+8, no DST).
 * In UTC: 01:30-08:00 with a break at 04:00-05:00.
 */
export function getHkexSessions(): SessionDefinition[] {
  return [
    {
      name: "HKEX",
      startHour: 1,
      startMinute: 30,
      endHour: 8,
      endMinute: 0,
      breaks: [{ startHour: 4, startMinute: 0, endHour: 5, endMinute: 0 }],
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
  if (
    !isInTimeWindow(
      hour,
      minute,
      session.startHour,
      session.startMinute,
      session.endHour,
      session.endMinute,
    )
  ) {
    return false;
  }
  if (session.breaks && isInAnyBreak(hour, minute, session.breaks)) {
    return false;
  }
  return true;
}

/**
 * Check if (hour, minute) matches the session's start/end window, ignoring breaks.
 * Used to keep the "anchor" session state through breaks.
 */
export function isInSessionWindow(
  hour: number,
  minute: number,
  session: SessionDefinition,
): boolean {
  return isInTimeWindow(
    hour,
    minute,
    session.startHour,
    session.startMinute,
    session.endHour,
    session.endMinute,
  );
}

/**
 * Check if (hour, minute) falls inside any of the given breaks.
 */
export function isInAnyBreak(hour: number, minute: number, breaks: SessionBreak[]): boolean {
  for (const br of breaks) {
    if (isInTimeWindow(hour, minute, br.startHour, br.startMinute, br.endHour, br.endMinute)) {
      return true;
    }
  }
  return false;
}

function isInTimeWindow(
  hour: number,
  minute: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): boolean {
  const timeMinutes = hour * 60 + minute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes <= endMinutes) {
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }
  // Window crosses midnight (e.g., 22:00 - 05:00)
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
    // Find the session whose outer window contains this candle (break-agnostic),
    // evaluating each session in its own configured timezone.
    let anchorSession: SessionDefinition | null = null;
    let anchorHour = 0;
    let anchorMinute = 0;
    for (const session of sessionDefs) {
      const { hour, minute } = getTzHourMinute(candle.time, session.timezone);
      if (isInSessionWindow(hour, minute, session)) {
        anchorSession = session;
        anchorHour = hour;
        anchorMinute = minute;
        break;
      }
    }
    const inBreak =
      anchorSession !== null &&
      anchorSession.breaks !== undefined &&
      isInAnyBreak(anchorHour, anchorMinute, anchorSession.breaks);
    const anchorName = anchorSession?.name ?? null;

    // Session anchor changed (new session entered, or fell outside everything)
    if (anchorName !== currentSessionName) {
      currentSessionName = anchorName;
      barIndex = 0;
      if (anchorName !== null && !inBreak) {
        sessionOpen = candle.open;
        sessionHigh = candle.high;
        sessionLow = candle.low;
      } else if (anchorName !== null && inBreak) {
        // Entered a session for the first time during its own break (unusual but handle gracefully).
        // Treat as session started, but this bar does not advance the session.
        sessionOpen = candle.open;
        sessionHigh = candle.high;
        sessionLow = candle.low;
      } else {
        sessionOpen = null;
        sessionHigh = null;
        sessionLow = null;
      }
    } else if (anchorName !== null && !inBreak) {
      barIndex++;
      sessionHigh = Math.max(sessionHigh ?? candle.high, candle.high);
      sessionLow = Math.min(sessionLow ?? candle.low, candle.low);
    }
    // if anchorName !== null && inBreak: preserve everything, don't advance barIndex.

    result.push({
      time: candle.time,
      value: {
        session: anchorName,
        inSession: anchorName !== null && !inBreak,
        barIndex,
        sessionOpen,
        sessionHigh,
        sessionLow,
      },
    });
  }

  return result;
}
