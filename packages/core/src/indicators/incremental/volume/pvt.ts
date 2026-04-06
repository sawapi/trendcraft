/**
 * Incremental PVT (Price Volume Trend)
 *
 * PVT = Previous PVT + Volume * ((Close - Previous Close) / Previous Close)
 * Similar to OBV but weights volume by price change percentage.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type PvtState = {
  prevClose: number | null;
  cumPvt: number;
  count: number;
};

/**
 * Create an incremental PVT indicator
 *
 * @example
 * ```ts
 * const pvt = createPvt();
 * for (const candle of stream) {
 *   const { value } = pvt.next(candle);
 *   if (value !== null) console.log(value);
 * }
 * ```
 */
export function createPvt(
  warmUpOptions?: WarmUpOptions<PvtState>,
): IncrementalIndicator<number | null, PvtState> {
  let prevClose: number | null;
  let cumPvt: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevClose = s.prevClose;
    cumPvt = s.cumPvt;
    count = s.count;
  } else {
    prevClose = null;
    cumPvt = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, PvtState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        prevClose = candle.close;
        return { time: candle.time, value: 0 };
      }

      if (prevClose !== 0) {
        cumPvt += candle.volume * ((candle.close - prevClose) / prevClose);
      }

      prevClose = candle.close;
      return { time: candle.time, value: cumPvt };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null) {
        return { time: candle.time, value: 0 };
      }

      let peekPvt = cumPvt;
      if (prevClose !== 0) {
        peekPvt += candle.volume * ((candle.close - prevClose) / prevClose);
      }

      return { time: candle.time, value: peekPvt };
    },

    getState(): PvtState {
      return { prevClose, cumPvt, count };
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
