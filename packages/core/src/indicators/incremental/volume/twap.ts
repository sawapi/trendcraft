/**
 * Incremental TWAP (Time-Weighted Average Price)
 *
 * TWAP = Cumulative Sum of Typical Prices / Count (within session)
 * Typical Price = (High + Low + Close) / 3
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type TwapState = {
  sessionResetPeriod: "session" | number;
  cumTp: number;
  sessionCount: number;
  count: number;
  lastDayIndex: number;
  candlesSinceReset: number;
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
  warmUpOptions?: WarmUpOptions<TwapState>,
): IncrementalIndicator<number | null, TwapState> {
  const sessionResetPeriod = options.sessionResetPeriod ?? "session";
  const MS_PER_DAY = 86400000;

  let cumTp: number;
  let sessionCount: number;
  let count: number;
  let lastDayIndex: number;
  let candlesSinceReset: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    cumTp = s.cumTp;
    sessionCount = s.sessionCount;
    count = s.count;
    lastDayIndex = s.lastDayIndex;
    candlesSinceReset = s.candlesSinceReset;
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

  const indicator: IncrementalIndicator<number | null, TwapState> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle, true);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const value = processCandle(candle, false);
      return { time: candle.time, value };
    },

    getState(): TwapState {
      return {
        sessionResetPeriod,
        cumTp,
        sessionCount,
        count,
        lastDayIndex,
        candlesSinceReset,
      };
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
