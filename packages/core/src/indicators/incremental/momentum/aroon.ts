/**
 * Incremental Aroon Indicator
 *
 * Aroon Up = ((period - bars since highest high) / period) × 100
 * Aroon Down = ((period - bars since lowest low) / period) × 100
 *
 * State category: **Windowed** (fixed-size high/low raw-value buffers,
 * no recursion). Resume with a different `period` carries the high/low
 * values forward into the resized buffers.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type AroonValue = {
  up: number | null;
  down: number | null;
  oscillator: number | null;
};

/**
 * Bare state shape for Aroon. Params (`period`) live in `meta.params`.
 */
export type AroonState = {
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const AROON_VERSION = 1;

type AroonParams = {
  period: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AroonState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<AroonValue, IndicatorSnapshot<AroonState>> {
  const { params, state, reconfigured } = resolveResume<AroonParams, AroonState>({
    indicator: "aroon",
    version: AROON_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 25 },
  });

  const period = requireParam(
    "aroon",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  const capacity = period + 1;

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let count: number;

  function carryForward(
    snapshot: ReturnType<CircularBuffer<number>["snapshot"]>,
  ): CircularBuffer<number> {
    const old = CircularBuffer.fromSnapshot<number>(snapshot);
    const next = new CircularBuffer<number>(capacity);
    const carry = Math.min(old.length, capacity);
    for (let i = old.length - carry; i < old.length; i++) {
      next.push(old.get(i));
    }
    return next;
  }

  if (state !== null) {
    if (reconfigured) {
      highBuffer = carryForward(state.highBuffer);
      lowBuffer = carryForward(state.lowBuffer);
    } else {
      highBuffer = CircularBuffer.fromSnapshot(state.highBuffer);
      lowBuffer = CircularBuffer.fromSnapshot(state.lowBuffer);
    }
    count = state.count;
  } else {
    highBuffer = new CircularBuffer<number>(capacity);
    lowBuffer = new CircularBuffer<number>(capacity);
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

  const indicator: IncrementalIndicator<AroonValue, IndicatorSnapshot<AroonState>> = {
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

    getState(): IndicatorSnapshot<AroonState> {
      return makeSnapshot(
        "aroon",
        AROON_VERSION,
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
      // Gate on buffer fill, not `count`: after a period-growing resume
      // the carried buffer is shorter than the old `count`, and
      // compute() returns nulls until it refills to period + 1.
      return highBuffer.length >= period + 1;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
