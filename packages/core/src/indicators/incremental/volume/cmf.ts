/**
 * Incremental CMF (Chaikin Money Flow)
 *
 * State category: **Windowed** (two fixed-size buffers — money-flow
 * volume and raw volume — plus running sums). Resume with a different
 * `period` carries both buffers forward and recomputes the running
 * sums against the new window.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for CMF. `period` lives in `meta.params`.
 */
export type CmfState = {
  mfvBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  volBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  mfvSum: number;
  volSum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const CMF_VERSION = 1;

type CmfParams = {
  period: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<CmfState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<CmfState>> {
  const { params, state, reconfigured } = resolveResume<CmfParams, CmfState>({
    indicator: "cmf",
    version: CMF_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20 },
  });

  const period = requireParam(
    "cmf",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let mfvBuffer: CircularBuffer<number>;
  let volBuffer: CircularBuffer<number>;
  let mfvSum: number;
  let volSum: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry both derived buffers forward and
      // recompute the running sums against the new window.
      const oldMfv = CircularBuffer.fromSnapshot(state.mfvBuffer);
      const oldVol = CircularBuffer.fromSnapshot(state.volBuffer);
      mfvBuffer = new CircularBuffer<number>(period);
      volBuffer = new CircularBuffer<number>(period);
      const carry = Math.min(oldMfv.length, period);
      for (let i = oldMfv.length - carry; i < oldMfv.length; i++) {
        mfvBuffer.push(oldMfv.get(i));
        volBuffer.push(oldVol.get(i));
      }
      mfvSum = 0;
      volSum = 0;
      for (let i = 0; i < mfvBuffer.length; i++) {
        mfvSum += mfvBuffer.get(i);
        volSum += volBuffer.get(i);
      }
    } else {
      mfvBuffer = CircularBuffer.fromSnapshot(state.mfvBuffer);
      volBuffer = CircularBuffer.fromSnapshot(state.volBuffer);
      mfvSum = state.mfvSum;
      volSum = state.volSum;
    }
    count = state.count;
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

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<CmfState>> = {
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

      if (mfvBuffer.length < period) {
        return { time: candle.time, value: null };
      }

      const value = volSum !== 0 ? mfvSum / volSum : 0;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      if (mfvBuffer.length + 1 < period && !mfvBuffer.isFull) {
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

    getState(): IndicatorSnapshot<CmfState> {
      return makeSnapshot(
        "cmf",
        CMF_VERSION,
        { period },
        {
          mfvBuffer: mfvBuffer.snapshot(),
          volBuffer: volBuffer.snapshot(),
          mfvSum,
          volSum,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return mfvBuffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
