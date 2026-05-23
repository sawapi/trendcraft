/**
 * Incremental Opening Range (ORB)
 *
 * Tracks the opening range high/low during the first N minutes of a session,
 * then detects breakouts above or below the established range.
 *
 * State category: **Mixed** (a session-scoped accumulator: the current
 * session's running high/low and the derived `orDurationMs` / reset
 * rule are all conditioned on construction-time params). Resume with a
 * different `minutes` / `sessionResetPeriod` would silently re-time or
 * restart the in-flight session, so any param change is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type OpeningRangeValue = {
  /** Opening range high, null until first bar */
  high: number | null;
  /** Opening range low, null until first bar */
  low: number | null;
  /** Breakout direction after OR is established */
  breakout: "above" | "below" | null;
};

/**
 * Bare state shape for Opening Range. Params (`minutes`,
 * `sessionResetPeriod`) live in `meta.params` on the wire.
 */
export type OpeningRangeState = {
  sessionStartTime: number | null;
  sessionStartBarIndex: number;
  orHigh: number | null;
  orLow: number | null;
  orEstablished: boolean;
  /**
   * Sticky flag: `true` once any session's opening range has been
   * established. `orEstablished` resets per session, but the
   * indicator's overall warm-up is a one-way latch — this drives the
   * monotonic `isWarmedUp` getter.
   */
  everEstablished: boolean;
  lastDayIndex: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const OPENING_RANGE_VERSION = 1;

type OpeningRangeParams = {
  minutes: number;
  sessionResetPeriod: "day" | number;
};

const nullValue: OpeningRangeValue = { high: null, low: null, breakout: null };

/**
 * Detect if a new session has started based on the reset period.
 * For 'day' mode, a new session starts when the calendar day changes.
 * For numeric mode, a new session starts every N bars.
 */
function isNewSession(
  time: number,
  prevTime: number | null,
  sessionResetPeriod: "day" | number,
  barCount: number,
  sessionStartBarIndex: number,
): boolean {
  if (prevTime === null) return true;

  if (sessionResetPeriod === "day") {
    const prevDate = new Date(prevTime);
    const currDate = new Date(time);
    return (
      prevDate.getUTCFullYear() !== currDate.getUTCFullYear() ||
      prevDate.getUTCMonth() !== currDate.getUTCMonth() ||
      prevDate.getUTCDate() !== currDate.getUTCDate()
    );
  }

  // Numeric: reset every N bars
  return barCount - sessionStartBarIndex >= sessionResetPeriod;
}

/**
 * Create an incremental Opening Range indicator
 *
 * Tracks the high/low during the opening period and detects breakouts after
 * the opening range is established.
 *
 * @example
 * ```ts
 * const orb = createOpeningRange({ minutes: 30 });
 * for (const candle of stream) {
 *   const { value } = orb.next(candle);
 *   if (value.breakout) {
 *     console.log(`Breakout ${value.breakout}! OR: ${value.low}-${value.high}`);
 *   }
 * }
 * ```
 */
export function createOpeningRange(
  options: { minutes?: number; sessionResetPeriod?: "day" | number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<OpeningRangeState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<OpeningRangeValue, IndicatorSnapshot<OpeningRangeState>> {
  const { params, state } = resolveResume<OpeningRangeParams, OpeningRangeState>({
    indicator: "openingRange",
    version: OPENING_RANGE_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { minutes: 30, sessionResetPeriod: "day" },
  });

  const minutes = params.minutes;
  const sessionResetPeriod = params.sessionResetPeriod;
  const orDurationMs = minutes * 60 * 1000;

  let sessionStartTime: number | null;
  let sessionStartBarIndex: number;
  let orHigh: number | null;
  let orLow: number | null;
  let orEstablished: boolean;
  let everEstablished: boolean;
  let lastDayIndex: number;
  let count: number;

  if (state !== null) {
    sessionStartTime = state.sessionStartTime;
    sessionStartBarIndex = state.sessionStartBarIndex;
    orHigh = state.orHigh;
    orLow = state.orLow;
    orEstablished = state.orEstablished;
    everEstablished = state.everEstablished ?? state.orEstablished;
    lastDayIndex = state.lastDayIndex;
    count = state.count;
  } else {
    sessionStartTime = null;
    sessionStartBarIndex = 0;
    orHigh = null;
    orLow = null;
    orEstablished = false;
    everEstablished = false;
    lastDayIndex = 0;
    count = 0;
  }

  function computeValue(
    candle: NormalizedCandle,
    h: number | null,
    l: number | null,
    established: boolean,
  ): OpeningRangeValue {
    if (h === null || l === null) return nullValue;

    let breakout: "above" | "below" | null = null;
    if (established) {
      if (candle.close > h) breakout = "above";
      else if (candle.close < l) breakout = "below";
    }

    return { high: h, low: l, breakout };
  }

  const indicator: IncrementalIndicator<OpeningRangeValue, IndicatorSnapshot<OpeningRangeState>> = {
    next(candle: NormalizedCandle) {
      count++;

      const newSession = isNewSession(
        candle.time,
        sessionStartTime,
        sessionResetPeriod,
        count - 1,
        sessionStartBarIndex,
      );

      if (newSession) {
        sessionStartTime = candle.time;
        sessionStartBarIndex = count - 1;
        orHigh = candle.high;
        orLow = candle.low;
        orEstablished = false;
        lastDayIndex = count - 1;
      }

      // Within opening range period
      if (!orEstablished && sessionStartTime !== null) {
        const elapsed = candle.time - sessionStartTime;
        if (elapsed < orDurationMs) {
          // Still accumulating OR
          if (orHigh === null || candle.high > orHigh) orHigh = candle.high;
          if (orLow === null || candle.low < orLow) orLow = candle.low;
          return { time: candle.time, value: { high: orHigh, low: orLow, breakout: null } };
        }
        // OR period just ended
        orEstablished = true;
        everEstablished = true;
      }

      return { time: candle.time, value: computeValue(candle, orHigh, orLow, orEstablished) };
    },

    peek(candle: NormalizedCandle) {
      const newSession = isNewSession(
        candle.time,
        sessionStartTime,
        sessionResetPeriod,
        count,
        sessionStartBarIndex,
      );

      if (newSession) {
        return { time: candle.time, value: { high: candle.high, low: candle.low, breakout: null } };
      }

      if (!orEstablished && sessionStartTime !== null) {
        const elapsed = candle.time - sessionStartTime;
        if (elapsed < orDurationMs) {
          const peekHigh = orHigh === null ? candle.high : Math.max(orHigh, candle.high);
          const peekLow = orLow === null ? candle.low : Math.min(orLow, candle.low);
          return { time: candle.time, value: { high: peekHigh, low: peekLow, breakout: null } };
        }
        // Would establish OR
        return { time: candle.time, value: computeValue(candle, orHigh, orLow, true) };
      }

      return { time: candle.time, value: computeValue(candle, orHigh, orLow, orEstablished) };
    },

    getState(): IndicatorSnapshot<OpeningRangeState> {
      return makeSnapshot(
        "openingRange",
        OPENING_RANGE_VERSION,
        { minutes, sessionResetPeriod },
        {
          sessionStartTime,
          sessionStartBarIndex,
          orHigh,
          orLow,
          orEstablished,
          everEstablished,
          lastDayIndex,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // Monotonic: once any session's opening range has been
      // established the indicator is considered warmed up, even though
      // `orEstablished` itself resets at each new session.
      return everEstablished;
    },
  };

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
