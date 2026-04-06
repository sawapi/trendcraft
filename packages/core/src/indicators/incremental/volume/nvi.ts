/**
 * Incremental NVI (Negative Volume Index)
 *
 * NVI changes only on days when volume decreases from the prior day.
 * When volume decreases: NVI *= (close / prevClose)
 * When volume increases or stays same: NVI unchanged
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type NviState = {
  prevClose: number | null;
  prevVolume: number | null;
  nviValue: number;
  initialValue: number;
  count: number;
};

/**
 * Create an incremental NVI indicator
 *
 * @param options - Configuration options
 * @param options.initialValue - Starting NVI value (default: 1000)
 *
 * @example
 * ```ts
 * const nvi = createNvi({ initialValue: 1000 });
 * for (const candle of stream) {
 *   const { value } = nvi.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createNvi(
  options: { initialValue?: number } = {},
  warmUpOptions?: WarmUpOptions<NviState>,
): IncrementalIndicator<number, NviState> {
  const initialValue = options.initialValue ?? 1000;

  let prevClose: number | null;
  let prevVolume: number | null;
  let nviValue: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevClose = s.prevClose;
    prevVolume = s.prevVolume;
    nviValue = s.nviValue;
    count = s.count;
  } else {
    prevClose = null;
    prevVolume = null;
    nviValue = initialValue;
    count = 0;
  }

  const indicator: IncrementalIndicator<number, NviState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null || prevVolume === null) {
        prevClose = candle.close;
        prevVolume = candle.volume;
        return { time: candle.time, value: nviValue };
      }

      if (candle.volume < prevVolume && prevClose !== 0) {
        nviValue *= candle.close / prevClose;
      }

      prevClose = candle.close;
      prevVolume = candle.volume;
      return { time: candle.time, value: nviValue };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null || prevVolume === null) {
        return { time: candle.time, value: nviValue };
      }

      let peekNvi = nviValue;
      if (candle.volume < prevVolume && prevClose !== 0) {
        peekNvi *= candle.close / prevClose;
      }

      return { time: candle.time, value: peekNvi };
    },

    getState(): NviState {
      return { prevClose, prevVolume, nviValue, initialValue, count };
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
