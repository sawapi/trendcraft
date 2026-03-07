/**
 * Incremental Stochastics
 *
 * Implements %K and %D using sliding window min/max + SMA smoothing.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type StochasticsValue = {
  k: number | null;
  d: number | null;
};

export type StochasticsState = {
  kPeriod: number;
  dPeriod: number;
  slowing: number;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  rawKBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  kBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  rawKSum: number;
  rawKValidCount: number;
  kSum: number;
  kValidCount: number;
  count: number;
};

/**
 * Create an incremental Stochastics indicator
 *
 * @example
 * ```ts
 * const stoch = createStochastics({ kPeriod: 14, dPeriod: 3, slowing: 3 });
 * for (const candle of stream) {
 *   const { value } = stoch.next(candle);
 *   if (stoch.isWarmedUp) console.log(value.k, value.d);
 * }
 * ```
 */
export function createStochastics(
  options: { kPeriod?: number; dPeriod?: number; slowing?: number } = {},
  warmUpOptions?: WarmUpOptions<StochasticsState>,
): IncrementalIndicator<StochasticsValue, StochasticsState> {
  const kPeriod = options.kPeriod ?? 14;
  const dPeriod = options.dPeriod ?? 3;
  const slowing = options.slowing ?? 3;

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let rawKBuffer: CircularBuffer<number>;
  let kBuffer: CircularBuffer<number>;
  let rawKSum: number;
  let rawKValidCount: number;
  let kSum: number;
  let kValidCount: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    highBuffer = CircularBuffer.fromSnapshot(s.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(s.lowBuffer);
    rawKBuffer = CircularBuffer.fromSnapshot(s.rawKBuffer);
    kBuffer = CircularBuffer.fromSnapshot(s.kBuffer);
    rawKSum = s.rawKSum;
    rawKValidCount = s.rawKValidCount;
    kSum = s.kSum;
    kValidCount = s.kValidCount;
    count = s.count;
  } else {
    highBuffer = new CircularBuffer<number>(kPeriod);
    lowBuffer = new CircularBuffer<number>(kPeriod);
    rawKBuffer = new CircularBuffer<number>(slowing);
    kBuffer = new CircularBuffer<number>(dPeriod);
    rawKSum = 0;
    rawKValidCount = 0;
    kSum = 0;
    kValidCount = 0;
    count = 0;
  }

  function getHighestHigh(): number {
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < highBuffer.length; i++) {
      if (highBuffer.get(i) > max) max = highBuffer.get(i);
    }
    return max;
  }

  function getLowestLow(): number {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < lowBuffer.length; i++) {
      if (lowBuffer.get(i) < min) min = lowBuffer.get(i);
    }
    return min;
  }

  const nullValue: StochasticsValue = { k: null, d: null };

  const indicator: IncrementalIndicator<StochasticsValue, StochasticsState> = {
    next(candle: NormalizedCandle) {
      count++;

      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);

      // Step 1: Raw %K
      if (count < kPeriod) {
        return { time: candle.time, value: nullValue };
      }

      const highestHigh = getHighestHigh();
      const lowestLow = getLowestLow();
      const range = highestHigh - lowestLow;
      const rawK = range === 0 ? 50 : (100 * (candle.close - lowestLow)) / range;

      // Step 2: SMA of rawK (slowing)
      if (rawKBuffer.isFull) {
        rawKSum = rawKSum - rawKBuffer.oldest() + rawK;
      } else {
        rawKSum += rawK;
      }
      rawKBuffer.push(rawK);
      rawKValidCount++;

      if (rawKValidCount < slowing) {
        return { time: candle.time, value: nullValue };
      }

      const kVal = rawKSum / slowing;

      // Step 3: SMA of K (dPeriod) = %D
      if (kBuffer.isFull) {
        kSum = kSum - kBuffer.oldest() + kVal;
      } else {
        kSum += kVal;
      }
      kBuffer.push(kVal);
      kValidCount++;

      if (kValidCount < dPeriod) {
        return { time: candle.time, value: { k: kVal, d: null } };
      }

      const dVal = kSum / dPeriod;
      return { time: candle.time, value: { k: kVal, d: dVal } };
    },

    peek(candle: NormalizedCandle) {
      if (count + 1 < kPeriod) {
        return { time: candle.time, value: nullValue };
      }

      // Would need to compute peek of sliding window - approximate with current state
      // For peek accuracy, this is a simplified version
      let maxH = candle.high;
      let minL = candle.low;
      const hLen = highBuffer.length;
      const skip = hLen >= kPeriod ? 1 : 0;
      for (let i = skip; i < hLen; i++) {
        if (highBuffer.get(i) > maxH) maxH = highBuffer.get(i);
        if (lowBuffer.get(i) < minL) minL = lowBuffer.get(i);
      }

      const range = maxH - minL;
      const rawK = range === 0 ? 50 : (100 * (candle.close - minL)) / range;

      const peekRawKValidCount = rawKValidCount + 1;
      if (peekRawKValidCount < slowing) {
        return { time: candle.time, value: nullValue };
      }

      let peekRawKSum = rawKSum;
      if (rawKBuffer.isFull) {
        peekRawKSum = peekRawKSum - rawKBuffer.oldest() + rawK;
      } else {
        peekRawKSum += rawK;
      }
      const kVal = peekRawKSum / slowing;

      const peekKValidCount = kValidCount + 1;
      if (peekKValidCount < dPeriod) {
        return { time: candle.time, value: { k: kVal, d: null } };
      }

      let peekKSum = kSum;
      if (kBuffer.isFull) {
        peekKSum = peekKSum - kBuffer.oldest() + kVal;
      } else {
        peekKSum += kVal;
      }
      const dVal = peekKSum / dPeriod;
      return { time: candle.time, value: { k: kVal, d: dVal } };
    },

    getState(): StochasticsState {
      return {
        kPeriod,
        dPeriod,
        slowing,
        highBuffer: highBuffer.snapshot(),
        lowBuffer: lowBuffer.snapshot(),
        rawKBuffer: rawKBuffer.snapshot(),
        kBuffer: kBuffer.snapshot(),
        rawKSum,
        rawKValidCount,
        kSum,
        kValidCount,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return kValidCount >= dPeriod;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
