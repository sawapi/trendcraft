/**
 * Incremental Commodity Channel Index (CCI)
 *
 * CCI = (Typical Price - SMA of TP) / (constant × Mean Deviation)
 * Typical Price = (High + Low + Close) / 3
 *
 * Uses CircularBuffer for the lookback window of typical prices.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

/**
 * State for incremental CCI
 */
export type CciState = {
  period: number;
  constant: number;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  count: number;
};

/**
 * Create an incremental Commodity Channel Index indicator
 *
 * @example
 * ```ts
 * const cciInd = createCci({ period: 20 });
 * for (const candle of stream) {
 *   const result = cciInd.next(candle);
 *   if (cciInd.isWarmedUp) console.log(result.value);
 * }
 * ```
 */
export function createCci(
  options: { period: number; constant?: number; source?: PriceSource },
  warmUpOptions?: WarmUpOptions<CciState>,
): IncrementalIndicator<number | null, CciState> {
  const period = options.period;
  const constant = options.constant ?? 0.015;
  const source = options.source ?? "hlc3";

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

  function computeCci(tp: number, buf: CircularBuffer<number>, currentSum: number): number | null {
    if (buf.length < period) return null;

    const smaTP = currentSum / period;

    // Calculate mean deviation
    let meanDev = 0;
    for (let i = 0; i < buf.length; i++) {
      meanDev += Math.abs(buf.get(i) - smaTP);
    }
    meanDev /= period;

    return meanDev !== 0 ? (tp - smaTP) / (constant * meanDev) : 0;
  }

  const indicator: IncrementalIndicator<number | null, CciState> = {
    next(candle: NormalizedCandle) {
      const tp = getSourcePrice(candle, source);

      if (buffer.isFull) {
        sum = sum - buffer.oldest() + tp;
      } else {
        sum += tp;
      }
      buffer.push(tp);
      count++;

      const value = computeCci(tp, buffer, sum);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const tp = getSourcePrice(candle, source);

      let newSum: number;
      if (buffer.isFull) {
        newSum = sum - buffer.oldest() + tp;
      } else {
        newSum = sum + tp;
      }

      // Create temporary buffer for mean deviation calculation
      const tempBuf = CircularBuffer.fromSnapshot(buffer.snapshot());
      tempBuf.push(tp);

      const value = computeCci(tp, tempBuf, newSum);
      return { time: candle.time, value };
    },

    getState(): CciState {
      return { period, constant, buffer: buffer.snapshot(), sum, count };
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
