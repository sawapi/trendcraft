/**
 * Incremental ADXR (Average Directional Movement Index Rating)
 *
 * ADXR = (ADX[current] + ADX[current - (period - 1)]) / 2
 * Wraps createDmi and maintains a circular buffer of ADX history.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { createDmi } from "./dmi";
import type { DmiState } from "./dmi";

export type AdxrState = {
  period: number;
  dmiPeriod: number;
  adxPeriod: number;
  dmiState: DmiState;
  adxBuffer: ReturnType<CircularBuffer<number | null>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental ADXR indicator
 *
 * @example
 * ```ts
 * const adxr = createAdxr({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = adxr.next(candle);
 *   if (adxr.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createAdxr(
  options: { period?: number; dmiPeriod?: number; adxPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<AdxrState>,
): IncrementalIndicator<number | null, AdxrState> {
  const period = options.period ?? 14;
  const dmiPeriod = options.dmiPeriod ?? 14;
  const adxPeriod = options.adxPeriod ?? 14;

  // ADXR lookback matches TA-Lib: adx[i] + adx[i-(period-1)]
  const lookback = period - 1;

  let dmiInd: ReturnType<typeof createDmi>;
  let adxBuffer: CircularBuffer<number | null>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    dmiInd = createDmi({ period: dmiPeriod, adxPeriod }, { fromState: s.dmiState });
    adxBuffer = CircularBuffer.fromSnapshot(s.adxBuffer);
    count = s.count;
  } else {
    dmiInd = createDmi({ period: dmiPeriod, adxPeriod });
    // Buffer needs to hold at least lookback+1 values to access the past ADX
    adxBuffer = new CircularBuffer<number | null>(lookback + 1);
    count = 0;
  }

  function computeAdxr(currentAdx: number | null): number | null {
    if (currentAdx === null) return null;
    if (adxBuffer.length < lookback) return null;

    // The oldest value in the buffer when full represents adx[i - lookback]
    const pastAdx = adxBuffer.get(adxBuffer.length - lookback);
    if (pastAdx === null) return null;

    return (currentAdx + pastAdx) / 2;
  }

  const indicator: IncrementalIndicator<number | null, AdxrState> = {
    next(candle: NormalizedCandle) {
      count++;
      const dmiResult = dmiInd.next(candle);
      const currentAdx = dmiResult.value.adx;
      const value = computeAdxr(currentAdx);
      adxBuffer.push(currentAdx);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const dmiResult = dmiInd.peek(candle);
      const currentAdx = dmiResult.value.adx;

      if (currentAdx === null) return { time: candle.time, value: null };
      if (adxBuffer.length < lookback) return { time: candle.time, value: null };

      const pastAdx = adxBuffer.get(adxBuffer.length - lookback);
      if (pastAdx === null) return { time: candle.time, value: null };

      return { time: candle.time, value: (currentAdx + pastAdx) / 2 };
    },

    getState(): AdxrState {
      return {
        period,
        dmiPeriod,
        adxPeriod,
        dmiState: dmiInd.getState(),
        adxBuffer: adxBuffer.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return adxBuffer.length > lookback && adxBuffer.get(adxBuffer.length - lookback) !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
