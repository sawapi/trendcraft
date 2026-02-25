/**
 * Incremental OBV (On Balance Volume)
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type ObvState = {
  prevClose: number | null;
  obv: number;
  count: number;
};

/**
 * Create an incremental OBV indicator
 *
 * @example
 * ```ts
 * const obv = createObv();
 * for (const candle of stream) {
 *   const { value } = obv.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createObv(
  warmUpOptions?: WarmUpOptions<ObvState>,
): IncrementalIndicator<number, ObvState> {
  let prevClose: number | null;
  let obv: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevClose = s.prevClose;
    obv = s.obv;
    count = s.count;
  } else {
    prevClose = null;
    obv = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number, ObvState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        // First candle: OBV starts at 0
        prevClose = candle.close;
        return { time: candle.time, value: obv };
      }

      if (candle.close > prevClose) {
        obv += candle.volume;
      } else if (candle.close < prevClose) {
        obv -= candle.volume;
      }
      // If close === prevClose, OBV stays the same

      prevClose = candle.close;
      return { time: candle.time, value: obv };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null) {
        return { time: candle.time, value: 0 };
      }

      let peekObv = obv;
      if (candle.close > prevClose) {
        peekObv += candle.volume;
      } else if (candle.close < prevClose) {
        peekObv -= candle.volume;
      }

      return { time: candle.time, value: peekObv };
    },

    getState(): ObvState {
      return { prevClose, obv, count };
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
