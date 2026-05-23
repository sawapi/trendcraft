/**
 * Incremental Historical Volatility
 *
 * Standard deviation of log returns over a lookback period, annualized.
 * Uses sample variance (divides by N-1) for statistical correctness.
 *
 * Formula: HV = sqrt(variance(logReturns) * annualFactor) * 100
 *
 * State category: **Windowed** (a fixed-size log-return buffer plus
 * running `sum` / `sumSq` and the recursive `prevPrice` needed to form
 * the next return). Resume with a different `period` carries the
 * return buffer forward; `source` change is refused. `annualFactor` is
 * a resume-invariant param.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for Historical Volatility. Params (`period`,
 * `annualFactor`, `source`) live in `meta.params` on the wire.
 */
export type HistoricalVolatilityState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  sumSq: number;
  prevPrice: number | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const HISTORICAL_VOLATILITY_VERSION = 1;

type HistoricalVolatilityParams = {
  period: number;
  annualFactor: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<HistoricalVolatilityState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<HistoricalVolatilityState>> {
  const { params, state, reconfigured } = resolveResume<
    HistoricalVolatilityParams,
    HistoricalVolatilityState
  >({
    indicator: "historicalVolatility",
    version: HISTORICAL_VOLATILITY_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, annualFactor: 252, source: "close" },
    resumeInvariantParams: ["annualFactor"],
  });

  const period = requireParam(
    "historicalVolatility",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const annualFactor = params.annualFactor;
  const source = params.source;

  let buffer: CircularBuffer<number>;
  let sum: number;
  let sumSq: number;
  let prevPrice: number | null;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the log-return buffer forward and
      // recompute the running sums against the new window.
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
      sum = 0;
      sumSq = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer.get(i);
        sum += v;
        sumSq += v * v;
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      sum = state.sum;
      sumSq = state.sumSq;
    }
    prevPrice = state.prevPrice;
    count = state.count;
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

  const indicator: IncrementalIndicator<
    number | null,
    IndicatorSnapshot<HistoricalVolatilityState>
  > = {
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

    getState(): IndicatorSnapshot<HistoricalVolatilityState> {
      return makeSnapshot(
        "historicalVolatility",
        HISTORICAL_VOLATILITY_VERSION,
        { period, annualFactor, source },
        { buffer: buffer.snapshot(), sum, sumSq, prevPrice, count },
      );
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
