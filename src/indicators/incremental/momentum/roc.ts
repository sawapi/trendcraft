/**
 * Incremental Rate of Change (ROC)
 *
 * ROC = ((Current Price - Price N periods ago) / Price N periods ago) × 100
 *
 * Uses CircularBuffer to store lookback prices.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

/**
 * State for incremental ROC
 */
export type RocState = {
  period: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Rate of Change indicator
 *
 * @example
 * ```ts
 * const rocInd = createRoc({ period: 12 });
 * for (const candle of stream) {
 *   const result = rocInd.next(candle);
 *   if (rocInd.isWarmedUp) console.log(result.value);
 * }
 * ```
 */
export function createRoc(
  options: { period: number; source?: PriceSource },
  warmUpOptions?: WarmUpOptions<RocState>,
): IncrementalIndicator<number | null, RocState> {
  const period = options.period;
  const source: PriceSource = options.source ?? "close";

  let buffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    count = s.count;
  } else {
    // Need period + 1 slots: period historical values + current
    buffer = new CircularBuffer<number>(period + 1);
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, RocState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      buffer.push(price);
      count++;

      if (count <= period) {
        return { time: candle.time, value: null };
      }

      // oldest() is the price from `period` candles ago
      const pastPrice = buffer.oldest();
      const value = pastPrice !== 0 ? ((price - pastPrice) / pastPrice) * 100 : 0;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const newCount = count + 1;

      if (newCount <= period) {
        return { time: candle.time, value: null };
      }

      // If buffer is full, oldest would shift; otherwise oldest stays the same
      let pastPrice: number;
      if (buffer.length === buffer.capacity) {
        // After push, the current oldest would be evicted, so pastPrice is buffer.get(1)
        pastPrice = buffer.get(1);
      } else {
        pastPrice = buffer.oldest();
      }

      const value = pastPrice !== 0 ? ((price - pastPrice) / pastPrice) * 100 : 0;
      return { time: candle.time, value };
    },

    getState(): RocState {
      return { period, source, buffer: buffer.snapshot(), count };
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
