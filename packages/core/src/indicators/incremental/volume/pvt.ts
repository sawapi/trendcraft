/**
 * Incremental PVT (Price Volume Trend)
 *
 * State category: **Recursive** (`cumPvt` is a cumulative
 * volume-weighted percent-change accumulator; no raw-price window).
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<PvtState>` and `fromState` accepts the same.
 * The factory signature now takes `(options, warmUpOptions)` to match
 * the rest of the library; previous direct callers that used the
 * single-argument form (`createPvt({ fromState })` or
 * `createPvt({ warmUp })`) must add an empty options object:
 * `createPvt({}, { fromState })` / `createPvt({}, { warmUp })`.
 *
 * Reconfig policy: PVT has no parameters, so meta.params is always
 * `{}` and structural reconfig is impossible.
 *
 * PVT = Previous PVT + Volume * ((Close - Previous Close) / Previous Close)
 * Similar to OBV but weights volume by price change percentage.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for PVT. PVT is parameter-less, so `meta.params`
 * is always `{}` and no params live here.
 */
export type PvtState = {
  prevClose: number | null;
  cumPvt: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const PVT_VERSION = 1;

type PvtParams = Record<string, never>;

/**
 * Create an incremental PVT indicator
 *
 * @example
 * ```ts
 * const pvt = createPvt();
 * for (const candle of stream) {
 *   const { value } = pvt.next(candle);
 *   if (value !== null) console.log(value);
 * }
 * ```
 */
export function createPvt(
  options: Record<string, never> = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<PvtState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<PvtState>> {
  const { state } = resolveResume<PvtParams, PvtState>({
    indicator: "pvt",
    version: PVT_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  let prevClose: number | null;
  let cumPvt: number;
  let count: number;

  if (state !== null) {
    prevClose = state.prevClose;
    cumPvt = state.cumPvt;
    count = state.count;
  } else {
    prevClose = null;
    cumPvt = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<PvtState>> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        prevClose = candle.close;
        return { time: candle.time, value: 0 };
      }

      if (prevClose !== 0) {
        cumPvt += candle.volume * ((candle.close - prevClose) / prevClose);
      }

      prevClose = candle.close;
      return { time: candle.time, value: cumPvt };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null) {
        return { time: candle.time, value: 0 };
      }

      let peekPvt = cumPvt;
      if (prevClose !== 0) {
        peekPvt += candle.volume * ((candle.close - prevClose) / prevClose);
      }

      return { time: candle.time, value: peekPvt };
    },

    getState(): IndicatorSnapshot<PvtState> {
      return makeSnapshot("pvt", PVT_VERSION, {}, { prevClose, cumPvt, count });
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 1;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
