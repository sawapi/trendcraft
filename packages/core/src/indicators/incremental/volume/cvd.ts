/**
 * Incremental CVD (Cumulative Volume Delta)
 *
 * State category: **Recursive** (`cumDelta` is a cumulative
 * buy/sell-pressure accumulator; no raw-price window).
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<CvdState>` and `fromState` accepts the same.
 * The factory signature now takes `(options, warmUpOptions)` to match
 * the rest of the library; previous direct callers that used the
 * single-argument form (`createCvd({ fromState })` or
 * `createCvd({ warmUp })`) must add an empty options object:
 * `createCvd({}, { fromState })` / `createCvd({}, { warmUp })`.
 *
 * Reconfig policy: CVD has no parameters, so meta.params is always
 * `{}` and structural reconfig is impossible.
 *
 * Estimates buying and selling pressure from OHLCV data.
 * buyVol = volume * (close - low) / (high - low)
 * sellVol = volume - buyVol
 * delta = buyVol - sellVol
 * CVD = cumulative sum of delta
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for CVD. CVD is parameter-less, so `meta.params`
 * is always `{}` and no params live here.
 */
export type CvdState = {
  cumDelta: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const CVD_VERSION = 1;

type CvdParams = Record<string, never>;

/**
 * Create an incremental CVD indicator
 *
 * @example
 * ```ts
 * const cvd = createCvd();
 * for (const candle of stream) {
 *   const { value } = cvd.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createCvd(
  options: Record<string, never> = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<CvdState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number, IndicatorSnapshot<CvdState>> {
  const { state } = resolveResume<CvdParams, CvdState>({
    indicator: "cvd",
    version: CVD_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  let cumDelta: number;
  let count: number;

  if (state !== null) {
    cumDelta = state.cumDelta;
    count = state.count;
  } else {
    cumDelta = 0;
    count = 0;
  }

  function computeDelta(candle: NormalizedCandle): number {
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    const buyVol = (candle.volume * (candle.close - candle.low)) / range;
    const sellVol = candle.volume - buyVol;
    return buyVol - sellVol;
  }

  const indicator: IncrementalIndicator<number, IndicatorSnapshot<CvdState>> = {
    next(candle: NormalizedCandle) {
      count++;
      cumDelta += computeDelta(candle);
      return { time: candle.time, value: cumDelta };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: cumDelta + computeDelta(candle) };
    },

    getState(): IndicatorSnapshot<CvdState> {
      return makeSnapshot("cvd", CVD_VERSION, {}, { cumDelta, count });
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
