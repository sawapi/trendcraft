/**
 * Incremental WMA (Weighted Moving Average)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type WmaState = {
  period: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  weightedSum: number;
  simpleSum: number;
  weightDenominator: number;
  count: number;
};

/**
 * Create an incremental WMA indicator
 *
 * WMA = (P₀×n + P₁×(n-1) + ... + Pₙ₋₁×1) / (n×(n+1)/2)
 *
 * @example
 * ```ts
 * const wma10 = createWma({ period: 10 });
 * for (const candle of stream) {
 *   const { value } = wma10.next(candle);
 *   if (wma10.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createWma(
  options: { period: number; source?: PriceSource },
  warmUpOptions?: WarmUpOptions<WmaState>,
): IncrementalIndicator<number | null, WmaState> {
  const period = options.period;
  const source: PriceSource = options.source ?? "close";
  const weightDenominator = (period * (period + 1)) / 2;

  let buffer: CircularBuffer<number>;
  let weightedSum: number;
  let simpleSum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    weightedSum = s.weightedSum;
    simpleSum = s.simpleSum;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    weightedSum = 0;
    simpleSum = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, WmaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      if (buffer.isFull) {
        // Sliding window update:
        // weightedSum = weightedSum - simpleSum + newPrice * period
        // simpleSum = simpleSum - oldest + newPrice
        weightedSum = weightedSum - simpleSum + price * period;
        simpleSum = simpleSum - buffer.oldest() + price;
      } else {
        // Building up the initial window
        buffer.push(price); // push first so we can read length
        // Recalculate from scratch during warmup for simplicity
        weightedSum = 0;
        simpleSum = 0;
        const len = buffer.length;
        for (let i = 0; i < len; i++) {
          const w = i + 1;
          weightedSum += buffer.get(i) * w;
          simpleSum += buffer.get(i);
        }

        if (count < period) {
          return { time: candle.time, value: null };
        }

        return { time: candle.time, value: weightedSum / weightDenominator };
      }

      buffer.push(price);

      return { time: candle.time, value: weightedSum / weightDenominator };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      if (peekCount < period) {
        return { time: candle.time, value: null };
      }

      if (buffer.isFull) {
        const newWeightedSum = weightedSum - simpleSum + price * period;
        return { time: candle.time, value: newWeightedSum / weightDenominator };
      }

      // During warmup phase, compute from scratch
      let ws = 0;
      const len = buffer.length;
      for (let i = 0; i < len; i++) {
        ws += buffer.get(i) * (i + 1);
      }
      ws += price * (len + 1);
      const wd = ((len + 1) * (len + 2)) / 2;
      return { time: candle.time, value: ws / wd };
    },

    getState(): WmaState {
      return {
        period,
        source,
        buffer: buffer.snapshot(),
        weightedSum,
        simpleSum,
        weightDenominator,
        count,
      };
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
