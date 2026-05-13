/**
 * Incremental Choppiness Index
 *
 * State category: **Windowed** (raw TR / high / low buffers).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<ChoppinessIndexState>` and `fromState` accepts
 * the same.
 *
 * CHOP = 100 * LOG10(SUM(TR, period) / (HH - LL)) / LOG10(period)
 *
 * Defaults: `period` defaults to `14` (canonical Bill Dreiss value).
 * Reconfig on resume carries the TR / high / low buffers forward
 * (raw values, no per-period derivation needed).
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
 * Bare state shape for Choppiness Index. Params (`period`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 * `log10Period` is a derived cache and is recomputed at construction.
 */
export type ChoppinessIndexState = {
  trBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevClose: number | null;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const CHOPPINESS_INDEX_VERSION = 1;

type ChoppinessIndexParams = {
  period: number;
};

/**
 * Create an incremental Choppiness Index indicator
 *
 * @example
 * ```ts
 * const chop = createChoppinessIndex({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = chop.next(candle);
 *   if (value !== null && value > 61.8) console.log('Choppy market');
 * }
 * ```
 */
export function createChoppinessIndex(
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ChoppinessIndexState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<ChoppinessIndexState>> {
  const { params, state, reconfigured } = resolveResume<
    ChoppinessIndexParams,
    ChoppinessIndexState
  >({
    indicator: "choppinessIndex",
    version: CHOPPINESS_INDEX_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14 },
  });

  const period = requireParam(
    "choppinessIndex",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const log10Period = Math.log10(period);

  let trBuffer: CircularBuffer<number>;
  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let prevClose: number | null;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. Buffers are raw TR / high / low values — no
      // per-period derivation, so we just carry forward the most
      // recent min(snapshot.length, newPeriod) samples into buffers
      // sized at the new period.
      const oldTr = CircularBuffer.fromSnapshot(state.trBuffer);
      const oldH = CircularBuffer.fromSnapshot(state.highBuffer);
      const oldL = CircularBuffer.fromSnapshot(state.lowBuffer);
      trBuffer = new CircularBuffer<number>(period);
      highBuffer = new CircularBuffer<number>(period);
      lowBuffer = new CircularBuffer<number>(period);
      const available = oldTr.length;
      const carryStart = Math.max(0, available - period);
      for (let i = carryStart; i < available; i++) {
        trBuffer.push(oldTr.get(i));
        highBuffer.push(oldH.get(i));
        lowBuffer.push(oldL.get(i));
      }
      prevClose = state.prevClose;
      count = state.count;
    } else {
      trBuffer = CircularBuffer.fromSnapshot(state.trBuffer);
      highBuffer = CircularBuffer.fromSnapshot(state.highBuffer);
      lowBuffer = CircularBuffer.fromSnapshot(state.lowBuffer);
      prevClose = state.prevClose;
      count = state.count;
    }
  } else {
    trBuffer = new CircularBuffer<number>(period);
    highBuffer = new CircularBuffer<number>(period);
    lowBuffer = new CircularBuffer<number>(period);
    prevClose = null;
    count = 0;
  }

  function compute(): number | null {
    // Batch starts valid at index=period (0-based), using TR[1..period].
    // Our buffer includes TR=0 from the first candle until count > period.
    if (trBuffer.length < period || count <= period) return null;

    let trSum = 0;
    let hh = Number.NEGATIVE_INFINITY;
    let ll = Number.POSITIVE_INFINITY;

    for (let i = 0; i < trBuffer.length; i++) {
      trSum += trBuffer.get(i);
      const h = highBuffer.get(i);
      const l = lowBuffer.get(i);
      if (h > hh) hh = h;
      if (l < ll) ll = l;
    }

    const range = hh - ll;
    if (range <= 0) return null;

    return (100 * Math.log10(trSum / range)) / log10Period;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<ChoppinessIndexState>> = {
    next(candle: NormalizedCandle) {
      count++;

      // TR calculation
      let tr: number;
      if (prevClose === null) {
        tr = 0; // First bar
      } else {
        tr = Math.max(
          candle.high - candle.low,
          Math.abs(candle.high - prevClose),
          Math.abs(candle.low - prevClose),
        );
      }

      trBuffer.push(tr);
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      prevClose = candle.close;

      return { time: candle.time, value: compute() };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null) {
        return { time: candle.time, value: null };
      }

      const tr = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose),
      );

      const peekTr = CircularBuffer.fromSnapshot<number>(trBuffer.snapshot());
      const peekH = CircularBuffer.fromSnapshot<number>(highBuffer.snapshot());
      const peekL = CircularBuffer.fromSnapshot<number>(lowBuffer.snapshot());
      peekTr.push(tr);
      peekH.push(candle.high);
      peekL.push(candle.low);

      // Same gate as `compute()`: need a full buffer AND we must be
      // past the first-bar TR=0 (count + 1 > period means at least
      // one TR computed from a real prevClose has rolled in).
      if (peekTr.length < period || count + 1 <= period) {
        return { time: candle.time, value: null };
      }

      let trSum = 0;
      let hh = Number.NEGATIVE_INFINITY;
      let ll = Number.POSITIVE_INFINITY;
      for (let i = 0; i < peekTr.length; i++) {
        trSum += peekTr.get(i);
        if (peekH.get(i) > hh) hh = peekH.get(i);
        if (peekL.get(i) < ll) ll = peekL.get(i);
      }

      const range = hh - ll;
      if (range <= 0) return { time: candle.time, value: null };

      return { time: candle.time, value: (100 * Math.log10(trSum / range)) / log10Period };
    },

    getState(): IndicatorSnapshot<ChoppinessIndexState> {
      return makeSnapshot(
        "choppinessIndex",
        CHOPPINESS_INDEX_VERSION,
        { period },
        {
          trBuffer: trBuffer.snapshot(),
          highBuffer: highBuffer.snapshot(),
          lowBuffer: lowBuffer.snapshot(),
          prevClose,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return trBuffer.length >= period && count > period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
