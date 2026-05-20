/**
 * Incremental Williams %R
 *
 * Williams %R = (Highest High - Close) / (Highest High - Lowest Low) × -100
 *
 * State category: **Windowed** (high/low raw-value buffers, no
 * recursion). Resume with a different `period` carries the high/low
 * values forward into the resized buffers. Range: -100 to 0.
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

/**
 * Bare state shape for Williams %R. Params (`period`) live in
 * `meta.params` on the wire.
 */
export type WilliamsRState = {
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const WILLIAMS_R_VERSION = 1;

type WilliamsRParams = {
  period: number;
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
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<WilliamsRState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<WilliamsRState>> {
  const { params, state, reconfigured } = resolveResume<WilliamsRParams, WilliamsRState>({
    indicator: "williamsR",
    version: WILLIAMS_R_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  const period = requireParam(
    "williamsR",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let count: number;

  function carryForward(
    snapshot: ReturnType<CircularBuffer<number>["snapshot"]>,
  ): CircularBuffer<number> {
    const old = CircularBuffer.fromSnapshot<number>(snapshot);
    const next = new CircularBuffer<number>(period);
    const carry = Math.min(old.length, period);
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
    highBuffer = new CircularBuffer<number>(period);
    lowBuffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function compute(
    close: number,
    hBuf: CircularBuffer<number>,
    lBuf: CircularBuffer<number>,
  ): number | null {
    // Gate on buffer fill, not a historical `count`: after a
    // period-growing resume the carried buffer is shorter than `count`.
    if (hBuf.length < period) return null;
    const highestHigh = bufferMax(hBuf);
    const lowestLow = bufferMin(lBuf);
    const range = highestHigh - lowestLow;
    return range !== 0 ? ((highestHigh - close) / range) * -100 : -50;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<WilliamsRState>> = {
    next(candle: NormalizedCandle) {
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      count++;

      const value = compute(candle.close, highBuffer, lowBuffer);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Create temporary snapshots to compute without mutation
      const tempHigh = CircularBuffer.fromSnapshot(highBuffer.snapshot());
      const tempLow = CircularBuffer.fromSnapshot(lowBuffer.snapshot());
      tempHigh.push(candle.high);
      tempLow.push(candle.low);

      const value = compute(candle.close, tempHigh, tempLow);
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<WilliamsRState> {
      return makeSnapshot(
        "williamsR",
        WILLIAMS_R_VERSION,
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

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
