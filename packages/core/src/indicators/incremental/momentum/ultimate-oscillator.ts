/**
 * Incremental Ultimate Oscillator (UO)
 *
 * Combines short, medium, and long-term momentum into a single oscillator.
 *
 * Formula:
 *   BP (Buying Pressure) = Close - min(Low, prevClose)
 *   TR (True Range) = max(High, prevClose) - min(Low, prevClose)
 *   Avg_n = sum(BP, n) / sum(TR, n)
 *   UO = 100 * (4 * Avg1 + 2 * Avg2 + Avg3) / 7
 *
 * State category: **Mixed** (BP/TR buffers sized to the longest period
 * plus the carried-forward `prevClose`). The buffered BP/TR values are
 * each derived from a candle *and its predecessor*, so a period change
 * is refused.
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
 * Bare state shape for Ultimate Oscillator. Params (`period1`,
 * `period2`, `period3`) live in `meta.params` on the wire.
 */
export type UltimateOscillatorState = {
  bpBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  trBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevClose: number | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ULTIMATE_OSCILLATOR_VERSION = 1;

type UltimateOscillatorParams = {
  period1: number;
  period2: number;
  period3: number;
};

/**
 * Create an incremental Ultimate Oscillator indicator
 *
 * @example
 * ```ts
 * const uo = createUltimateOscillator({ period1: 7, period2: 14, period3: 28 });
 * for (const candle of stream) {
 *   const { value } = uo.next(candle);
 *   if (uo.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createUltimateOscillator(
  options: { period1?: number; period2?: number; period3?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<UltimateOscillatorState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<UltimateOscillatorState>> {
  const { params, state } = resolveResume<UltimateOscillatorParams, UltimateOscillatorState>({
    indicator: "ultimateOscillator",
    version: ULTIMATE_OSCILLATOR_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period1: 7, period2: 14, period3: 28 },
  });

  const isPositiveInt = (v: number): v is number => Number.isInteger(v) && v >= 1;
  const period1 = requireParam(
    "ultimateOscillator",
    params,
    "period1",
    isPositiveInt,
    "must be a positive integer",
  );
  const period2 = requireParam(
    "ultimateOscillator",
    params,
    "period2",
    isPositiveInt,
    "must be a positive integer",
  );
  const period3 = requireParam(
    "ultimateOscillator",
    params,
    "period3",
    isPositiveInt,
    "must be a positive integer",
  );
  const maxPeriod = Math.max(period1, period2, period3);

  let bpBuffer: CircularBuffer<number>;
  let trBuffer: CircularBuffer<number>;
  let prevClose: number | null;
  let count: number;

  if (state !== null) {
    bpBuffer = CircularBuffer.fromSnapshot(state.bpBuffer);
    trBuffer = CircularBuffer.fromSnapshot(state.trBuffer);
    prevClose = state.prevClose;
    count = state.count;
  } else {
    bpBuffer = new CircularBuffer<number>(maxPeriod);
    trBuffer = new CircularBuffer<number>(maxPeriod);
    prevClose = null;
    count = 0;
  }

  function sumLastN(buf: CircularBuffer<number>, n: number): number {
    let s = 0;
    const len = buf.length;
    for (let i = len - n; i < len; i++) {
      s += buf.get(i);
    }
    return s;
  }

  function computeUO(bpBuf: CircularBuffer<number>, trBuf: CircularBuffer<number>): number | null {
    if (bpBuf.length < maxPeriod) return null;

    const bpSum1 = sumLastN(bpBuf, period1);
    const trSum1 = sumLastN(trBuf, period1);
    const bpSum2 = sumLastN(bpBuf, period2);
    const trSum2 = sumLastN(trBuf, period2);
    const bpSum3 = sumLastN(bpBuf, period3);
    const trSum3 = sumLastN(trBuf, period3);

    if (trSum1 === 0 || trSum2 === 0 || trSum3 === 0) return null;

    const avg1 = bpSum1 / trSum1;
    const avg2 = bpSum2 / trSum2;
    const avg3 = bpSum3 / trSum3;

    return (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;
  }

  const indicator: IncrementalIndicator<
    number | null,
    IndicatorSnapshot<UltimateOscillatorState>
  > = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        prevClose = candle.close;
        return { time: candle.time, value: null };
      }

      const bp = candle.close - Math.min(candle.low, prevClose);
      const tr = Math.max(candle.high, prevClose) - Math.min(candle.low, prevClose);

      bpBuffer.push(bp);
      trBuffer.push(tr);

      prevClose = candle.close;

      const value = computeUO(bpBuffer, trBuffer);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null) {
        return { time: candle.time, value: null };
      }

      const bp = candle.close - Math.min(candle.low, prevClose);
      const tr = Math.max(candle.high, prevClose) - Math.min(candle.low, prevClose);

      // Create temporary buffers for computation
      const tempBp = CircularBuffer.fromSnapshot(bpBuffer.snapshot());
      const tempTr = CircularBuffer.fromSnapshot(trBuffer.snapshot());
      tempBp.push(bp);
      tempTr.push(tr);

      const value = computeUO(tempBp, tempTr);
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<UltimateOscillatorState> {
      return makeSnapshot(
        "ultimateOscillator",
        ULTIMATE_OSCILLATOR_VERSION,
        { period1, period2, period3 },
        {
          bpBuffer: bpBuffer.snapshot(),
          trBuffer: trBuffer.snapshot(),
          prevClose,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // Need prevClose (1 candle) + maxPeriod values in buffer
      return bpBuffer.length >= maxPeriod;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
