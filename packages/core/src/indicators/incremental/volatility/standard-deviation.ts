/**
 * Incremental Standard Deviation
 *
 * Rolling population standard deviation (divides by N, matching the batch
 * `standardDeviation()` and TA-Lib convention). Maintains running sum and
 * sum-of-squares plus a CircularBuffer of the last `period` prices, so
 * each `next()` call is O(1).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type StandardDeviationState = {
  period: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  sumSq: number;
  count: number;
};

/**
 * Create an incremental Standard Deviation indicator.
 *
 * @example
 * ```ts
 * const sd = createStandardDeviation({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = sd.next(candle);
 *   if (sd.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createStandardDeviation(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<StandardDeviationState>,
): IncrementalIndicator<number | null, StandardDeviationState> {
  // Saved snapshot wins so resumed sums match the configuration they were
  // computed under, even if the caller forgets to pass period / source again.
  const period = warmUpOptions?.fromState?.period ?? options.period ?? 20;
  const source: PriceSource = warmUpOptions?.fromState?.source ?? options.source ?? "close";

  if (period < 1) {
    throw new Error("Standard Deviation period must be at least 1");
  }

  let buffer: CircularBuffer<number>;
  let sum: number;
  let sumSq: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    sum = s.sum;
    sumSq = s.sumSq;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    sumSq = 0;
    count = 0;
  }

  function compute(): number | null {
    if (count < period) return null;
    const mean = sum / period;
    // Variance = E[X²] - (E[X])²; clamp tiny negatives from float error.
    const variance = Math.max(0, sumSq / period - mean * mean);
    return Math.sqrt(variance);
  }

  const indicator: IncrementalIndicator<number | null, StandardDeviationState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      if (buffer.isFull) {
        const oldest = buffer.oldest();
        sum -= oldest;
        sumSq -= oldest * oldest;
      }
      buffer.push(price);
      sum += price;
      sumSq += price * price;
      count++;
      return { time: candle.time, value: compute() };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const willEvict = buffer.isFull;
      const peekSum = sum + price - (willEvict ? buffer.oldest() : 0);
      const peekSumSq = sumSq + price * price - (willEvict ? buffer.oldest() * buffer.oldest() : 0);
      const peekCount = count + 1;
      if (peekCount < period) return { time: candle.time, value: null };
      const mean = peekSum / period;
      const variance = Math.max(0, peekSumSq / period - mean * mean);
      return { time: candle.time, value: Math.sqrt(variance) };
    },

    getState(): StandardDeviationState {
      return { period, source, buffer: buffer.snapshot(), sum, sumSq, count };
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
