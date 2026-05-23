/**
 * Incremental FRAMA (Fractal Adaptive Moving Average)
 *
 * Canonical Ehlers (2005): the fractal-dimension lookback uses each
 * candle's high and low (not the smoothing source), so the period
 * range reflects true intrabar excursion. The `source` option still
 * drives the FRAMA update.
 *
 * 1. Split period into two halves, compute (HighestHigh - LowestLow)/N
 *    for each half and the full period.
 * 2. Fractal dimension D = (log(n1 + n2) - log(n3)) / log(2).
 * 3. alpha = exp(-4.6 * (D - 1)), clamped to [0.01, 1].
 * 4. FRAMA = alpha * source + (1 - alpha) * prevFRAMA.
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
 * Bare state shape for FRAMA. Params (`period`, `source`) live in
 * `meta.params`; `effectivePeriod` / `halfPeriod` are derived from
 * `period` in the factory closure and intentionally not persisted.
 */
export type FramaState = {
  prevFrama: number | null;
  highBuffer: { data: number[]; head: number; length: number; capacity: number };
  lowBuffer: { data: number[]; head: number; length: number; capacity: number };
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const FRAMA_VERSION = 1;

type FramaParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental FRAMA indicator
 *
 * @example
 * ```ts
 * const frama = createFrama({ period: 16 });
 * for (const candle of stream) {
 *   const { value } = frama.next(candle);
 *   if (frama.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createFrama(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<FramaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<FramaState>> {
  // FRAMA is Mixed: the recursive `prevFrama` carries smoothed history
  // forward forever, so changing `period` / `source` mid-stream
  // produces a hybrid series. The mixed-category `resolveResume`
  // policy refuses any param change on resume.
  const { params, state } = resolveResume<FramaParams, FramaState>({
    indicator: "frama",
    version: FRAMA_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 16, source: "close" },
  });

  const period = requireParam(
    "frama",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const effectivePeriod = period % 2 === 0 ? period : period + 1;
  const halfPeriod = effectivePeriod / 2;

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let prevFrama: number | null;
  let count: number;

  if (state !== null) {
    highBuffer = CircularBuffer.fromSnapshot(state.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(state.lowBuffer);
    prevFrama = state.prevFrama;
    count = state.count;
  } else {
    highBuffer = new CircularBuffer<number>(effectivePeriod);
    lowBuffer = new CircularBuffer<number>(effectivePeriod);
    prevFrama = null;
    count = 0;
  }

  function rangesAndAlpha(): number {
    let h1High = Number.NEGATIVE_INFINITY;
    let h1Low = Number.POSITIVE_INFINITY;
    let h2High = Number.NEGATIVE_INFINITY;
    let h2Low = Number.POSITIVE_INFINITY;
    let fHigh = Number.NEGATIVE_INFINITY;
    let fLow = Number.POSITIVE_INFINITY;

    for (let j = 0; j < effectivePeriod; j++) {
      const high = highBuffer.get(j);
      const low = lowBuffer.get(j);

      if (j < halfPeriod) {
        if (high > h1High) h1High = high;
        if (low < h1Low) h1Low = low;
      } else {
        if (high > h2High) h2High = high;
        if (low < h2Low) h2Low = low;
      }

      if (high > fHigh) fHigh = high;
      if (low < fLow) fLow = low;
    }

    const n1 = (h1High - h1Low) / halfPeriod;
    const n2 = (h2High - h2Low) / halfPeriod;
    const n3 = (fHigh - fLow) / effectivePeriod;

    if (n1 > 0 && n2 > 0 && n3 > 0) {
      const d = (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2);
      const a = Math.exp(-4.6 * (d - 1));
      return Math.max(0.01, Math.min(1, a));
    }
    return 0.01;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<FramaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);

      // Warm-up gated on the buffer being full, not on `count`. After a
      // period-growing resume the snapshot's `count` is large but the
      // rebuilt buffer needs new candles to fill.
      if (highBuffer.length < effectivePeriod) {
        return { time: candle.time, value: null };
      }

      if (prevFrama === null) {
        prevFrama = price;
        return { time: candle.time, value: prevFrama };
      }

      const alpha = rangesAndAlpha();
      prevFrama = alpha * price + (1 - alpha) * prevFrama;
      return { time: candle.time, value: prevFrama };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      // Mirror next(): it pushes first, then gates on
      // `buffer.length >= effectivePeriod`. After a simulated push the
      // window holds min(length + 1, capacity) entries, so peek must
      // gate on `length + 1 >= effectivePeriod` to agree with next on
      // the warmup boundary.
      if (highBuffer.length + 1 < effectivePeriod) {
        return { time: candle.time, value: null };
      }

      if (prevFrama === null) {
        return { time: candle.time, value: price };
      }

      // Simulate the post-push window: the most recent
      // (effectivePeriod - 1) buffer entries plus the new candle.
      // `startIdx` is 1 when the buffer is full (the push evicts the
      // oldest entry) and 0 when it holds exactly effectivePeriod - 1.
      const startIdx = highBuffer.length - (effectivePeriod - 1);
      let h1High = Number.NEGATIVE_INFINITY;
      let h1Low = Number.POSITIVE_INFINITY;
      let h2High = Number.NEGATIVE_INFINITY;
      let h2Low = Number.POSITIVE_INFINITY;
      let fHigh = Number.NEGATIVE_INFINITY;
      let fLow = Number.POSITIVE_INFINITY;

      for (let j = 0; j < effectivePeriod; j++) {
        const high = j < effectivePeriod - 1 ? highBuffer.get(startIdx + j) : candle.high;
        const low = j < effectivePeriod - 1 ? lowBuffer.get(startIdx + j) : candle.low;

        if (j < halfPeriod) {
          if (high > h1High) h1High = high;
          if (low < h1Low) h1Low = low;
        } else {
          if (high > h2High) h2High = high;
          if (low < h2Low) h2Low = low;
        }

        if (high > fHigh) fHigh = high;
        if (low < fLow) fLow = low;
      }

      const n1 = (h1High - h1Low) / halfPeriod;
      const n2 = (h2High - h2Low) / halfPeriod;
      const n3 = (fHigh - fLow) / effectivePeriod;

      let alpha: number;
      if (n1 > 0 && n2 > 0 && n3 > 0) {
        const d = (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2);
        alpha = Math.max(0.01, Math.min(1, Math.exp(-4.6 * (d - 1))));
      } else {
        alpha = 0.01;
      }

      return { time: candle.time, value: alpha * price + (1 - alpha) * prevFrama };
    },

    getState(): IndicatorSnapshot<FramaState> {
      return makeSnapshot(
        "frama",
        FRAMA_VERSION,
        { period, source },
        {
          prevFrama,
          highBuffer: highBuffer.snapshot(),
          lowBuffer: lowBuffer.snapshot(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return prevFrama !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
