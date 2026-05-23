/**
 * Incremental VWMA (Volume Weighted Moving Average)
 *
 * State category: **Windowed** (raw price * volume + raw volume buffers).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<VwmaState>` and `fromState` accepts the same.
 *
 * VWMA = Sum(Price * Volume, n) / Sum(Volume, n)
 *
 * Defaults: `source` defaults to `"close"`. `period` has no canonical
 * default (Pine Script / TA-Lib / Tulip all require it from the
 * caller); it must be supplied on first construction. On resume, it
 * may be omitted to inherit from the snapshot.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for VWMA. Params (`period`, `source`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type VwmaState = {
  pvBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  volBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sumPV: number;
  sumV: number;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const VWMA_VERSION = 1;

type VwmaParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental VWMA indicator
 *
 * @example
 * ```ts
 * // Fresh start — period is required on first call.
 * const vwma20 = createVwma({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = vwma20.next(candle);
 *   if (vwma20.isWarmedUp) console.log(value);
 * }
 *
 * // Resume from a saved snapshot — period may be omitted; the
 * // snapshot supplies it.
 * const resumed = createVwma({}, { fromState: snapshot });
 * ```
 */
export function createVwma(
  options: { period?: number; source?: PriceSource },
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<VwmaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<VwmaState>> {
  const { params, state, reconfigured } = resolveResume<VwmaParams, VwmaState>({
    indicator: "vwma",
    version: VWMA_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { source: "close" }, // `period` is intentionally absent — no canonical default.
  });

  const period = requireParam(
    "vwma",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let pvBuffer: CircularBuffer<number>;
  let volBuffer: CircularBuffer<number>;
  let sumPV: number;
  let sumV: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. The snapshot's buffers are at the OLD capacity;
      // we need buffers at the NEW capacity holding the most recent
      // min(snapshot.length, newPeriod) samples. sumPV/sumV must be
      // recomputed from those carried samples — the snapshot's sums
      // were over the old window and would be wrong for the new one.
      const oldPv = CircularBuffer.fromSnapshot(state.pvBuffer);
      const oldVol = CircularBuffer.fromSnapshot(state.volBuffer);
      pvBuffer = new CircularBuffer<number>(period);
      volBuffer = new CircularBuffer<number>(period);
      const available = oldPv.length;
      const carryStart = Math.max(0, available - period);
      sumPV = 0;
      sumV = 0;
      for (let i = carryStart; i < available; i++) {
        const pv = oldPv.get(i);
        const vol = oldVol.get(i);
        pvBuffer.push(pv);
        volBuffer.push(vol);
        sumPV += pv;
        sumV += vol;
      }
      count = state.count;
    } else {
      pvBuffer = CircularBuffer.fromSnapshot(state.pvBuffer);
      volBuffer = CircularBuffer.fromSnapshot(state.volBuffer);
      sumPV = state.sumPV;
      sumV = state.sumV;
      count = state.count;
    }
  } else {
    pvBuffer = new CircularBuffer<number>(period);
    volBuffer = new CircularBuffer<number>(period);
    sumPV = 0;
    sumV = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<VwmaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const vol = candle.volume;
      const pv = price * vol;

      if (pvBuffer.isFull) {
        sumPV = sumPV - pvBuffer.oldest() + pv;
        sumV = sumV - volBuffer.oldest() + vol;
      } else {
        sumPV += pv;
        sumV += vol;
      }

      pvBuffer.push(pv);
      volBuffer.push(vol);
      count++;

      // Warm-up gated on the buffer being full, not on `count`. After
      // a period-growing resume, `count` is the snapshot's large
      // value but the rebuilt buffer needs more candles to fill.
      if (pvBuffer.length < period) {
        return { time: candle.time, value: null };
      }
      return { time: candle.time, value: sumV === 0 ? null : sumPV / sumV };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const vol = candle.volume;
      const pv = price * vol;
      const newSumPV = pvBuffer.isFull ? sumPV - pvBuffer.oldest() + pv : sumPV + pv;
      const newSumV = volBuffer.isFull ? sumV - volBuffer.oldest() + vol : sumV + vol;
      const newLength = Math.min(pvBuffer.length + 1, period);
      if (newLength < period) return { time: candle.time, value: null };
      return { time: candle.time, value: newSumV === 0 ? null : newSumPV / newSumV };
    },

    getState(): IndicatorSnapshot<VwmaState> {
      return makeSnapshot(
        "vwma",
        VWMA_VERSION,
        { period, source },
        {
          pvBuffer: pvBuffer.snapshot(),
          volBuffer: volBuffer.snapshot(),
          sumPV,
          sumV,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return pvBuffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
