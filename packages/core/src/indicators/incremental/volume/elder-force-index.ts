/**
 * Incremental Elder's Force Index
 *
 * Force Index = (Close - Previous Close) × Volume, smoothed with EMA.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type ElderForceIndexState = {
  period: number;
  prevClose: number | null;
  emaMultiplier: number;
  emaValue: number | null;
  rawSum: number;
  count: number;
};

/**
 * Create an incremental Elder's Force Index indicator
 *
 * @example
 * ```ts
 * const efi = createElderForceIndex({ period: 13 });
 * for (const candle of stream) {
 *   const { value } = efi.next(candle);
 *   if (efi.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createElderForceIndex(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<ElderForceIndexState>,
): IncrementalIndicator<number | null, ElderForceIndexState> {
  const period = options.period ?? 13;
  const emaMultiplier = 2 / (period + 1);

  let prevClose: number | null;
  let emaValue: number | null;
  let rawSum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevClose = s.prevClose;
    emaValue = s.emaValue;
    rawSum = s.rawSum;
    count = s.count;
  } else {
    prevClose = null;
    emaValue = null;
    rawSum = 0;
    count = 0;
  }

  function computeRawForce(candle: NormalizedCandle): number {
    if (prevClose === null) return 0;
    return (candle.close - prevClose) * candle.volume;
  }

  const indicator: IncrementalIndicator<number | null, ElderForceIndexState> = {
    next(candle: NormalizedCandle) {
      const rawForce = computeRawForce(candle);
      count++;

      if (count < period) {
        rawSum += rawForce;
        prevClose = candle.close;
        return { time: candle.time, value: null };
      }

      if (count === period) {
        rawSum += rawForce;
        emaValue = rawSum / period;
        prevClose = candle.close;
        return { time: candle.time, value: emaValue };
      }

      // EMA smoothing
      emaValue = rawForce * emaMultiplier + (emaValue ?? 0) * (1 - emaMultiplier);
      prevClose = candle.close;
      return { time: candle.time, value: emaValue };
    },

    peek(candle: NormalizedCandle) {
      const rawForce = computeRawForce(candle);
      const peekCount = count + 1;

      if (peekCount < period) {
        return { time: candle.time, value: null };
      }

      if (peekCount === period) {
        return { time: candle.time, value: (rawSum + rawForce) / period };
      }

      return {
        time: candle.time,
        value: rawForce * emaMultiplier + (emaValue ?? 0) * (1 - emaMultiplier),
      };
    },

    getState(): ElderForceIndexState {
      return { period, prevClose, emaMultiplier, emaValue, rawSum, count };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
