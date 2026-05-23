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
 * Reconfig policy: any change to `sessionResetPeriod` throws. The
 * `cumTp` accumulator's meaning is tied to session boundaries; the
 * same cumTp value represents a different aggregation under a different
 * `sessionResetPeriod`, so silent carry-forward would mislead consumers.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for TWAP. Params (`sessionResetPeriod`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type TwapState = {
  cumTp: number;
  sessionCount: number;
  count: number;
  lastDayIndex: number;
  candlesSinceReset: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const TWAP_VERSION = 1;

type TwapParams = {
  sessionResetPeriod: "session" | number;
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
  options: { sessionResetPeriod?: "session" | number } = {},
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
  const MS_PER_DAY = 86400000;

  let cumTp: number;
  let sessionCount: number;
  let count: number;
  let lastDayIndex: number;
  let candlesSinceReset: number;

  if (state !== null) {
    cumTp = state.cumTp;
    sessionCount = state.sessionCount;
    count = state.count;
    lastDayIndex = state.lastDayIndex;
    candlesSinceReset = state.candlesSinceReset;
  } else {
    cumTp = 0;
    sessionCount = 0;
    count = 0;
    lastDayIndex = -1;
    candlesSinceReset = 0;
  }

  function processCandle(candle: NormalizedCandle, advance: boolean): number | null {
    const currentDayIndex = Math.floor(candle.time / MS_PER_DAY);
    let localCumTp = cumTp;
    let localSessionCount = sessionCount;
    let localCandlesSinceReset = candlesSinceReset;

    const shouldReset =
      (sessionResetPeriod === "session" &&
        currentDayIndex !== lastDayIndex &&
        lastDayIndex !== -1) ||
      (typeof sessionResetPeriod === "number" && localCandlesSinceReset >= sessionResetPeriod);

    if (shouldReset) {
      localCumTp = 0;
      localSessionCount = 0;
      localCandlesSinceReset = 0;
    }

    const tp = (candle.high + candle.low + candle.close) / 3;
    localCumTp += tp;
    localSessionCount++;
    localCandlesSinceReset++;

    if (advance) {
      cumTp = localCumTp;
      sessionCount = localSessionCount;
      lastDayIndex = currentDayIndex;
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
        { sessionResetPeriod },
        {
          cumTp,
          sessionCount,
          count,
          lastDayIndex,
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
