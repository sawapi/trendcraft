/**
 * Incremental NVI (Negative Volume Index)
 *
 * State category: **Recursive** (`nviValue` is a multiplicative
 * cumulative accumulator updated only on volume-down bars; no raw-price
 * window).
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<NviState>` and `fromState` accepts the same.
 * `initialValue` now lives in `meta.params` (no longer in bare state),
 * so resuming with a different `initialValue` is refused by the
 * recursive policy — the running `nviValue` is already scaled to the
 * original seed and re-seeding mid-stream would mislead consumers.
 *
 * NVI changes only on days when volume decreases from the prior day.
 * When volume decreases: NVI *= (close / prevClose)
 * When volume increases or stays same: NVI unchanged
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for NVI. Params (`initialValue`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type NviState = {
  prevClose: number | null;
  prevVolume: number | null;
  nviValue: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const NVI_VERSION = 1;

type NviParams = {
  initialValue: number;
};

/**
 * Create an incremental NVI indicator
 *
 * @param options - Configuration options
 * @param options.initialValue - Starting NVI value (default: 1000)
 *
 * @example
 * ```ts
 * const nvi = createNvi({ initialValue: 1000 });
 * for (const candle of stream) {
 *   const { value } = nvi.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createNvi(
  options: { initialValue?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<NviState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number, IndicatorSnapshot<NviState>> {
  const { params, state } = resolveResume<NviParams, NviState>({
    indicator: "nvi",
    version: NVI_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { initialValue: 1000 },
  });

  const initialValue = params.initialValue;

  let prevClose: number | null;
  let prevVolume: number | null;
  let nviValue: number;
  let count: number;

  if (state !== null) {
    prevClose = state.prevClose;
    prevVolume = state.prevVolume;
    nviValue = state.nviValue;
    count = state.count;
  } else {
    prevClose = null;
    prevVolume = null;
    nviValue = initialValue;
    count = 0;
  }

  const indicator: IncrementalIndicator<number, IndicatorSnapshot<NviState>> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null || prevVolume === null) {
        prevClose = candle.close;
        prevVolume = candle.volume;
        return { time: candle.time, value: nviValue };
      }

      if (candle.volume < prevVolume && prevClose !== 0) {
        nviValue *= candle.close / prevClose;
      }

      prevClose = candle.close;
      prevVolume = candle.volume;
      return { time: candle.time, value: nviValue };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null || prevVolume === null) {
        return { time: candle.time, value: nviValue };
      }

      let peekNvi = nviValue;
      if (candle.volume < prevVolume && prevClose !== 0) {
        peekNvi *= candle.close / prevClose;
      }

      return { time: candle.time, value: peekNvi };
    },

    getState(): IndicatorSnapshot<NviState> {
      return makeSnapshot(
        "nvi",
        NVI_VERSION,
        { initialValue },
        { prevClose, prevVolume, nviValue, count },
      );
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
