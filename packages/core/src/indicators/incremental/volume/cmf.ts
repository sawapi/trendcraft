/**
 * Incremental CMF (Chaikin Money Flow)
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type CmfState = {
  period: number;
  mfvBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  volBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  mfvSum: number;
  volSum: number;
  count: number;
};

/**
 * Create an incremental CMF indicator
 *
 * @example
 * ```ts
 * const cmf20 = createCmf({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = cmf20.next(candle);
 *   if (cmf20.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createCmf(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<CmfState>,
): IncrementalIndicator<number | null, CmfState> {
  const period = options.period ?? 20;

  let mfvBuffer: CircularBuffer<number>;
  let volBuffer: CircularBuffer<number>;
  let mfvSum: number;
  let volSum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    mfvBuffer = CircularBuffer.fromSnapshot(s.mfvBuffer);
    volBuffer = CircularBuffer.fromSnapshot(s.volBuffer);
    mfvSum = s.mfvSum;
    volSum = s.volSum;
    count = s.count;
  } else {
    mfvBuffer = new CircularBuffer<number>(period);
    volBuffer = new CircularBuffer<number>(period);
    mfvSum = 0;
    volSum = 0;
    count = 0;
  }

  function computeMfv(candle: NormalizedCandle): number {
    const range = candle.high - candle.low;
    const multiplier = range > 0 ? (2 * candle.close - candle.high - candle.low) / range : 0;
    return multiplier * candle.volume;
  }

  const indicator: IncrementalIndicator<number | null, CmfState> = {
    next(candle: NormalizedCandle) {
      count++;

      const mfv = computeMfv(candle);
      const vol = candle.volume;

      if (mfvBuffer.isFull) {
        mfvSum = mfvSum - mfvBuffer.oldest() + mfv;
        volSum = volSum - volBuffer.oldest() + vol;
      } else {
        mfvSum += mfv;
        volSum += vol;
      }

      mfvBuffer.push(mfv);
      volBuffer.push(vol);

      if (count < period) {
        return { time: candle.time, value: null };
      }

      const value = volSum !== 0 ? mfvSum / volSum : 0;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      if (count + 1 < period) {
        return { time: candle.time, value: null };
      }

      const mfv = computeMfv(candle);
      const vol = candle.volume;

      let peekMfvSum = mfvSum;
      let peekVolSum = volSum;

      if (mfvBuffer.isFull) {
        peekMfvSum = peekMfvSum - mfvBuffer.oldest() + mfv;
        peekVolSum = peekVolSum - volBuffer.oldest() + vol;
      } else {
        peekMfvSum += mfv;
        peekVolSum += vol;
      }

      const value = peekVolSum !== 0 ? peekMfvSum / peekVolSum : 0;
      return { time: candle.time, value };
    },

    getState(): CmfState {
      return {
        period,
        mfvBuffer: mfvBuffer.snapshot(),
        volBuffer: volBuffer.snapshot(),
        mfvSum,
        volSum,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
