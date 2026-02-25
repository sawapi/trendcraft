/**
 * Incremental Williams %R
 *
 * Williams %R = (Highest High - Close) / (Highest High - Lowest Low) × -100
 *
 * Uses CircularBuffer for high/low lookback windows.
 * Range: -100 to 0.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

/**
 * State for incremental Williams %R
 */
export type WilliamsRState = {
  period: number;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Find max value in a CircularBuffer by linear scan
 */
function bufferMax(buf: CircularBuffer<number>): number {
  let max = buf.get(0);
  for (let i = 1; i < buf.length; i++) {
    const v = buf.get(i);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Find min value in a CircularBuffer by linear scan
 */
function bufferMin(buf: CircularBuffer<number>): number {
  let min = buf.get(0);
  for (let i = 1; i < buf.length; i++) {
    const v = buf.get(i);
    if (v < min) min = v;
  }
  return min;
}

/**
 * Create an incremental Williams %R indicator
 *
 * @example
 * ```ts
 * const willR = createWilliamsR({ period: 14 });
 * for (const candle of stream) {
 *   const result = willR.next(candle);
 *   if (willR.isWarmedUp) console.log(result.value);
 * }
 * ```
 */
export function createWilliamsR(
  options: { period: number },
  warmUpOptions?: WarmUpOptions<WilliamsRState>,
): IncrementalIndicator<number | null, WilliamsRState> {
  const period = options.period;

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    highBuffer = CircularBuffer.fromSnapshot(s.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(s.lowBuffer);
    count = s.count;
  } else {
    highBuffer = new CircularBuffer<number>(period);
    lowBuffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function compute(
    high: number,
    low: number,
    close: number,
    hBuf: CircularBuffer<number>,
    lBuf: CircularBuffer<number>,
    n: number,
  ): number | null {
    if (n < period) return null;
    const highestHigh = bufferMax(hBuf);
    const lowestLow = bufferMin(lBuf);
    const range = highestHigh - lowestLow;
    return range !== 0 ? ((highestHigh - close) / range) * -100 : -50;
  }

  const indicator: IncrementalIndicator<number | null, WilliamsRState> = {
    next(candle: NormalizedCandle) {
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      count++;

      const value = compute(candle.high, candle.low, candle.close, highBuffer, lowBuffer, count);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Create temporary snapshots to compute without mutation
      const tempHigh = CircularBuffer.fromSnapshot(highBuffer.snapshot());
      const tempLow = CircularBuffer.fromSnapshot(lowBuffer.snapshot());
      tempHigh.push(candle.high);
      tempLow.push(candle.low);

      const value = compute(
        candle.high,
        candle.low,
        candle.close,
        tempHigh,
        tempLow,
        count + 1,
      );
      return { time: candle.time, value };
    },

    getState(): WilliamsRState {
      return {
        period,
        highBuffer: highBuffer.snapshot(),
        lowBuffer: lowBuffer.snapshot(),
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
