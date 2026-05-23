/**
 * Incremental IMI (Intraday Momentum Index)
 *
 * IMI = 100 × SUM(gains, n) / (SUM(gains, n) + SUM(losses, n))
 *
 * State category: **Windowed** (fixed-size gains/losses buffers plus
 * running sums). The buffered gains/losses are derived per-candle
 * independently (each from a single candle's open/close), so a
 * `period` change carries them forward and recomputes the running
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
 * Bare state shape for IMI. Params (`period`) live in `meta.params`.
 */
export type ImiState = {
  gainsBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lossesBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sumGain: number;
  sumLoss: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const IMI_VERSION = 1;

type ImiParams = {
  period: number;
};

/**
 * Create an incremental IMI indicator
 *
 * @example
 * ```ts
 * const imi = createImi({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = imi.next(candle);
 *   if (imi.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createImi(
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ImiState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<ImiState>> {
  const { params, state, reconfigured } = resolveResume<ImiParams, ImiState>({
    indicator: "imi",
    version: IMI_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14 },
  });

  const period = requireParam(
    "imi",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let gainsBuffer: CircularBuffer<number>;
  let lossesBuffer: CircularBuffer<number>;
  let sumGain: number;
  let sumLoss: number;
  let count: number;

  function carryForward(
    snapshot: ReturnType<CircularBuffer<number>["snapshot"]>,
  ): CircularBuffer<number> {
    const old = CircularBuffer.fromSnapshot<number>(snapshot);
    const next = new CircularBuffer<number>(period);
    const carry = Math.min(old.length, period);
    for (let i = old.length - carry; i < old.length; i++) {
      next.push(old.get(i));
    }
    return next;
  }

  function bufferSum(buf: CircularBuffer<number>): number {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf.get(i);
    return s;
  }

  if (state !== null) {
    if (reconfigured) {
      gainsBuffer = carryForward(state.gainsBuffer);
      lossesBuffer = carryForward(state.lossesBuffer);
      sumGain = bufferSum(gainsBuffer);
      sumLoss = bufferSum(lossesBuffer);
    } else {
      gainsBuffer = CircularBuffer.fromSnapshot(state.gainsBuffer);
      lossesBuffer = CircularBuffer.fromSnapshot(state.lossesBuffer);
      sumGain = state.sumGain;
      sumLoss = state.sumLoss;
    }
    count = state.count;
  } else {
    gainsBuffer = new CircularBuffer<number>(period);
    lossesBuffer = new CircularBuffer<number>(period);
    sumGain = 0;
    sumLoss = 0;
    count = 0;
  }

  function computeImi(sg: number, sl: number): number {
    const total = sg + sl;
    return total === 0 ? 50 : (100 * sg) / total;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<ImiState>> = {
    next(candle: NormalizedCandle) {
      count++;

      const gain = candle.close > candle.open ? candle.close - candle.open : 0;
      const loss = candle.open > candle.close ? candle.open - candle.close : 0;

      // Remove oldest value if buffer is full
      if (gainsBuffer.isFull) {
        sumGain -= gainsBuffer.oldest();
        sumLoss -= lossesBuffer.oldest();
      }

      sumGain += gain;
      sumLoss += loss;
      gainsBuffer.push(gain);
      lossesBuffer.push(loss);

      // Gate on buffer fill, not `count`: after a period-growing
      // resume the carried buffer is shorter than the old `count`.
      if (gainsBuffer.length < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeImi(sumGain, sumLoss) };
    },

    peek(candle: NormalizedCandle) {
      if (gainsBuffer.length < period - 1) {
        return { time: candle.time, value: null };
      }

      const gain = candle.close > candle.open ? candle.close - candle.open : 0;
      const loss = candle.open > candle.close ? candle.open - candle.close : 0;

      let peekSumGain = sumGain + gain;
      let peekSumLoss = sumLoss + loss;

      if (gainsBuffer.isFull) {
        peekSumGain -= gainsBuffer.oldest();
        peekSumLoss -= lossesBuffer.oldest();
      }

      return { time: candle.time, value: computeImi(peekSumGain, peekSumLoss) };
    },

    getState(): IndicatorSnapshot<ImiState> {
      return makeSnapshot(
        "imi",
        IMI_VERSION,
        { period },
        {
          gainsBuffer: gainsBuffer.snapshot(),
          lossesBuffer: lossesBuffer.snapshot(),
          sumGain,
          sumLoss,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return gainsBuffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
