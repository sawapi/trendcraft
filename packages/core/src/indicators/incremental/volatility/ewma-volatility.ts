/**
 * Incremental EWMA Volatility
 *
 * Exponentially Weighted Moving Average volatility estimator.
 * Uses log returns and the RiskMetrics EWMA formula:
 *   variance_t = lambda * variance_{t-1} + (1 - lambda) * return_t^2
 *
 * Output is annualized volatility percentage.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type EwmaVolatilityState = {
  lambda: number;
  source: PriceSource;
  prevPrice: number | null;
  prevVariance: number | null;
  seedReturns: number[];
  seedDone: boolean;
  seedSize: number;
  count: number;
};

/**
 * Create an incremental EWMA Volatility indicator
 *
 * Computes log returns from candle prices internally and applies the EWMA
 * variance formula. Outputs annualized volatility as a percentage.
 *
 * @example
 * ```ts
 * const ewma = createEwmaVolatility({ lambda: 0.94 });
 * for (const candle of stream) {
 *   const { value } = ewma.next(candle);
 *   if (value !== null) console.log(`Vol: ${value.toFixed(2)}%`);
 * }
 * ```
 */
export function createEwmaVolatility(
  options: { lambda?: number; source?: PriceSource; seedSize?: number } = {},
  warmUpOptions?: WarmUpOptions<EwmaVolatilityState>,
): IncrementalIndicator<number | null, EwmaVolatilityState> {
  const lambda = options.lambda ?? 0.94;
  const source: PriceSource = options.source ?? "close";
  const seedSize = options.seedSize ?? 10;

  let prevPrice: number | null;
  let prevVariance: number | null;
  let seedReturns: number[];
  let seedDone: boolean;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevPrice = s.prevPrice;
    prevVariance = s.prevVariance;
    seedReturns = [...s.seedReturns];
    seedDone = s.seedDone;
    count = s.count;
  } else {
    prevPrice = null;
    prevVariance = null;
    seedReturns = [];
    seedDone = false;
    count = 0;
  }

  const annualFactor = Math.sqrt(252) * 100;

  function sampleVariance(returns: number[]): number {
    const n = returns.length;
    if (n < 2) return returns.length === 1 ? returns[0] * returns[0] : 0;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    let sumSq = 0;
    for (const r of returns) {
      const d = r - mean;
      sumSq += d * d;
    }
    return sumSq / (n - 1);
  }

  function computeOutput(variance: number): number {
    return Math.sqrt(Math.max(0, variance)) * annualFactor;
  }

  const indicator: IncrementalIndicator<number | null, EwmaVolatilityState> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      if (prevPrice === null) {
        prevPrice = price;
        return { time: candle.time, value: null };
      }

      const logReturn = Math.log(price / prevPrice);
      prevPrice = price;

      if (!seedDone) {
        seedReturns.push(logReturn);
        if (seedReturns.length >= seedSize) {
          // Seed variance from accumulated returns
          prevVariance = sampleVariance(seedReturns);
          // Apply EWMA for all returns after seeding
          seedDone = true;
          return { time: candle.time, value: computeOutput(prevVariance) };
        }
        // During accumulation, still compute a running EWMA
        if (seedReturns.length === 1) {
          prevVariance = logReturn * logReturn;
        } else {
          prevVariance = lambda * (prevVariance ?? 0) + (1 - lambda) * logReturn * logReturn;
        }
        return { time: candle.time, value: computeOutput(prevVariance) };
      }

      prevVariance = lambda * (prevVariance ?? 0) + (1 - lambda) * logReturn * logReturn;
      return { time: candle.time, value: computeOutput(prevVariance) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (prevPrice === null) {
        return { time: candle.time, value: null };
      }

      const logReturn = Math.log(price / prevPrice);

      if (!seedDone) {
        const peekReturns = [...seedReturns, logReturn];
        if (peekReturns.length >= seedSize) {
          const v = sampleVariance(peekReturns);
          return { time: candle.time, value: computeOutput(v) };
        }
        if (peekReturns.length === 1) {
          return { time: candle.time, value: computeOutput(logReturn * logReturn) };
        }
        const v = lambda * (prevVariance ?? 0) + (1 - lambda) * logReturn * logReturn;
        return { time: candle.time, value: computeOutput(v) };
      }

      const v = lambda * (prevVariance ?? 0) + (1 - lambda) * logReturn * logReturn;
      return { time: candle.time, value: computeOutput(v) };
    },

    getState(): EwmaVolatilityState {
      return {
        lambda,
        source,
        prevPrice,
        prevVariance,
        seedReturns: [...seedReturns],
        seedDone,
        seedSize,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return seedDone;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
