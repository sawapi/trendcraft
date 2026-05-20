/**
 * Incremental Fractals (Williams)
 *
 * Detects Williams fractal patterns: a bar whose high (or low) is the
 * extreme among 2*period+1 surrounding bars. Output is delayed by `period`
 * bars since right-side confirmation is required.
 *
 * State category: **Windowed** (a fixed-size `2*period+1` raw OHLC
 * window). Resuming with a different `period` carries the most-recent
 * window entries forward into a buffer sized at the new window.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type FractalValue = {
  upFractal: boolean;
  downFractal: boolean;
  upPrice: number | null;
  downPrice: number | null;
};

type FractalEntry = { high: number; low: number; time: number };

/**
 * Bare state shape for Fractals. The param (`period`) lives in
 * `meta.params` on the wire.
 */
export type FractalsState = {
  buffer: ReturnType<CircularBuffer<FractalEntry>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const FRACTALS_VERSION = 1;

type FractalsParams = {
  period: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<FractalsState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<FractalValue, IndicatorSnapshot<FractalsState>> {
  const { params, state, reconfigured } = resolveResume<FractalsParams, FractalsState>({
    indicator: "fractals",
    version: FRACTALS_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 2 },
  });

  const period = params.period;
  if (!Number.isInteger(period) || period < 1) {
    throw new Error('fractals: option "period" must be a positive integer');
  }
  const windowSize = 2 * period + 1;

  let buffer: CircularBuffer<FractalEntry>;
  let count: number;

  if (state !== null) {
    const old = CircularBuffer.fromSnapshot(state.buffer);
    if (reconfigured) {
      buffer = new CircularBuffer<FractalEntry>(windowSize);
      const carry = Math.min(old.length, windowSize);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = old;
    }
    count = state.count;
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

  const indicator: IncrementalIndicator<FractalValue, IndicatorSnapshot<FractalsState>> = {
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

    getState(): IndicatorSnapshot<FractalsState> {
      return makeSnapshot(
        "fractals",
        FRACTALS_VERSION,
        { period },
        {
          buffer: buffer.snapshot(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= windowSize;
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
