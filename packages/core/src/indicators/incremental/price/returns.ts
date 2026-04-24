/**
 * Incremental Returns
 *
 * n-period simple or log returns of close prices.
 * Holds the last `period` close values in a CircularBuffer.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type ReturnsState = {
  period: number;
  type: "simple" | "log";
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Returns indicator.
 *
 * `period` >= 1 controls the lookback distance used to compute the return; the
 * output is `null` until at least `period + 1` candles have been seen.
 *
 * @example
 * ```ts
 * const r = createReturns({ period: 1, type: "log" });
 * for (const candle of stream) {
 *   const { value } = r.next(candle);
 *   if (value !== null) console.log(value);
 * }
 * ```
 */
export function createReturns(
  options: { period?: number; type?: "simple" | "log" } = {},
  warmUpOptions?: WarmUpOptions<ReturnsState>,
): IncrementalIndicator<number | null, ReturnsState> {
  const period = options.period ?? 1;
  const type: "simple" | "log" = options.type ?? "simple";

  if (period < 1) {
    throw new Error("Returns period must be at least 1");
  }

  // Buffer holds the last `period` closes (i.e. closes at index t-period..t-1);
  // when a new close arrives, the oldest slot is the reference price.
  let buffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    buffer = CircularBuffer.fromSnapshot(warmUpOptions.fromState.buffer);
    count = warmUpOptions.fromState.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function calc(current: number, prev: number): number | null {
    if (prev === 0) return null;
    return type === "log" ? Math.log(current / prev) : (current - prev) / prev;
  }

  const indicator: IncrementalIndicator<number | null, ReturnsState> = {
    next(candle: NormalizedCandle) {
      const current = candle.close;
      let value: number | null = null;
      if (buffer.isFull) {
        const prev = buffer.oldest();
        value = calc(current, prev);
      }
      buffer.push(current);
      count++;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      if (!buffer.isFull) return { time: candle.time, value: null };
      return { time: candle.time, value: calc(candle.close, buffer.oldest()) };
    },

    getState(): ReturnsState {
      return { period, type, buffer: buffer.snapshot(), count };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.isFull;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
