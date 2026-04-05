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
 * Uses CircularBuffer for BP and TR values (sized to longest period).
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

/**
 * State for incremental Ultimate Oscillator
 */
export type UltimateOscillatorState = {
  period1: number;
  period2: number;
  period3: number;
  bpBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  trBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevClose: number | null;
  count: number;
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
  warmUpOptions?: WarmUpOptions<UltimateOscillatorState>,
): IncrementalIndicator<number | null, UltimateOscillatorState> {
  const period1 = options.period1 ?? 7;
  const period2 = options.period2 ?? 14;
  const period3 = options.period3 ?? 28;
  const maxPeriod = Math.max(period1, period2, period3);

  let bpBuffer: CircularBuffer<number>;
  let trBuffer: CircularBuffer<number>;
  let prevClose: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    bpBuffer = CircularBuffer.fromSnapshot(s.bpBuffer);
    trBuffer = CircularBuffer.fromSnapshot(s.trBuffer);
    prevClose = s.prevClose;
    count = s.count;
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

  const indicator: IncrementalIndicator<number | null, UltimateOscillatorState> = {
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

    getState(): UltimateOscillatorState {
      return {
        period1,
        period2,
        period3,
        bpBuffer: bpBuffer.snapshot(),
        trBuffer: trBuffer.snapshot(),
        prevClose,
        count,
      };
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
