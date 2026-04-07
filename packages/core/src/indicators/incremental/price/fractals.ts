/**
 * Incremental Fractals (Williams)
 *
 * Detects Williams fractal patterns: a bar whose high (or low) is the
 * extreme among 2*period+1 surrounding bars. Output is delayed by `period`
 * bars since right-side confirmation is required.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type FractalValue = {
  upFractal: boolean;
  downFractal: boolean;
  upPrice: number | null;
  downPrice: number | null;
};

type FractalEntry = { high: number; low: number; time: number };

export type FractalsState = {
  period: number;
  buffer: ReturnType<CircularBuffer<FractalEntry>["snapshot"]>;
  count: number;
};

const nullValue: FractalValue = {
  upFractal: false,
  downFractal: false,
  upPrice: null,
  downPrice: null,
};

/**
 * Create an incremental Fractals indicator (Williams)
 *
 * Identifies bars that are local highs/lows within a 2*period+1 window.
 * Output is delayed by `period` bars to allow right-side confirmation.
 *
 * @example
 * ```ts
 * const fractals = createFractals({ period: 2 });
 * for (const candle of stream) {
 *   const { time, value } = fractals.next(candle);
 *   if (value.upFractal) console.log(`Up fractal at ${time}: ${value.upPrice}`);
 *   if (value.downFractal) console.log(`Down fractal at ${time}: ${value.downPrice}`);
 * }
 * ```
 */
export function createFractals(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<FractalsState>,
): IncrementalIndicator<FractalValue, FractalsState> {
  const period = options.period ?? 2;
  const windowSize = 2 * period + 1;

  let buffer: CircularBuffer<FractalEntry>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    count = s.count;
  } else {
    buffer = new CircularBuffer<FractalEntry>(windowSize);
    count = 0;
  }

  function checkFractal(buf: CircularBuffer<FractalEntry>): FractalValue {
    if (buf.length < windowSize) return nullValue;

    const mid = period; // middle index in the window
    const midEntry = buf.get(mid);
    let isUp = true;
    let isDown = true;

    for (let i = 0; i < windowSize; i++) {
      if (i === mid) continue;
      const entry = buf.get(i);
      if (entry.high >= midEntry.high) isUp = false;
      if (entry.low <= midEntry.low) isDown = false;
      if (!isUp && !isDown) break;
    }

    return {
      upFractal: isUp,
      downFractal: isDown,
      upPrice: isUp ? midEntry.high : null,
      downPrice: isDown ? midEntry.low : null,
    };
  }

  const indicator: IncrementalIndicator<FractalValue, FractalsState> = {
    next(candle: NormalizedCandle) {
      buffer.push({ high: candle.high, low: candle.low, time: candle.time });
      count++;

      if (buffer.length < windowSize) {
        return { time: candle.time, value: nullValue };
      }

      const result = checkFractal(buffer);
      // Output time is the middle bar's time (delayed)
      const midTime = buffer.get(period).time;
      return { time: midTime, value: result };
    },

    peek(candle: NormalizedCandle) {
      if (buffer.length < windowSize - 1) {
        return { time: candle.time, value: nullValue };
      }

      // Create a temporary view by simulating the push
      // We need to check what the buffer would look like with the new candle
      const tempEntries: FractalEntry[] = [];
      const startIdx = buffer.length >= windowSize ? 1 : 0;
      for (let i = startIdx; i < buffer.length; i++) {
        tempEntries.push(buffer.get(i));
      }
      tempEntries.push({ high: candle.high, low: candle.low, time: candle.time });

      if (tempEntries.length < windowSize) {
        return { time: candle.time, value: nullValue };
      }

      const mid = period;
      const midEntry = tempEntries[mid];
      let isUp = true;
      let isDown = true;

      for (let i = 0; i < windowSize; i++) {
        if (i === mid) continue;
        if (tempEntries[i].high >= midEntry.high) isUp = false;
        if (tempEntries[i].low <= midEntry.low) isDown = false;
        if (!isUp && !isDown) break;
      }

      return {
        time: midEntry.time,
        value: {
          upFractal: isUp,
          downFractal: isDown,
          upPrice: isUp ? midEntry.high : null,
          downPrice: isDown ? midEntry.low : null,
        },
      };
    },

    getState(): FractalsState {
      return {
        period,
        buffer: buffer.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= windowSize;
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
