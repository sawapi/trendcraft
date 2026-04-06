/**
 * Incremental Opening Range (ORB)
 *
 * Tracks the opening range high/low during the first N minutes of a session,
 * then detects breakouts above or below the established range.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type OpeningRangeValue = {
  /** Opening range high, null until first bar */
  high: number | null;
  /** Opening range low, null until first bar */
  low: number | null;
  /** Breakout direction after OR is established */
  breakout: "above" | "below" | null;
};

export type OpeningRangeState = {
  sessionStartTime: number | null;
  sessionStartBarIndex: number;
  orHigh: number | null;
  orLow: number | null;
  orEstablished: boolean;
  lastDayIndex: number;
  minutes: number;
  sessionResetPeriod: "day" | number;
  count: number;
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
  warmUpOptions?: WarmUpOptions<OpeningRangeState>,
): IncrementalIndicator<OpeningRangeValue, OpeningRangeState> {
  const minutes = options.minutes ?? 30;
  const sessionResetPeriod = options.sessionResetPeriod ?? "day";
  const orDurationMs = minutes * 60 * 1000;

  let sessionStartTime: number | null;
  let sessionStartBarIndex: number;
  let orHigh: number | null;
  let orLow: number | null;
  let orEstablished: boolean;
  let lastDayIndex: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    sessionStartTime = s.sessionStartTime;
    sessionStartBarIndex = s.sessionStartBarIndex;
    orHigh = s.orHigh;
    orLow = s.orLow;
    orEstablished = s.orEstablished;
    lastDayIndex = s.lastDayIndex;
    count = s.count;
  } else {
    sessionStartTime = null;
    sessionStartBarIndex = 0;
    orHigh = null;
    orLow = null;
    orEstablished = false;
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

  const indicator: IncrementalIndicator<OpeningRangeValue, OpeningRangeState> = {
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

    getState(): OpeningRangeState {
      return {
        sessionStartTime,
        sessionStartBarIndex,
        orHigh,
        orLow,
        orEstablished,
        lastDayIndex,
        minutes,
        sessionResetPeriod,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return orEstablished;
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
