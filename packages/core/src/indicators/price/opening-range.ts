/**
 * Opening Range Breakout (ORB) indicator
 *
 * Detects the opening range (high/low of the first N minutes of a session)
 * and identifies breakouts above or below that range.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import {
  assertSessionResetCompatible,
  resolveSessionMembership,
  type SessionDefinition,
} from "../session/session-definition";

/**
 * Opening Range options
 */
export type OpeningRangeOptions = {
  /** Number of minutes for the opening range (default: 30) */
  minutes?: number;
  /**
   * How sessions are determined:
   * - 'day': Reset at the start of each calendar day (default)
   * - number: Reset every N candles (useful for fixed-interval data)
   *
   * Only the default `'day'` may be combined with `session`, which brings its
   * own boundaries; a bar count throws.
   */
  sessionResetPeriod?: "day" | number;
  /**
   * Trading session whose open the range is measured from.
   *
   * Without it, the range is measured from the first bar of each UTC calendar
   * day. For regular-hours-only data that bar is usually the open, so the two
   * agree. Once the series carries extended hours it is not: UTC midnight is
   * 19:00 or 20:00 in New York, so the UTC day begins with a post-market bar
   * and the "opening range" is built from it.
   *
   * With it, the range covers the first `minutes` of the session, measured from
   * the session's official open rather than from whichever bar happens to come
   * first. A series starting at 09:45 does not get a fresh 30-minute range;
   * having missed the open, that day reports no range at all, since a range
   * built from part of the window would be quoted as if it were the whole one.
   *
   * Bars outside the session, and bars inside one of its breaks, report
   * `null`.
   */
  session?: SessionDefinition;
};

/**
 * Opening Range value
 */
export type OpeningRangeValue = {
  /** Opening range high */
  high: number | null;
  /** Opening range low */
  low: number | null;
  /** Breakout direction: 'above', 'below', or null */
  breakout: "above" | "below" | null;
};

/**
 * Calculate Opening Range Breakout
 *
 * 1. Identify the first N minutes of each session
 * 2. Record the high and low of that opening range
 * 3. After the opening range period, detect breakouts
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Opening Range options
 * @returns Series of Opening Range values
 *
 * @example
 * ```ts
 * // 30-minute opening range with daily session reset
 * const orb = openingRange(candles);
 *
 * // 15-minute opening range
 * const orb15 = openingRange(candles, { minutes: 15 });
 *
 * // Fixed session reset every 78 candles (e.g., 5-min bars in 6.5hr session)
 * const orbFixed = openingRange(candles, { minutes: 30, sessionResetPeriod: 78 });
 * ```
 */
export function openingRange(
  candles: Candle[] | NormalizedCandle[],
  options: OpeningRangeOptions = {},
): Series<OpeningRangeValue> {
  const { minutes = 30, sessionResetPeriod = "day", session } = options;

  if (session) {
    assertSessionResetCompatible("openingRange", "sessionResetPeriod", sessionResetPeriod, "day");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<OpeningRangeValue> = [];
  const MS_PER_DAY = 86400000;
  const openingRangeMs = minutes * 60 * 1000;
  const NO_RANGE: OpeningRangeValue = { high: null, low: null, breakout: null };

  if (session) {
    // Session-anchored: the range covers the first `minutes` of the session,
    // measured from its official open.
    let currentOccurrence = -1;
    let sawSessionOpen = false;
    let orHigh = Number.NEGATIVE_INFINITY;
    let orLow = Number.POSITIVE_INFINITY;

    for (const candle of normalized) {
      const membership = resolveSessionMembership(candle.time, session);

      if (!membership.active) {
        result.push({ time: candle.time, value: { ...NO_RANGE } });
        continue;
      }

      if (membership.occurrenceKey !== currentOccurrence) {
        currentOccurrence = membership.occurrenceKey;
        orHigh = Number.NEGATIVE_INFINITY;
        orLow = Number.POSITIVE_INFINITY;
        // Only a range that starts at the open is an opening range. When the
        // data begins mid-session, a range built from what is left would be
        // quoted as if it covered the whole window, and breakouts would be
        // measured against a level the market never actually set.
        sawSessionOpen = membership.elapsedMinutes === 0;
      }

      if (!sawSessionOpen) {
        result.push({ time: candle.time, value: { ...NO_RANGE } });
        continue;
      }

      if (membership.elapsedMinutes < minutes) {
        if (candle.high > orHigh) orHigh = candle.high;
        if (candle.low < orLow) orLow = candle.low;

        result.push({
          time: candle.time,
          value: { high: orHigh, low: orLow, breakout: null },
        });
        continue;
      }

      if (orHigh === Number.NEGATIVE_INFINITY || orLow === Number.POSITIVE_INFINITY) {
        // No bar ever fell inside the range window — `minutes` is zero,
        // negative or NaN. There is no level to break out of, so report none
        // rather than the untouched sentinels.
        result.push({ time: candle.time, value: { ...NO_RANGE } });
        continue;
      }

      let breakout: "above" | "below" | null = null;
      if (candle.close > orHigh) {
        breakout = "above";
      } else if (candle.close < orLow) {
        breakout = "below";
      }

      result.push({ time: candle.time, value: { high: orHigh, low: orLow, breakout } });
    }

    return tagSeries(result, { kind: "openingRange", overlay: true, label: "ORB" });
  }

  let sessionStartTime = -1;
  let lastDayIndex = -1;
  let sessionStartBarIndex = 0;
  let orHigh = Number.NEGATIVE_INFINITY;
  let orLow = Number.POSITIVE_INFINITY;
  let orEstablished = false;

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];

    // Detect session reset
    let shouldReset = false;
    if (sessionResetPeriod === "day") {
      const currentDayIndex = Math.floor(candle.time / MS_PER_DAY);
      if (currentDayIndex !== lastDayIndex) {
        shouldReset = true;
        lastDayIndex = currentDayIndex;
      }
    } else {
      if (i === 0 || i - sessionStartBarIndex >= sessionResetPeriod) {
        shouldReset = true;
      }
    }

    if (shouldReset) {
      sessionStartTime = candle.time;
      sessionStartBarIndex = i;
      orHigh = Number.NEGATIVE_INFINITY;
      orLow = Number.POSITIVE_INFINITY;
      orEstablished = false;
    }

    const elapsed = candle.time - sessionStartTime;

    if (!orEstablished && elapsed < openingRangeMs) {
      // Within opening range — track high/low
      if (candle.high > orHigh) orHigh = candle.high;
      if (candle.low < orLow) orLow = candle.low;

      result.push({
        time: candle.time,
        value: {
          high: orHigh === Number.NEGATIVE_INFINITY ? null : orHigh,
          low: orLow === Number.POSITIVE_INFINITY ? null : orLow,
          breakout: null,
        },
      });
    } else {
      // Opening range is established
      if (!orEstablished) {
        // First bar after OR period — include this bar in OR if it starts exactly at the boundary
        orEstablished = true;
      }

      if (orHigh === Number.NEGATIVE_INFINITY || orLow === Number.POSITIVE_INFINITY) {
        // No valid opening range data
        result.push({
          time: candle.time,
          value: { high: null, low: null, breakout: null },
        });
        continue;
      }

      let breakout: "above" | "below" | null = null;
      if (candle.close > orHigh) {
        breakout = "above";
      } else if (candle.close < orLow) {
        breakout = "below";
      }

      result.push({
        time: candle.time,
        value: { high: orHigh, low: orLow, breakout },
      });
    }
  }

  return tagSeries(result, { kind: "openingRange", overlay: true, label: "ORB" });
}
