/**
 * Incremental OBV (On Balance Volume)
 *
 * State category: **Recursive** (`obv` is a cumulative accumulator
 * updated by close-to-close direction; no raw-price window that could
 * be carried forward across a parameter change).
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<ObvState>` and `fromState` accepts the same.
 * The factory signature now takes `(options, warmUpOptions)` to match
 * the rest of the library; previous direct callers that used the
 * single-argument form (`createObv({ fromState })` or
 * `createObv({ warmUp })`) must add an empty options object:
 * `createObv({}, { fromState })` / `createObv({}, { warmUp })`.
 *
 * Reconfig policy: OBV has no parameters, so meta.params is always
 * `{}` and structural reconfig is impossible. The recursive-refuse
 * branch in `resolveResume` is unreachable but kept for uniformity.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for OBV. OBV is parameter-less, so `meta.params`
 * is always `{}` and no params live here.
 */
export type ObvState = {
  prevClose: number | null;
  obv: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const OBV_VERSION = 1;

type ObvParams = Record<string, never>;

/**
 * Create an incremental OBV indicator
 *
 * @example
 * ```ts
 * const obv = createObv();
 * for (const candle of stream) {
 *   const { value } = obv.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createObv(
  options: Record<string, never> = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ObvState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number, IndicatorSnapshot<ObvState>> {
  const { state } = resolveResume<ObvParams, ObvState>({
    indicator: "obv",
    version: OBV_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  let prevClose: number | null;
  let obv: number;
  let count: number;

  if (state !== null) {
    prevClose = state.prevClose;
    obv = state.obv;
    count = state.count;
  } else {
    prevClose = null;
    obv = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number, IndicatorSnapshot<ObvState>> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        // First candle: OBV starts at 0
        prevClose = candle.close;
        return { time: candle.time, value: obv };
      }

      if (candle.close > prevClose) {
        obv += candle.volume;
      } else if (candle.close < prevClose) {
        obv -= candle.volume;
      }
      // If close === prevClose, OBV stays the same

      prevClose = candle.close;
      return { time: candle.time, value: obv };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null) {
        return { time: candle.time, value: 0 };
      }

      let peekObv = obv;
      if (candle.close > prevClose) {
        peekObv += candle.volume;
      } else if (candle.close < prevClose) {
        peekObv -= candle.volume;
      }

      return { time: candle.time, value: peekObv };
    },

    getState(): IndicatorSnapshot<ObvState> {
      return makeSnapshot("obv", OBV_VERSION, {}, { prevClose, obv, count });
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
