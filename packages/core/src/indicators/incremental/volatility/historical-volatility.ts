/**
 * Incremental Historical Volatility
 *
 * Standard deviation of log returns over a lookback period, annualized.
 * Uses sample variance (divides by N-1) for statistical correctness.
 *
 * Formula: HV = sqrt(variance(logReturns) * annualFactor) * 100
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type HistoricalVolatilityState = {
  period: number;
  annualFactor: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  sumSq: number;
  prevPrice: number | null;
  count: number;
};

/**
 * Create an incremental Historical Volatility indicator
 *
 * @example
 * ```ts
 * const hv = createHistoricalVolatility({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = hv.next(candle);
 *   if (hv.isWarmedUp) console.log(`HV: ${value?.toFixed(2)}%`);
 * }
 * ```
 */
export function createHistoricalVolatility(
  options: { period?: number; annualFactor?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<HistoricalVolatilityState>,
): IncrementalIndicator<number | null, HistoricalVolatilityState> {
  const period = options.period ?? 20;
  const annualFactor = options.annualFactor ?? 252;
  const source: PriceSource = options.source ?? "close";

  let buffer: CircularBuffer<number>;
  let sum: number;
  let sumSq: number;
  let prevPrice: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    sum = s.sum;
    sumSq = s.sumSq;
    prevPrice = s.prevPrice;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    sumSq = 0;
    prevPrice = null;
    count = 0;
  }

  function computeOutput(currentSum: number, currentSumSq: number, n: number): number {
    // Sample variance: (sumSq - sum^2/n) / (n - 1)
    const variance = (currentSumSq - (currentSum * currentSum) / n) / (n - 1);
    return Math.sqrt(Math.max(0, variance) * annualFactor) * 100;
  }

  const indicator: IncrementalIndicator<number | null, HistoricalVolatilityState> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      if (prevPrice === null) {
        prevPrice = price;
        return { time: candle.time, value: null };
      }

      if (price <= 0 || prevPrice <= 0) {
        prevPrice = price;
        return { time: candle.time, value: null };
      }

      const logReturn = Math.log(price / prevPrice);
      prevPrice = price;

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        sum = sum - oldest + logReturn;
        sumSq = sumSq - oldest * oldest + logReturn * logReturn;
      } else {
        sum += logReturn;
        sumSq += logReturn * logReturn;
      }

      buffer.push(logReturn);

      // Need period returns (= period+1 prices) for valid output
      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeOutput(sum, sumSq, period) };
    },

    peek(candle: NormalizedCandle) {
      if (prevPrice === null) {
        return { time: candle.time, value: null };
      }

      const price = getSourcePrice(candle, source);
      const logReturn = Math.log(price / prevPrice);

      let peekSum = sum;
      let peekSumSq = sumSq;
      let peekLen = buffer.length;

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        peekSum = peekSum - oldest + logReturn;
        peekSumSq = peekSumSq - oldest * oldest + logReturn * logReturn;
      } else {
        peekSum += logReturn;
        peekSumSq += logReturn * logReturn;
        peekLen++;
      }

      if (peekLen < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeOutput(peekSum, peekSumSq, period) };
    },

    getState(): HistoricalVolatilityState {
      return {
        period,
        annualFactor,
        source,
        buffer: buffer.snapshot(),
        sum,
        sumSq,
        prevPrice,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
