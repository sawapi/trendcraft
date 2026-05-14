/**
 * Incremental Highest/Lowest
 *
 * State category: **Windowed** (raw high / low buffers).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<HighestLowestState>` and `fromState` accepts the same.
 *
 * Rolling maximum of highs and minimum of lows over a configurable period.
 * Uses CircularBuffer with O(n) scan per update (period is typically small).
 *
 * Defaults: `period` defaults to `20` (matching the live-presets
 * convention and TradingView's `ta.highest` / `ta.lowest` typical usage).
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type HighestLowestValue = {
  highest: number | null;
  lowest: number | null;
};

/**
 * Bare state shape for Highest/Lowest. Params (`period`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type HighestLowestState = {
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const HIGHEST_LOWEST_VERSION = 1;

type HighestLowestParams = {
  period: number;
};

/**
 * Create an incremental Highest/Lowest indicator
 *
 * Tracks the rolling maximum high and minimum low over a sliding window.
 *
 * @example
 * ```ts
 * const hl = createHighestLowest({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = hl.next(candle);
 *   if (hl.isWarmedUp) {
 *     console.log(`High: ${value.highest}, Low: ${value.lowest}`);
 *   }
 * }
 * ```
 */
export function createHighestLowest(
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<HighestLowestState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<HighestLowestValue, IndicatorSnapshot<HighestLowestState>> {
  const { params, state, reconfigured } = resolveResume<HighestLowestParams, HighestLowestState>({
    indicator: "highestLowest",
    version: HIGHEST_LOWEST_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20 },
  });

  const period = params.period;
  if (!Number.isInteger(period) || period < 1) {
    throw new Error('highestLowest: option "period" must be a positive integer');
  }

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. Buffers are raw high / low values — no
      // per-period derivation, so we carry forward the most recent
      // min(snapshot.length, newPeriod) samples into buffers sized
      // at the new period.
      const oldHigh = CircularBuffer.fromSnapshot(state.highBuffer);
      const oldLow = CircularBuffer.fromSnapshot(state.lowBuffer);
      highBuffer = new CircularBuffer<number>(period);
      lowBuffer = new CircularBuffer<number>(period);
      const available = oldHigh.length;
      const carryStart = Math.max(0, available - period);
      for (let i = carryStart; i < available; i++) {
        highBuffer.push(oldHigh.get(i));
        lowBuffer.push(oldLow.get(i));
      }
      count = state.count;
    } else {
      highBuffer = CircularBuffer.fromSnapshot(state.highBuffer);
      lowBuffer = CircularBuffer.fromSnapshot(state.lowBuffer);
      count = state.count;
    }
  } else {
    highBuffer = new CircularBuffer<number>(period);
    lowBuffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function scanMaxMin(
    hBuf: CircularBuffer<number>,
    lBuf: CircularBuffer<number>,
  ): HighestLowestValue {
    let highest = Number.NEGATIVE_INFINITY;
    let lowest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < hBuf.length; i++) {
      const h = hBuf.get(i);
      const l = lBuf.get(i);
      if (h > highest) highest = h;
      if (l < lowest) lowest = l;
    }
    return { highest, lowest };
  }

  const nullValue: HighestLowestValue = { highest: null, lowest: null };

  function computePeek(candle: NormalizedCandle): { time: number; value: HighestLowestValue } {
    // Simulate adding to buffers without mutation. Warm-up gated on
    // buffer length (post-push), not raw count — after a
    // period-growing resume, `count` is the snapshot's large value
    // but the rebuilt buffer still needs new bars to fill.
    const newLength = Math.min(highBuffer.length + 1, period);
    if (newLength < period) {
      return { time: candle.time, value: nullValue };
    }

    // We need to scan including the new value
    let highest = candle.high;
    let lowest = candle.low;
    // Scan existing buffer excluding oldest if full (it will be overwritten)
    const startIdx = highBuffer.isFull ? 1 : 0;
    for (let i = startIdx; i < highBuffer.length; i++) {
      const h = highBuffer.get(i);
      const l = lowBuffer.get(i);
      if (h > highest) highest = h;
      if (l < lowest) lowest = l;
    }
    return { time: candle.time, value: { highest, lowest } };
  }

  const indicator: IncrementalIndicator<
    HighestLowestValue,
    IndicatorSnapshot<HighestLowestState>
  > = {
    next(candle: NormalizedCandle) {
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      count++;

      // Warm-up gated on buffer length so a period-growing resume
      // correctly waits for new bars to roll in.
      if (highBuffer.length < period) {
        return { time: candle.time, value: nullValue };
      }

      return { time: candle.time, value: scanMaxMin(highBuffer, lowBuffer) };
    },

    peek(candle: NormalizedCandle) {
      return computePeek(candle);
    },

    getState(): IndicatorSnapshot<HighestLowestState> {
      return makeSnapshot(
        "highestLowest",
        HIGHEST_LOWEST_VERSION,
        { period },
        {
          highBuffer: highBuffer.snapshot(),
          lowBuffer: lowBuffer.snapshot(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return highBuffer.length >= period;
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
