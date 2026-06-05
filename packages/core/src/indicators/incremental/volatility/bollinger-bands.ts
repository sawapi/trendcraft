/**
 * Incremental Bollinger Bands
 *
 * Uses population variance (/N, not /(N-1)) for TA-Lib compatibility.
 *
 * State category: **Windowed** (a fixed-size price buffer plus running
 * `sum` / `sumSquares`). Resume with a different `period` carries the
 * raw price buffer forward and recomputes the running sums; `source`
 * change is refused. `stdDev` is a resume-invariant param — it only
 * scales the band width, never the buffer or sums.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { BollingerBandsValue, NormalizedCandle, PriceSource } from "../../../types";
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
 * Bare state shape for Bollinger Bands. Params (`period`, `stdDev`,
 * `source`) live in `meta.params` on the wire.
 */
export type BollingerBandsState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  sumSquares: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const BOLLINGER_BANDS_VERSION = 1;

type BollingerBandsParams = {
  period: number;
  stdDev: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<BollingerBandsState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<BollingerBandsValue, IndicatorSnapshot<BollingerBandsState>> {
  const { params, state, reconfigured } = resolveResume<BollingerBandsParams, BollingerBandsState>({
    indicator: "bollingerBands",
    version: BOLLINGER_BANDS_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, stdDev: 2, source: "close" },
    resumeInvariantParams: ["stdDev"],
  });

  const period = requireParam(
    "bollingerBands",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const stdDevMult = params.stdDev;
  const source = params.source;

  let buffer: CircularBuffer<number>;
  let sum: number;
  let sumSquares: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the raw prices forward and recompute the
      // running sums against the new window.
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
      sum = 0;
      sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer.get(i);
        sum += v;
        sumSquares += v * v;
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      sum = state.sum;
      sumSquares = state.sumSquares;
    }
    count = state.count;
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

  const indicator: IncrementalIndicator<
    BollingerBandsValue,
    IndicatorSnapshot<BollingerBandsState>
  > = {
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

      if (buffer.length < period) {
        return { time: candle.time, value: nullValue };
      }

      return { time: candle.time, value: computeBands(sum, sumSquares, price) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (buffer.length < period - 1) {
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

    getState(): IndicatorSnapshot<BollingerBandsState> {
      return makeSnapshot(
        "bollingerBands",
        BOLLINGER_BANDS_VERSION,
        { period, stdDev: stdDevMult, source },
        { buffer: buffer.snapshot(), sum, sumSquares, count },
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
