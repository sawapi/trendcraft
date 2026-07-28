/**
 * Incremental TWAP (Time-Weighted Average Price)
 *
 * State category: **Recursive** (`cumTp` is a cumulative accumulator
 * with session-boundary resets — there is no raw-price window that
 * could be carried forward across a parameter change).
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<TwapState>` and `fromState` accepts the same.
 *
 * TWAP = Cumulative Sum of Typical Prices / Count (within session)
 * Typical Price = (High + Low + Close) / 3
 *
 * Reconfig policy: any change to `sessionResetPeriod` or `session` throws.
 * The `cumTp` accumulator's meaning is tied to session boundaries; the
 * same cumTp value represents a different aggregation under a different
 * setting, so silent carry-forward would mislead consumers.
 */

import type { NormalizedCandle } from "../../../types";
import {
  assertSessionResetCompatible,
  resolveSessionMembership,
  type SessionDefinition,
} from "../../session/session-definition";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for TWAP. Params (`sessionResetPeriod`, `session`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type TwapState = {
  cumTp: number;
  sessionCount: number;
  count: number;
  /**
   * Identifies the period the running totals belong to: a UTC day index by
   * default, or a session occurrence key when `session` is set.
   */
  currentOccurrence: number;
  candlesSinceReset: number;
};

/**
 * Per-indicator schema version. Bump on any breaking state change.
 *
 * v2 renamed `lastDayIndex` to `currentOccurrence`: with a `session` the field
 * holds an occurrence key rather than a UTC day index, and a snapshot written
 * by v1 cannot be told apart from one written under a different anchoring.
 * Snapshots taken before this version need a re-warm.
 */
export const TWAP_VERSION = 2;

type TwapParams = {
  sessionResetPeriod: "session" | number;
  session?: SessionDefinition;
};

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
   * boundary. For a stream limited to regular trading hours the two often
   * coincide — a US equity day sits inside one UTC date — but it breaks once
   * the stream carries extended hours, and never lines up for a session that
   * itself crosses UTC midnight.
   *
   * With it, only bars inside the session contribute. Bars outside the window,
   * and bars inside one of its breaks, return `null` and leave the running
   * totals untouched; `count` still advances, since a bar was still consumed.
   */
  session?: SessionDefinition;
};

/**
 * Create an incremental TWAP indicator
 *
 * @example
 * ```ts
 * const twap = createTwap();
 * for (const candle of stream) {
 *   const { value } = twap.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createTwap(
  options: TwapOptions = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<TwapState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<TwapState>> {
  const { params, state } = resolveResume<TwapParams, TwapState>({
    indicator: "twap",
    version: TWAP_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { sessionResetPeriod: "session" },
  });

  const sessionResetPeriod = params.sessionResetPeriod;
  const session = params.session;
  const MS_PER_DAY = 86400000;

  if (session) {
    assertSessionResetCompatible("twap", "sessionResetPeriod", sessionResetPeriod, "session");
  }

  let cumTp: number;
  let sessionCount: number;
  let count: number;
  let currentOccurrence: number;
  let candlesSinceReset: number;

  if (state !== null) {
    cumTp = state.cumTp;
    sessionCount = state.sessionCount;
    count = state.count;
    currentOccurrence = state.currentOccurrence;
    candlesSinceReset = state.candlesSinceReset;
  } else {
    cumTp = 0;
    sessionCount = 0;
    count = 0;
    currentOccurrence = -1;
    candlesSinceReset = 0;
  }

  function processCandle(candle: NormalizedCandle, advance: boolean): number | null {
    let localCumTp = cumTp;
    let localSessionCount = sessionCount;
    let localCandlesSinceReset = candlesSinceReset;
    let occurrence: number;

    if (session) {
      const membership = resolveSessionMembership(candle.time, session);

      if (!membership.active) {
        // Not part of the session: no value, and the totals stay where they are.
        return null;
      }

      occurrence = membership.occurrenceKey;
      if (occurrence !== currentOccurrence) {
        localCumTp = 0;
        localSessionCount = 0;
        localCandlesSinceReset = 0;
      }
    } else {
      occurrence = Math.floor(candle.time / MS_PER_DAY);

      const shouldReset =
        (sessionResetPeriod === "session" &&
          occurrence !== currentOccurrence &&
          currentOccurrence !== -1) ||
        (typeof sessionResetPeriod === "number" && localCandlesSinceReset >= sessionResetPeriod);

      if (shouldReset) {
        localCumTp = 0;
        localSessionCount = 0;
        localCandlesSinceReset = 0;
      }
    }

    const tp = (candle.high + candle.low + candle.close) / 3;
    localCumTp += tp;
    localSessionCount++;
    localCandlesSinceReset++;

    if (advance) {
      cumTp = localCumTp;
      sessionCount = localSessionCount;
      currentOccurrence = occurrence;
      candlesSinceReset = localCandlesSinceReset;
    }

    return localCumTp / localSessionCount;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<TwapState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle, true);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const value = processCandle(candle, false);
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<TwapState> {
      return makeSnapshot(
        "twap",
        TWAP_VERSION,
        session ? { sessionResetPeriod, session } : { sessionResetPeriod },
        {
          cumTp,
          sessionCount,
          count,
          currentOccurrence,
          candlesSinceReset,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 1;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
