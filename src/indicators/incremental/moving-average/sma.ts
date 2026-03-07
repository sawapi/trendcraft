/**
 * Incremental SMA (Simple Moving Average)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type SmaState = {
  period: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  count: number;
};

function getSourcePrice(candle: NormalizedCandle, source: PriceSource): number {
  switch (source) {
    case "open":
      return candle.open;
    case "high":
      return candle.high;
    case "low":
      return candle.low;
    case "close":
      return candle.close;
    case "hl2":
      return (candle.high + candle.low) / 2;
    case "hlc3":
      return (candle.high + candle.low + candle.close) / 3;
    case "ohlc4":
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    case "volume":
      return candle.volume;
    default:
      return candle.close;
  }
}

/**
 * Create an incremental SMA indicator
 *
 * @example
 * ```ts
 * const sma20 = createSma({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = sma20.next(candle);
 *   if (sma20.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createSma(
  options: { period: number; source?: PriceSource },
  warmUpOptions?: WarmUpOptions<SmaState>,
): IncrementalIndicator<number | null, SmaState> {
  const period = options.period;
  const source: PriceSource = options.source ?? "close";

  let buffer: CircularBuffer<number>;
  let sum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    sum = s.sum;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    count = 0;
  }

  function compute(candle: NormalizedCandle): { time: number; value: number | null } {
    const price = getSourcePrice(candle, source);
    let newSum = sum;
    const newCount = count + 1;

    if (buffer.isFull) {
      newSum = newSum - buffer.oldest() + price;
    } else {
      newSum = newSum + price;
    }

    const value = newCount >= period ? newSum / period : null;
    return { time: candle.time, value };
  }

  const indicator: IncrementalIndicator<number | null, SmaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (buffer.isFull) {
        sum = sum - buffer.oldest() + price;
      } else {
        sum += price;
      }

      buffer.push(price);
      count++;

      const value = count >= period ? sum / period : null;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      return compute(candle);
    },

    getState(): SmaState {
      return {
        period,
        source,
        buffer: buffer.snapshot(),
        sum,
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

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
