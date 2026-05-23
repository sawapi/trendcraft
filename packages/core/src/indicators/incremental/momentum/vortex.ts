/**
 * Incremental Vortex Indicator
 *
 * VI+ = sum(VM+, period) / sum(TR, period)
 * VI- = sum(VM-, period) / sum(TR, period)
 *
 * State category: **Mixed** (fixed-size VM+/VM-/TR buffers plus the
 * carried-forward `prevHigh` / `prevLow` / `prevClose`). The buffered
 * VM/TR values are each derived from a candle *and its predecessor*,
 * so a `period` change cannot be reconciled — resume with a different
 * `period` is refused.
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

export type VortexValue = {
  viPlus: number | null;
  viMinus: number | null;
};

/**
 * Bare state shape for Vortex. Params (`period`) live in `meta.params`.
 */
export type VortexState = {
  vmPlusBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  vmMinusBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  trBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevHigh: number | null;
  prevLow: number | null;
  prevClose: number | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const VORTEX_VERSION = 1;

type VortexParams = {
  period: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<VortexState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<VortexValue, IndicatorSnapshot<VortexState>> {
  const { params, state } = resolveResume<VortexParams, VortexState>({
    indicator: "vortex",
    version: VORTEX_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14 },
  });

  const period = requireParam(
    "vortex",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let vmPlusBuffer: CircularBuffer<number>;
  let vmMinusBuffer: CircularBuffer<number>;
  let trBuffer: CircularBuffer<number>;
  let prevHigh: number | null;
  let prevLow: number | null;
  let prevClose: number | null;
  let count: number;

  if (state !== null) {
    vmPlusBuffer = CircularBuffer.fromSnapshot(state.vmPlusBuffer);
    vmMinusBuffer = CircularBuffer.fromSnapshot(state.vmMinusBuffer);
    trBuffer = CircularBuffer.fromSnapshot(state.trBuffer);
    prevHigh = state.prevHigh;
    prevLow = state.prevLow;
    prevClose = state.prevClose;
    count = state.count;
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

  const indicator: IncrementalIndicator<VortexValue, IndicatorSnapshot<VortexState>> = {
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

    getState(): IndicatorSnapshot<VortexState> {
      return makeSnapshot(
        "vortex",
        VORTEX_VERSION,
        { period },
        {
          vmPlusBuffer: vmPlusBuffer.snapshot(),
          vmMinusBuffer: vmMinusBuffer.snapshot(),
          trBuffer: trBuffer.snapshot(),
          prevHigh,
          prevLow,
          prevClose,
          count,
        },
      );
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
