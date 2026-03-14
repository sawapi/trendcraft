/**
 * Incremental Vortex Indicator
 *
 * VI+ = sum(VM+, period) / sum(TR, period)
 * VI- = sum(VM-, period) / sum(TR, period)
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type VortexValue = {
  viPlus: number | null;
  viMinus: number | null;
};

export type VortexState = {
  period: number;
  vmPlusBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  vmMinusBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  trBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevHigh: number | null;
  prevLow: number | null;
  prevClose: number | null;
  count: number;
};

/**
 * Create an incremental Vortex indicator
 *
 * @example
 * ```ts
 * const vortex = createVortex({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = vortex.next(candle);
 *   if (value.viPlus !== null) console.log(value.viPlus, value.viMinus);
 * }
 * ```
 */
export function createVortex(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<VortexState>,
): IncrementalIndicator<VortexValue, VortexState> {
  const period = options.period ?? 14;

  let vmPlusBuffer: CircularBuffer<number>;
  let vmMinusBuffer: CircularBuffer<number>;
  let trBuffer: CircularBuffer<number>;
  let prevHigh: number | null;
  let prevLow: number | null;
  let prevClose: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    vmPlusBuffer = CircularBuffer.fromSnapshot(s.vmPlusBuffer);
    vmMinusBuffer = CircularBuffer.fromSnapshot(s.vmMinusBuffer);
    trBuffer = CircularBuffer.fromSnapshot(s.trBuffer);
    prevHigh = s.prevHigh;
    prevLow = s.prevLow;
    prevClose = s.prevClose;
    count = s.count;
  } else {
    vmPlusBuffer = new CircularBuffer<number>(period);
    vmMinusBuffer = new CircularBuffer<number>(period);
    trBuffer = new CircularBuffer<number>(period);
    prevHigh = null;
    prevLow = null;
    prevClose = null;
    count = 0;
  }

  function computeFromBuffers(
    vmP: CircularBuffer<number>,
    vmM: CircularBuffer<number>,
    tr: CircularBuffer<number>,
  ): VortexValue {
    if (vmP.length < period) {
      return { viPlus: null, viMinus: null };
    }

    let sumVmPlus = 0;
    let sumVmMinus = 0;
    let sumTr = 0;
    for (let i = 0; i < vmP.length; i++) {
      sumVmPlus += vmP.get(i);
      sumVmMinus += vmM.get(i);
      sumTr += tr.get(i);
    }

    return {
      viPlus: sumTr !== 0 ? sumVmPlus / sumTr : 0,
      viMinus: sumTr !== 0 ? sumVmMinus / sumTr : 0,
    };
  }

  const indicator: IncrementalIndicator<VortexValue, VortexState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevHigh === null || prevLow === null || prevClose === null) {
        prevHigh = candle.high;
        prevLow = candle.low;
        prevClose = candle.close;
        return { time: candle.time, value: { viPlus: null, viMinus: null } };
      }

      const vmPlus = Math.abs(candle.high - prevLow);
      const vmMinus = Math.abs(candle.low - prevHigh);
      const tr = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose),
      );

      vmPlusBuffer.push(vmPlus);
      vmMinusBuffer.push(vmMinus);
      trBuffer.push(tr);

      prevHigh = candle.high;
      prevLow = candle.low;
      prevClose = candle.close;

      return {
        time: candle.time,
        value: computeFromBuffers(vmPlusBuffer, vmMinusBuffer, trBuffer),
      };
    },

    peek(candle: NormalizedCandle) {
      if (prevHigh === null || prevLow === null || prevClose === null) {
        return { time: candle.time, value: { viPlus: null, viMinus: null } };
      }

      const vmPlus = Math.abs(candle.high - prevLow);
      const vmMinus = Math.abs(candle.low - prevHigh);
      const tr = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose),
      );

      const peekVmP = CircularBuffer.fromSnapshot<number>(vmPlusBuffer.snapshot());
      const peekVmM = CircularBuffer.fromSnapshot<number>(vmMinusBuffer.snapshot());
      const peekTr = CircularBuffer.fromSnapshot<number>(trBuffer.snapshot());
      peekVmP.push(vmPlus);
      peekVmM.push(vmMinus);
      peekTr.push(tr);

      return { time: candle.time, value: computeFromBuffers(peekVmP, peekVmM, peekTr) };
    },

    getState(): VortexState {
      return {
        period,
        vmPlusBuffer: vmPlusBuffer.snapshot(),
        vmMinusBuffer: vmMinusBuffer.snapshot(),
        trBuffer: trBuffer.snapshot(),
        prevHigh,
        prevLow,
        prevClose,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return vmPlusBuffer.isFull;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
