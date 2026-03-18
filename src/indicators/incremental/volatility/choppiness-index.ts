/**
 * Incremental Choppiness Index
 *
 * CHOP = 100 * LOG10(SUM(TR, period) / (HH - LL)) / LOG10(period)
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type ChoppinessIndexState = {
  period: number;
  trBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevClose: number | null;
  count: number;
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
  warmUpOptions?: WarmUpOptions<ChoppinessIndexState>,
): IncrementalIndicator<number | null, ChoppinessIndexState> {
  const period = options.period ?? 14;
  if (period < 2) {
    throw new Error("Choppiness Index period must be at least 2");
  }
  const log10Period = Math.log10(period);

  let trBuffer: CircularBuffer<number>;
  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let prevClose: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    trBuffer = CircularBuffer.fromSnapshot(s.trBuffer);
    highBuffer = CircularBuffer.fromSnapshot(s.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(s.lowBuffer);
    prevClose = s.prevClose;
    count = s.count;
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

  const indicator: IncrementalIndicator<number | null, ChoppinessIndexState> = {
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

      if (peekTr.length < period) return { time: candle.time, value: null };

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

    getState(): ChoppinessIndexState {
      return {
        period,
        trBuffer: trBuffer.snapshot(),
        highBuffer: highBuffer.snapshot(),
        lowBuffer: lowBuffer.snapshot(),
        prevClose,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return trBuffer.isFull;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
