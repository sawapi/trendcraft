/**
 * Incremental Mass Index
 *
 * Detects trend reversals by measuring the narrowing and widening
 * of the range between high and low prices.
 *
 * Formula:
 *   1. singleEma = EMA(high - low, emaPeriod)
 *   2. doubleEma = EMA(singleEma, emaPeriod)
 *   3. ratio = singleEma / doubleEma
 *   4. massIndex = SUM(ratio, sumPeriod)
 *
 * A "reversal bulge" occurs when Mass Index rises above 27 then drops below 26.5.
 *
 * Composes: 2x EMA (cascaded) + CircularBuffer for ratio sum
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { createEma } from "../moving-average/ema";
import type { EmaState } from "../moving-average/ema";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";

/**
 * State for incremental Mass Index
 */
export type MassIndexState = {
  emaPeriod: number;
  sumPeriod: number;
  ema1State: EmaState;
  ema2State: EmaState;
  ratioBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  ratioSum: number;
  count: number;
};

/**
 * Create an incremental Mass Index indicator
 *
 * @example
 * ```ts
 * const mi = createMassIndex({ emaPeriod: 9, sumPeriod: 25 });
 * for (const candle of stream) {
 *   const { value } = mi.next(candle);
 *   if (mi.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createMassIndex(
  options: { emaPeriod?: number; sumPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<MassIndexState>,
): IncrementalIndicator<number | null, MassIndexState> {
  const emaPeriod = options.emaPeriod ?? 9;
  const sumPeriod = options.sumPeriod ?? 25;

  let ema1: ReturnType<typeof createEma>;
  let ema2: ReturnType<typeof createEma>;
  let ratioBuffer: CircularBuffer<number>;
  let ratioSum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    ema1 = createEma({ period: emaPeriod }, { fromState: s.ema1State });
    ema2 = createEma({ period: emaPeriod }, { fromState: s.ema2State });
    ratioBuffer = CircularBuffer.fromSnapshot(s.ratioBuffer);
    ratioSum = s.ratioSum;
    count = s.count;
  } else {
    ema1 = createEma({ period: emaPeriod });
    ema2 = createEma({ period: emaPeriod });
    ratioBuffer = new CircularBuffer<number>(sumPeriod);
    ratioSum = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, MassIndexState> = {
    next(candle: NormalizedCandle) {
      count++;

      const range = candle.high - candle.low;
      const e1Val = ema1.next(makeCandle(candle.time, range)).value;

      if (e1Val === null) {
        return { time: candle.time, value: null };
      }

      const e2Val = ema2.next(makeCandle(candle.time, e1Val)).value;

      if (e2Val === null || e2Val === 0) {
        return { time: candle.time, value: null };
      }

      const ratio = e1Val / e2Val;

      if (ratioBuffer.isFull) {
        ratioSum = ratioSum - ratioBuffer.oldest() + ratio;
      } else {
        ratioSum += ratio;
      }
      ratioBuffer.push(ratio);

      if (ratioBuffer.length >= sumPeriod) {
        return { time: candle.time, value: ratioSum };
      }

      return { time: candle.time, value: null };
    },

    peek(candle: NormalizedCandle) {
      const range = candle.high - candle.low;
      const e1Val = ema1.peek(makeCandle(candle.time, range)).value;
      if (e1Val === null) return { time: candle.time, value: null };

      const e2Val = ema2.peek(makeCandle(candle.time, e1Val)).value;
      if (e2Val === null || e2Val === 0) return { time: candle.time, value: null };

      const ratio = e1Val / e2Val;

      let peekSum: number;
      if (ratioBuffer.isFull) {
        peekSum = ratioSum - ratioBuffer.oldest() + ratio;
      } else {
        peekSum = ratioSum + ratio;
      }

      const peekLength = ratioBuffer.isFull ? ratioBuffer.length : ratioBuffer.length + 1;
      if (peekLength >= sumPeriod) {
        return { time: candle.time, value: peekSum };
      }

      return { time: candle.time, value: null };
    },

    getState(): MassIndexState {
      return {
        emaPeriod,
        sumPeriod,
        ema1State: ema1.getState(),
        ema2State: ema2.getState(),
        ratioBuffer: ratioBuffer.snapshot(),
        ratioSum,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return ratioBuffer.length >= sumPeriod;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
