/**
 * Incremental Bollinger Bands
 *
 * Uses population variance (/N, not /(N-1)) for TA-Lib compatibility.
 */

import type { BollingerBandsValue, NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type BollingerBandsState = {
  period: number;
  stdDev: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  sumSquares: number;
  count: number;
};

/**
 * Create an incremental Bollinger Bands indicator
 *
 * @example
 * ```ts
 * const bb = createBollingerBands({ period: 20, stdDev: 2 });
 * for (const candle of stream) {
 *   const { value } = bb.next(candle);
 *   if (bb.isWarmedUp) console.log(value.upper, value.middle, value.lower);
 * }
 * ```
 */
export function createBollingerBands(
  options: { period?: number; stdDev?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<BollingerBandsState>,
): IncrementalIndicator<BollingerBandsValue, BollingerBandsState> {
  const period = options.period ?? 20;
  const stdDevMult = options.stdDev ?? 2;
  const source: PriceSource = options.source ?? "close";

  let buffer: CircularBuffer<number>;
  let sum: number;
  let sumSquares: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    sum = s.sum;
    sumSquares = s.sumSquares;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    sumSquares = 0;
    count = 0;
  }

  const nullValue: BollingerBandsValue = {
    upper: null,
    middle: null,
    lower: null,
    percentB: null,
    bandwidth: null,
  };

  function computeBands(
    currentSum: number,
    currentSumSq: number,
    price: number,
  ): BollingerBandsValue {
    const mean = currentSum / period;
    const variance = Math.max(0, currentSumSq / period - mean * mean);
    const std = Math.sqrt(variance);

    const upper = mean + stdDevMult * std;
    const lower = mean - stdDevMult * std;
    const bandWidth = upper - lower;

    const percentB = bandWidth > 0 ? (price - lower) / bandWidth : 0.5;
    const bandwidth = mean !== 0 ? bandWidth / mean : 0;

    return { upper, middle: mean, lower, percentB, bandwidth };
  }

  const indicator: IncrementalIndicator<BollingerBandsValue, BollingerBandsState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        sum = sum - oldest + price;
        sumSquares = sumSquares - oldest * oldest + price * price;
      } else {
        sum += price;
        sumSquares += price * price;
      }

      buffer.push(price);

      if (count < period) {
        return { time: candle.time, value: nullValue };
      }

      return { time: candle.time, value: computeBands(sum, sumSquares, price) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (count + 1 < period) {
        return { time: candle.time, value: nullValue };
      }

      let peekSum = sum;
      let peekSumSq = sumSquares;

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        peekSum = peekSum - oldest + price;
        peekSumSq = peekSumSq - oldest * oldest + price * price;
      } else {
        peekSum += price;
        peekSumSq += price * price;
      }

      return { time: candle.time, value: computeBands(peekSum, peekSumSq, price) };
    },

    getState(): BollingerBandsState {
      return {
        period,
        stdDev: stdDevMult,
        source,
        buffer: buffer.snapshot(),
        sum,
        sumSquares,
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
