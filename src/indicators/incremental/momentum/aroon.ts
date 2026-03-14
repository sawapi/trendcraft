/**
 * Incremental Aroon Indicator
 *
 * Aroon Up = ((period - bars since highest high) / period) × 100
 * Aroon Down = ((period - bars since lowest low) / period) × 100
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type AroonValue = {
  up: number | null;
  down: number | null;
  oscillator: number | null;
};

export type AroonState = {
  period: number;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Aroon indicator
 *
 * @example
 * ```ts
 * const aroon = createAroon({ period: 25 });
 * for (const candle of stream) {
 *   const { value } = aroon.next(candle);
 *   if (value.up !== null) console.log(value.up, value.down);
 * }
 * ```
 */
export function createAroon(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<AroonState>,
): IncrementalIndicator<AroonValue, AroonState> {
  const period = options.period ?? 25;

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    highBuffer = CircularBuffer.fromSnapshot(s.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(s.lowBuffer);
    count = s.count;
  } else {
    highBuffer = new CircularBuffer<number>(period + 1);
    lowBuffer = new CircularBuffer<number>(period + 1);
    count = 0;
  }

  function compute(hBuf: CircularBuffer<number>, lBuf: CircularBuffer<number>): AroonValue {
    if (hBuf.length < period + 1) {
      return { up: null, down: null, oscillator: null };
    }

    // Find index of highest high and lowest low (0=oldest, length-1=newest)
    let highestIdx = 0;
    let lowestIdx = 0;
    for (let i = 1; i < hBuf.length; i++) {
      if (hBuf.get(i) >= hBuf.get(highestIdx)) highestIdx = i;
      if (lBuf.get(i) <= lBuf.get(lowestIdx)) lowestIdx = i;
    }

    // bars since = distance from newest position
    const barsSinceHigh = hBuf.length - 1 - highestIdx;
    const barsSinceLow = lBuf.length - 1 - lowestIdx;

    const up = ((period - barsSinceHigh) / period) * 100;
    const down = ((period - barsSinceLow) / period) * 100;

    return { up, down, oscillator: up - down };
  }

  const indicator: IncrementalIndicator<AroonValue, AroonState> = {
    next(candle: NormalizedCandle) {
      count++;
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      return { time: candle.time, value: compute(highBuffer, lowBuffer) };
    },

    peek(candle: NormalizedCandle) {
      const peekH = CircularBuffer.fromSnapshot<number>(highBuffer.snapshot());
      const peekL = CircularBuffer.fromSnapshot<number>(lowBuffer.snapshot());
      peekH.push(candle.high);
      peekL.push(candle.low);
      return { time: candle.time, value: compute(peekH, peekL) };
    },

    getState(): AroonState {
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
      return count > period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
