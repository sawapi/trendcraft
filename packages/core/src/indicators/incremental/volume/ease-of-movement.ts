/**
 * Incremental EMV (Ease of Movement)
 *
 * EMV = ((H+L)/2 - prev(H+L)/2) / ((Volume / divisor) / (H - L))
 * Smoothed with SMA over `period` bars. Windows containing any null
 * raw EMV values produce null output (matching batch behavior).
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type EmvState = {
  prevHigh: number | null;
  prevLow: number | null;
  /** Circular buffer of raw EMV values; NaN marks null slots */
  buffer: { data: number[]; head: number; length: number; capacity: number };
  sum: number;
  period: number;
  volumeDivisor: number;
  count: number;
};

/**
 * Create an incremental Ease of Movement indicator
 *
 * @example
 * ```ts
 * const emv = createEmv({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = emv.next(candle);
 *   if (emv.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createEmv(
  options: { period?: number; volumeDivisor?: number } = {},
  warmUpOptions?: WarmUpOptions<EmvState>,
): IncrementalIndicator<number | null, EmvState> {
  const period = options.period ?? 14;
  const volumeDivisor = options.volumeDivisor ?? 10000;

  let prevHigh: number | null;
  let prevLow: number | null;
  let buffer: CircularBuffer<number>;
  let sum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevHigh = s.prevHigh;
    prevLow = s.prevLow;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    sum = s.sum;
    count = s.count;
  } else {
    prevHigh = null;
    prevLow = null;
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    count = 0;
  }

  function computeRawEmv(candle: NormalizedCandle): number | null {
    if (prevHigh === null || prevLow === null) return null;

    const hl = candle.high - candle.low;
    if (hl === 0 || candle.volume === 0) return null;

    const distanceMoved = (candle.high + candle.low) / 2 - (prevHigh + prevLow) / 2;
    const boxRatio = candle.volume / volumeDivisor / hl;
    return distanceMoved / boxRatio;
  }

  function hasNaN(buf: CircularBuffer<number>): boolean {
    for (let i = 0; i < buf.length; i++) {
      if (Number.isNaN(buf.get(i))) return true;
    }
    return false;
  }

  function computeOutput(): number | null {
    if (buffer.length < period) return null;
    if (hasNaN(buffer)) return null;
    return sum / period;
  }

  const indicator: IncrementalIndicator<number | null, EmvState> = {
    next(candle: NormalizedCandle) {
      count++;
      const raw = computeRawEmv(candle);
      prevHigh = candle.high;
      prevLow = candle.low;

      // Use NaN as sentinel for null raw values
      const val = raw ?? Number.NaN;

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        if (!Number.isNaN(oldest)) sum -= oldest;
      }
      if (!Number.isNaN(val)) sum += val;
      buffer.push(val);

      return { time: candle.time, value: computeOutput() };
    },

    peek(candle: NormalizedCandle) {
      const raw = computeRawEmv(candle);
      const val = raw ?? Number.NaN;

      if (buffer.length + 1 < period && !buffer.isFull) {
        return { time: candle.time, value: null };
      }

      // Simulate buffer after push
      let peekSum = sum;
      let peekHasNaN = false;

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        if (!Number.isNaN(oldest)) peekSum -= oldest;
      }
      if (!Number.isNaN(val)) {
        peekSum += val;
      } else {
        peekHasNaN = true;
      }

      // Check existing buffer (skip oldest if full)
      const start = buffer.isFull ? 1 : 0;
      if (!peekHasNaN) {
        for (let i = start; i < buffer.length; i++) {
          if (Number.isNaN(buffer.get(i))) {
            peekHasNaN = true;
            break;
          }
        }
      }

      const peekLen = buffer.isFull ? buffer.length : buffer.length + 1;
      if (peekLen < period || peekHasNaN) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: peekSum / period };
    },

    getState(): EmvState {
      return {
        prevHigh,
        prevLow,
        buffer: buffer.snapshot(),
        sum,
        period,
        volumeDivisor,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= period && !hasNaN(buffer);
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
