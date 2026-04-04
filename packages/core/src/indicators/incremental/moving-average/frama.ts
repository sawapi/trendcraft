/**
 * Incremental FRAMA (Fractal Adaptive Moving Average)
 *
 * Dynamically adjusts smoothing alpha based on fractal dimension:
 * 1. Split period into two halves, compute high-low ranges
 * 2. Fractal dimension D = (log(n1 + n2) - log(n3)) / log(2)
 * 3. alpha = exp(-4.6 * (D - 1)), clamped to [0.01, 1]
 * 4. FRAMA = alpha * price + (1 - alpha) * prevFRAMA
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type FramaState = {
  period: number;
  effectivePeriod: number;
  halfPeriod: number;
  source: PriceSource;
  prevFrama: number | null;
  buffer: { data: number[]; head: number; length: number; capacity: number };
  count: number;
};

/**
 * Create an incremental FRAMA indicator
 *
 * @example
 * ```ts
 * const frama = createFrama({ period: 16 });
 * for (const candle of stream) {
 *   const { value } = frama.next(candle);
 *   if (frama.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createFrama(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<FramaState>,
): IncrementalIndicator<number | null, FramaState> {
  const period = options.period ?? 16;
  const source: PriceSource = options.source ?? "close";
  const effectivePeriod = period % 2 === 0 ? period : period + 1;
  const halfPeriod = effectivePeriod / 2;

  let buffer: CircularBuffer<number>;
  let prevFrama: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    prevFrama = s.prevFrama;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(effectivePeriod);
    prevFrama = null;
    count = 0;
  }

  function computeFromBuffer(price: number): number {
    // Calculate high/low ranges for first half, second half, and full period
    let h1High = Number.NEGATIVE_INFINITY;
    let h1Low = Number.POSITIVE_INFINITY;
    let h2High = Number.NEGATIVE_INFINITY;
    let h2Low = Number.POSITIVE_INFINITY;
    let fHigh = Number.NEGATIVE_INFINITY;
    let fLow = Number.POSITIVE_INFINITY;

    for (let j = 0; j < effectivePeriod; j++) {
      const p = buffer.get(j);

      if (j < halfPeriod) {
        h1High = Math.max(h1High, p);
        h1Low = Math.min(h1Low, p);
      } else {
        h2High = Math.max(h2High, p);
        h2Low = Math.min(h2Low, p);
      }

      fHigh = Math.max(fHigh, p);
      fLow = Math.min(fLow, p);
    }

    const n1 = (h1High - h1Low) / halfPeriod;
    const n2 = (h2High - h2Low) / halfPeriod;
    const n3 = (fHigh - fLow) / effectivePeriod;

    let alpha: number;
    if (n1 > 0 && n2 > 0 && n3 > 0) {
      const d = (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2);
      alpha = Math.exp(-4.6 * (d - 1));
      alpha = Math.max(0.01, Math.min(1, alpha));
    } else {
      alpha = 0.01;
    }

    return alpha * price + (1 - alpha) * (prevFrama ?? price);
  }

  const indicator: IncrementalIndicator<number | null, FramaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      buffer.push(price);

      if (count < effectivePeriod) {
        return { time: candle.time, value: null };
      }

      if (prevFrama === null) {
        // Seed with current price
        prevFrama = price;
        return { time: candle.time, value: prevFrama };
      }

      prevFrama = computeFromBuffer(price);
      return { time: candle.time, value: prevFrama };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (count + 1 < effectivePeriod) {
        return { time: candle.time, value: null };
      }

      if (prevFrama === null) {
        // Would be the seed bar
        return { time: candle.time, value: price };
      }

      // Simulate buffer with new price
      // Build temporary array representing buffer state after push
      let h1High = Number.NEGATIVE_INFINITY;
      let h1Low = Number.POSITIVE_INFINITY;
      let h2High = Number.NEGATIVE_INFINITY;
      let h2Low = Number.POSITIVE_INFINITY;
      let fHigh = Number.NEGATIVE_INFINITY;
      let fLow = Number.POSITIVE_INFINITY;

      // After push, buffer would be: [buffer.get(1), ..., buffer.get(ep-1), price]
      for (let j = 0; j < effectivePeriod; j++) {
        const p = j < effectivePeriod - 1 ? buffer.get(j + 1) : price;

        if (j < halfPeriod) {
          h1High = Math.max(h1High, p);
          h1Low = Math.min(h1Low, p);
        } else {
          h2High = Math.max(h2High, p);
          h2Low = Math.min(h2Low, p);
        }

        fHigh = Math.max(fHigh, p);
        fLow = Math.min(fLow, p);
      }

      const n1 = (h1High - h1Low) / halfPeriod;
      const n2 = (h2High - h2Low) / halfPeriod;
      const n3 = (fHigh - fLow) / effectivePeriod;

      let alpha: number;
      if (n1 > 0 && n2 > 0 && n3 > 0) {
        const d = (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2);
        alpha = Math.exp(-4.6 * (d - 1));
        alpha = Math.max(0.01, Math.min(1, alpha));
      } else {
        alpha = 0.01;
      }

      return { time: candle.time, value: alpha * price + (1 - alpha) * prevFrama };
    },

    getState(): FramaState {
      return {
        period,
        effectivePeriod,
        halfPeriod,
        source,
        prevFrama,
        buffer: buffer.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return prevFrama !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
