/**
 * Incremental Donchian Channel
 *
 * State category: **Windowed** (raw high / low buffers).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<DonchianState>` and `fromState` accepts the same.
 *
 * Shows highest high and lowest low over N periods.
 * Uses CircularBuffer with linear scan for min/max.
 *
 * Defaults: `period` has no canonical default (Pine `ta.donchian`
 * requires it from the caller); aligned with the SMA / WMA / VWMA / SD
 * migration pattern. On resume, `period` may be omitted to inherit
 * from the snapshot.
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
 * Donchian Channel output value
 */
export type DonchianValue = {
  upper: number | null;
  middle: number | null;
  lower: number | null;
};

/**
 * Bare state shape for Donchian Channel. Params (`period`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type DonchianState = {
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const DONCHIAN_VERSION = 1;

type DonchianParams = {
  period: number;
};

/**
 * Create an incremental Donchian Channel indicator
 *
 * @example
 * ```ts
 * // Fresh start — period is required on first call.
 * const dc = createDonchianChannel({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = dc.next(candle);
 *   if (dc.isWarmedUp) console.log(value.upper, value.middle, value.lower);
 * }
 *
 * // Resume from a saved snapshot — period may be omitted; the
 * // snapshot supplies it.
 * const resumed = createDonchianChannel({}, { fromState: snapshot });
 * ```
 */
export function createDonchianChannel(
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<DonchianState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<DonchianValue, IndicatorSnapshot<DonchianState>> {
  const { params, state, reconfigured } = resolveResume<DonchianParams, DonchianState>({
    indicator: "donchianChannel",
    version: DONCHIAN_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {}, // `period` is intentionally absent — no canonical default.
  });

  const period = requireParam(
    "donchianChannel",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. Buffers are raw high / low values — no
      // per-period derivation, so we just carry forward the most
      // recent min(snapshot.length, newPeriod) samples.
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

  function compute(hBuf: CircularBuffer<number>, lBuf: CircularBuffer<number>): DonchianValue {
    // Warm-up gated on buffers being full at the current period, not on
    // `count`. After a period-growing resume, `count` is the snapshot's
    // large value but the rebuilt buffer needs more candles to fill.
    if (hBuf.length < period) {
      return { upper: null, middle: null, lower: null };
    }

    let highest = hBuf.get(0);
    let lowest = lBuf.get(0);
    for (let i = 1; i < hBuf.length; i++) {
      const h = hBuf.get(i);
      if (h > highest) highest = h;
    }
    for (let i = 1; i < lBuf.length; i++) {
      const l = lBuf.get(i);
      if (l < lowest) lowest = l;
    }

    return {
      upper: highest,
      middle: (highest + lowest) / 2,
      lower: lowest,
    };
  }

  const indicator: IncrementalIndicator<DonchianValue, IndicatorSnapshot<DonchianState>> = {
    next(candle: NormalizedCandle) {
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      count++;

      return { time: candle.time, value: compute(highBuffer, lowBuffer) };
    },

    peek(candle: NormalizedCandle) {
      const tempHigh = CircularBuffer.fromSnapshot(highBuffer.snapshot());
      const tempLow = CircularBuffer.fromSnapshot(lowBuffer.snapshot());
      tempHigh.push(candle.high);
      tempLow.push(candle.low);

      return { time: candle.time, value: compute(tempHigh, tempLow) };
    },

    getState(): IndicatorSnapshot<DonchianState> {
      return makeSnapshot(
        "donchianChannel",
        DONCHIAN_VERSION,
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
