/**
 * Incremental ADL (Accumulation/Distribution Line)
 *
 * State category: **Recursive** (`adl` is a cumulative sum of
 * money-flow volume; no raw-price window).
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<AdlState>` and `fromState` accepts the same.
 * The factory signature now takes `(options, warmUpOptions)` to match
 * the rest of the library; previous direct callers that used the
 * single-argument form (`createAdl({ fromState })` or
 * `createAdl({ warmUp })`) must add an empty options object:
 * `createAdl({}, { fromState })` / `createAdl({}, { warmUp })`.
 *
 * Reconfig policy: ADL has no parameters, so meta.params is always
 * `{}` and structural reconfig is impossible.
 *
 * CLV = ((Close - Low) - (High - Close)) / (High - Low)
 * ADL = cumulative sum of CLV * Volume
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for ADL. ADL is parameter-less, so `meta.params`
 * is always `{}` and no params live here.
 */
export type AdlState = {
  adl: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ADL_VERSION = 1;

type AdlParams = Record<string, never>;

/**
 * Create an incremental ADL indicator
 *
 * @example
 * ```ts
 * const adl = createAdl();
 * for (const candle of stream) {
 *   const { value } = adl.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createAdl(
  options: Record<string, never> = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AdlState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number, IndicatorSnapshot<AdlState>> {
  const { state } = resolveResume<AdlParams, AdlState>({
    indicator: "adl",
    version: ADL_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  let adlValue: number;
  let count: number;

  if (state !== null) {
    adlValue = state.adl;
    count = state.count;
  } else {
    adlValue = 0;
    count = 0;
  }

  function computeMoneyFlow(candle: NormalizedCandle): number {
    const range = candle.high - candle.low;
    const clv =
      range === 0 ? 0 : (candle.close - candle.low - (candle.high - candle.close)) / range;
    return clv * candle.volume;
  }

  const indicator: IncrementalIndicator<number, IndicatorSnapshot<AdlState>> = {
    next(candle: NormalizedCandle) {
      count++;
      adlValue += computeMoneyFlow(candle);
      return { time: candle.time, value: adlValue };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: adlValue + computeMoneyFlow(candle) };
    },

    getState(): IndicatorSnapshot<AdlState> {
      return makeSnapshot("adl", ADL_VERSION, {}, { adl: adlValue, count });
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
