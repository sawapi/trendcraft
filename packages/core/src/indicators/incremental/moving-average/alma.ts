/**
 * Incremental ALMA (Arnaud Legoux Moving Average)
 *
 * Uses a Gaussian distribution to weight prices in a sliding window.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type AlmaState = {
  period: number;
  offset: number;
  sigma: number;
  source: PriceSource;
  weights: number[];
  buffer: { data: number[]; head: number; length: number; capacity: number };
  count: number;
};

/**
 * Create an incremental ALMA indicator
 *
 * @example
 * ```ts
 * const alma = createAlma({ period: 9, offset: 0.85, sigma: 6 });
 * for (const candle of stream) {
 *   const { value } = alma.next(candle);
 *   if (alma.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createAlma(
  options: { period?: number; offset?: number; sigma?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<AlmaState>,
): IncrementalIndicator<number | null, AlmaState> {
  const period = options.period ?? 9;
  const offset = options.offset ?? 0.85;
  const sigma = options.sigma ?? 6;
  const source: PriceSource = options.source ?? "close";

  // Pre-compute normalized Gaussian weights
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights: number[] = new Array(period);
  let weightSum = 0;

  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - m) * (i - m)) / (2 * s * s));
    weights[i] = w;
    weightSum += w;
  }
  for (let i = 0; i < period; i++) {
    weights[i] /= weightSum;
  }

  let buffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function computeAlma(): number {
    let value = 0;
    for (let i = 0; i < period; i++) {
      value += weights[i] * buffer.get(i);
    }
    return value;
  }

  const indicator: IncrementalIndicator<number | null, AlmaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      buffer.push(price);

      if (count < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeAlma() };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (count + 1 < period) {
        return { time: candle.time, value: null };
      }

      // Simulate buffer with new price appended
      let value = 0;
      const len = buffer.length;

      if (len < period) {
        // Buffer not yet full: existing items + new price
        for (let i = 0; i < len; i++) {
          // Shift by 1: weight[i] → buffer[i] but offset since buffer is shorter
          value += weights[i] * buffer.get(i);
        }
        value += weights[len] * price;
      } else {
        // Buffer full: oldest gets evicted, everything shifts left
        for (let i = 0; i < period - 1; i++) {
          value += weights[i] * buffer.get(i + 1);
        }
        value += weights[period - 1] * price;
      }

      return { time: candle.time, value };
    },

    getState(): AlmaState {
      return {
        period,
        offset,
        sigma,
        source,
        weights: [...weights],
        buffer: buffer.snapshot(),
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
