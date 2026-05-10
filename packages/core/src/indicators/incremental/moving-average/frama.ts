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
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type FramaState = {
  period: number;
  effectivePeriod: number;
  halfPeriod: number;
  source: PriceSource;
  prevFrama: number | null;
  highBuffer: { data: number[]; head: number; length: number; capacity: number };
  lowBuffer: { data: number[]; head: number; length: number; capacity: number };
  count: number;
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
  warmUpOptions?: WarmUpOptions<FramaState>,
): IncrementalIndicator<number | null, FramaState> {
  // Resume contract: a snapshot can only be resumed with the SAME
  // period and source it was created under. FRAMA is fundamentally
  // recursive (`prevFrama` carries the smoothed history forward forever),
  // so changing either of those mid-stream produces a series that
  // doesn't match what `createFrama(newOptions)` would compute over the
  // same candle history. We refuse the reconfiguration explicitly rather
  // than silently producing a hybrid output.
  //
  // If options are omitted on resume, snapshot values are restored.
  // If options are provided, they must match the snapshot or be the
  // first time the indicator is created (no fromState).
  const fs = warmUpOptions?.fromState ?? null;
  const period = options.period ?? fs?.period ?? 16;
  const source: PriceSource = options.source ?? fs?.source ?? "close";
  const effectivePeriod = period % 2 === 0 ? period : period + 1;
  const halfPeriod = effectivePeriod / 2;

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let prevFrama: number | null;
  let count: number;

  if (fs) {
    if (fs.effectivePeriod !== effectivePeriod) {
      throw new Error(
        `FRAMA cannot be resumed with a different period (snapshot effectivePeriod=${fs.effectivePeriod}, requested=${effectivePeriod}). Re-warm a fresh instance instead.`,
      );
    }
    if (fs.source !== source) {
      throw new Error(
        `FRAMA cannot be resumed with a different source (snapshot=${fs.source}, requested=${source}). Re-warm a fresh instance instead.`,
      );
    }

    if (!fs.highBuffer || !fs.lowBuffer) {
      // Pre-canonical FRAMA stored a single close-only `buffer`. We
      // refuse silent migration: seeding both buffers from closes loses
      // the wick range information, and any preservation of the old
      // `prevFrama` would bake the non-canonical close-based smoothing
      // into every subsequent value. Force a clean re-warm.
      throw new Error(
        "FRAMA state schema changed: snapshots taken before high/low range support cannot be resumed. Re-warm a fresh instance from candle history.",
      );
    }
    highBuffer = CircularBuffer.fromSnapshot(fs.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(fs.lowBuffer);
    prevFrama = fs.prevFrama;
    count = fs.count;
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

  const indicator: IncrementalIndicator<number | null, FramaState> = {
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

      // Gate on the *existing* buffer being full (not the simulated +1
      // length). Otherwise the loop below would call
      // `highBuffer.get(j+1)` for j up to effectivePeriod-2 — which
      // requires length >= effectivePeriod. After a period-growing
      // resume the buffer is partially refilled and we must report null
      // until next() finishes warming.
      if (highBuffer.length < effectivePeriod) {
        return { time: candle.time, value: null };
      }

      if (prevFrama === null) {
        return { time: candle.time, value: price };
      }

      // Simulate buffer with new candle's high/low.
      let h1High = Number.NEGATIVE_INFINITY;
      let h1Low = Number.POSITIVE_INFINITY;
      let h2High = Number.NEGATIVE_INFINITY;
      let h2Low = Number.POSITIVE_INFINITY;
      let fHigh = Number.NEGATIVE_INFINITY;
      let fLow = Number.POSITIVE_INFINITY;

      for (let j = 0; j < effectivePeriod; j++) {
        const high = j < effectivePeriod - 1 ? highBuffer.get(j + 1) : candle.high;
        const low = j < effectivePeriod - 1 ? lowBuffer.get(j + 1) : candle.low;

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

    getState(): FramaState {
      return {
        period,
        effectivePeriod,
        halfPeriod,
        source,
        prevFrama,
        highBuffer: highBuffer.snapshot(),
        lowBuffer: lowBuffer.snapshot(),
        count,
      };
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
