/**
 * Incremental Swing Points
 *
 * Identifies swing highs/lows using a 2-sided window: a bar at position t is a
 * swing high iff its high is strictly greater than all highs within `leftBars`
 * to its left and all highs within `rightBars` to its right (swing low is
 * symmetric on lows). Confirmation is delayed by `rightBars` bars.
 *
 * Output time = the swing candidate bar's own time (not the streaming candle's
 * time), following the same convention as `createFractals`. During the warm-up
 * window the output time falls back to the streaming candle's time with all
 * fields nulled.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type SwingPointValue = {
  isSwingHigh: boolean;
  isSwingLow: boolean;
  swingHighPrice: number | null;
  swingLowPrice: number | null;
  /** Bars between the emitted bar and the most recent swing high (0 if the emitted bar IS the swing) */
  swingHighIndex: number | null;
  /** Bars between the emitted bar and the most recent swing low */
  swingLowIndex: number | null;
};

type WindowEntry = { high: number; low: number; time: number; index: number };

export type SwingPointsState = {
  leftBars: number;
  rightBars: number;
  buffer: ReturnType<CircularBuffer<WindowEntry>["snapshot"]>;
  /** Index of the last confirmed swing high (absolute bar index, 0-based) */
  lastSwingHighIdx: number | null;
  lastSwingHighPrice: number | null;
  lastSwingLowIdx: number | null;
  lastSwingLowPrice: number | null;
  count: number;
};

const nullValue: SwingPointValue = {
  isSwingHigh: false,
  isSwingLow: false,
  swingHighPrice: null,
  swingLowPrice: null,
  swingHighIndex: null,
  swingLowIndex: null,
};

/**
 * Create an incremental Swing Points indicator.
 *
 * Emission is delayed by `rightBars` bars: `next(candle_t)` confirms whether
 * `candle_{t-rightBars}` is a swing point. For the first `leftBars + rightBars`
 * calls, the returned value is fully null.
 *
 * @example
 * ```ts
 * const swings = createSwingPoints({ leftBars: 5, rightBars: 5 });
 * for (const candle of stream) {
 *   const { time, value } = swings.next(candle);
 *   if (value.isSwingHigh) console.log(`Swing high confirmed at ${time}`);
 * }
 * ```
 */
export function createSwingPoints(
  options: { leftBars?: number; rightBars?: number } = {},
  warmUpOptions?: WarmUpOptions<SwingPointsState>,
): IncrementalIndicator<SwingPointValue, SwingPointsState> {
  const leftBars = options.leftBars ?? 5;
  const rightBars = options.rightBars ?? 5;

  if (leftBars < 1) throw new Error("leftBars must be at least 1");
  if (rightBars < 1) throw new Error("rightBars must be at least 1");

  const windowSize = leftBars + 1 + rightBars;

  let buffer: CircularBuffer<WindowEntry>;
  let lastSwingHighIdx: number | null;
  let lastSwingHighPrice: number | null;
  let lastSwingLowIdx: number | null;
  let lastSwingLowPrice: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    lastSwingHighIdx = s.lastSwingHighIdx;
    lastSwingHighPrice = s.lastSwingHighPrice;
    lastSwingLowIdx = s.lastSwingLowIdx;
    lastSwingLowPrice = s.lastSwingLowPrice;
    count = s.count;
  } else {
    buffer = new CircularBuffer<WindowEntry>(windowSize);
    lastSwingHighIdx = null;
    lastSwingHighPrice = null;
    lastSwingLowIdx = null;
    lastSwingLowPrice = null;
    count = 0;
  }

  /**
   * Evaluate the middle entry of `buf` (at offset `leftBars`) against the
   * left/right neighbors. Uses strict inequality (>=) for rejection, matching
   * the batch implementation.
   */
  function evaluateMid(buf: CircularBuffer<WindowEntry>): {
    isHigh: boolean;
    isLow: boolean;
    mid: WindowEntry;
  } {
    const mid = buf.get(leftBars);
    let isHigh = true;
    let isLow = true;
    for (let i = 0; i < windowSize; i++) {
      if (i === leftBars) continue;
      const e = buf.get(i);
      if (e.high >= mid.high) isHigh = false;
      if (e.low <= mid.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    return { isHigh, isLow, mid };
  }

  const indicator: IncrementalIndicator<SwingPointValue, SwingPointsState> = {
    next(candle: NormalizedCandle) {
      buffer.push({
        high: candle.high,
        low: candle.low,
        time: candle.time,
        index: count,
      });
      count++;

      if (buffer.length < windowSize) {
        return { time: candle.time, value: { ...nullValue } };
      }

      const { isHigh, isLow, mid } = evaluateMid(buffer);
      if (isHigh) {
        lastSwingHighIdx = mid.index;
        lastSwingHighPrice = mid.high;
      }
      if (isLow) {
        lastSwingLowIdx = mid.index;
        lastSwingLowPrice = mid.low;
      }

      return {
        time: mid.time,
        value: {
          isSwingHigh: isHigh,
          isSwingLow: isLow,
          swingHighPrice: lastSwingHighPrice,
          swingLowPrice: lastSwingLowPrice,
          swingHighIndex: lastSwingHighIdx !== null ? mid.index - lastSwingHighIdx : null,
          swingLowIndex: lastSwingLowIdx !== null ? mid.index - lastSwingLowIdx : null,
        },
      };
    },

    peek(candle: NormalizedCandle) {
      // Simulate the buffer state after push without mutating.
      const needed = windowSize - 1;
      if (buffer.length < needed) {
        return { time: candle.time, value: { ...nullValue } };
      }
      // Build a temporary window from the last (windowSize - 1) entries of
      // `buffer` plus the incoming candle.
      const temp: WindowEntry[] = [];
      const startIdx = buffer.length >= windowSize ? 1 : 0;
      for (let i = startIdx; i < buffer.length; i++) temp.push(buffer.get(i));
      temp.push({ high: candle.high, low: candle.low, time: candle.time, index: count });

      const mid = temp[leftBars];
      let isHigh = true;
      let isLow = true;
      for (let i = 0; i < windowSize; i++) {
        if (i === leftBars) continue;
        const e = temp[i];
        if (e.high >= mid.high) isHigh = false;
        if (e.low <= mid.low) isLow = false;
        if (!isHigh && !isLow) break;
      }

      // Compute would-be trailing state without committing.
      const peekHighIdx = isHigh ? mid.index : lastSwingHighIdx;
      const peekHighPrice = isHigh ? mid.high : lastSwingHighPrice;
      const peekLowIdx = isLow ? mid.index : lastSwingLowIdx;
      const peekLowPrice = isLow ? mid.low : lastSwingLowPrice;

      return {
        time: mid.time,
        value: {
          isSwingHigh: isHigh,
          isSwingLow: isLow,
          swingHighPrice: peekHighPrice,
          swingLowPrice: peekLowPrice,
          swingHighIndex: peekHighIdx !== null ? mid.index - peekHighIdx : null,
          swingLowIndex: peekLowIdx !== null ? mid.index - peekLowIdx : null,
        },
      };
    },

    getState(): SwingPointsState {
      return {
        leftBars,
        rightBars,
        buffer: buffer.snapshot(),
        lastSwingHighIdx,
        lastSwingHighPrice,
        lastSwingLowIdx,
        lastSwingLowPrice,
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

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
