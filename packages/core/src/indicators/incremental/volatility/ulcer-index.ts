/**
 * Incremental Ulcer Index
 *
 * Measures downside volatility by tracking drawdowns from the highest
 * price within the lookback period. Higher values indicate greater
 * downside risk.
 *
 * Formula:
 *   highest = max(prices in window)
 *   drawdown_i = ((price_i - highest) / highest) * 100
 *   UI = sqrt(mean(drawdown_i^2))
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type UlcerIndexState = {
  period: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Ulcer Index indicator
 *
 * @example
 * ```ts
 * const ui = createUlcerIndex({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = ui.next(candle);
 *   if (ui.isWarmedUp) console.log(`Ulcer Index: ${value?.toFixed(4)}`);
 * }
 * ```
 */
export function createUlcerIndex(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<UlcerIndexState>,
): IncrementalIndicator<number | null, UlcerIndexState> {
  const period = options.period ?? 14;
  const source: PriceSource = options.source ?? "close";

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

  function computeOutput(buf: CircularBuffer<number>, extraPrice?: number): number {
    // Find highest price in the window
    const len = buf.length;
    let highest = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < len; i++) {
      const p = buf.get(i);
      if (p > highest) highest = p;
    }
    if (extraPrice !== undefined && extraPrice > highest) {
      highest = extraPrice;
    }

    // Compute sum of squared drawdowns
    let sumSquared = 0;
    const n = extraPrice !== undefined ? len + 1 : len;
    for (let i = 0; i < len; i++) {
      const dd = highest !== 0 ? ((buf.get(i) - highest) / highest) * 100 : 0;
      sumSquared += dd * dd;
    }
    if (extraPrice !== undefined) {
      const dd = highest !== 0 ? ((extraPrice - highest) / highest) * 100 : 0;
      sumSquared += dd * dd;
    }

    return Math.sqrt(sumSquared / n);
  }

  const indicator: IncrementalIndicator<number | null, UlcerIndexState> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);
      buffer.push(price);

      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeOutput(buffer) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (buffer.isFull) {
        // Simulate the buffer after push: oldest drops, new price added
        // We need to compute over the window [1..len-1] + price
        const len = buffer.length;
        let highest = price;
        // Skip oldest (index 0), use indices 1..len-1 plus new price
        for (let i = 1; i < len; i++) {
          const p = buffer.get(i);
          if (p > highest) highest = p;
        }

        let sumSquared = 0;
        for (let i = 1; i < len; i++) {
          const dd = ((buffer.get(i) - highest) / highest) * 100;
          sumSquared += dd * dd;
        }
        const dd = ((price - highest) / highest) * 100;
        sumSquared += dd * dd;

        return { time: candle.time, value: Math.sqrt(sumSquared / period) };
      }

      // Buffer not full yet
      if (buffer.length + 1 < period) {
        return { time: candle.time, value: null };
      }

      // Buffer will become full with this price
      return { time: candle.time, value: computeOutput(buffer, price) };
    },

    getState(): UlcerIndexState {
      return {
        period,
        source,
        buffer: buffer.snapshot(),
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
