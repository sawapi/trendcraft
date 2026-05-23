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
 *
 * State category: **Mixed** (a fixed-size `leftBars + 1 + rightBars`
 * raw OHLC window plus persistent last-swing trackers conditioned on
 * the window the swing was confirmed under). A `leftBars` / `rightBars`
 * change resizes the scan window and re-times confirmation, which would
 * re-emit pre-snapshot swings from the carried buffer — so any param
 * change on resume is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

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

/**
 * Bare state shape for Swing Points. Params (`leftBars`, `rightBars`)
 * live in `meta.params` on the wire.
 */
export type SwingPointsState = {
  buffer: ReturnType<CircularBuffer<WindowEntry>["snapshot"]>;
  /** Index of the last confirmed swing high (absolute bar index, 0-based) */
  lastSwingHighIdx: number | null;
  lastSwingHighPrice: number | null;
  lastSwingLowIdx: number | null;
  lastSwingLowPrice: number | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const SWING_POINTS_VERSION = 1;

type SwingPointsParams = {
  leftBars: number;
  rightBars: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<SwingPointsState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<SwingPointValue, IndicatorSnapshot<SwingPointsState>> {
  const { params, state, reconfigured } = resolveResume<SwingPointsParams, SwingPointsState>({
    indicator: "swingPoints",
    version: SWING_POINTS_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { leftBars: 5, rightBars: 5 },
  });

  const leftBars = params.leftBars;
  const rightBars = params.rightBars;
  if (leftBars < 1) throw new Error("leftBars must be at least 1");
  if (rightBars < 1) throw new Error("rightBars must be at least 1");

  const windowSize = leftBars + 1 + rightBars;

  let buffer: CircularBuffer<WindowEntry>;
  let lastSwingHighIdx: number | null;
  let lastSwingHighPrice: number | null;
  let lastSwingLowIdx: number | null;
  let lastSwingLowPrice: number | null;
  let count: number;

  if (state !== null) {
    const old = CircularBuffer.fromSnapshot(state.buffer);
    if (reconfigured) {
      // leftBars / rightBars changed — carry the most-recent window
      // entries into a buffer sized at the new window.
      buffer = new CircularBuffer<WindowEntry>(windowSize);
      const carry = Math.min(old.length, windowSize);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = old;
    }
    lastSwingHighIdx = state.lastSwingHighIdx;
    lastSwingHighPrice = state.lastSwingHighPrice;
    lastSwingLowIdx = state.lastSwingLowIdx;
    lastSwingLowPrice = state.lastSwingLowPrice;
    count = state.count;
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

  const indicator: IncrementalIndicator<SwingPointValue, IndicatorSnapshot<SwingPointsState>> = {
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

    getState(): IndicatorSnapshot<SwingPointsState> {
      return makeSnapshot(
        "swingPoints",
        SWING_POINTS_VERSION,
        { leftBars, rightBars },
        {
          buffer: buffer.snapshot(),
          lastSwingHighIdx,
          lastSwingHighPrice,
          lastSwingLowIdx,
          lastSwingLowPrice,
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

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
