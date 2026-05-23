/**
 * Incremental VWAP (Volume Weighted Average Price)
 *
 * State category: **Recursive** (cumulative TPV / volume accumulators
 * with daily session-boundary resets — no raw-price window to carry
 * forward across a parameter change). VWAP itself takes no parameters,
 * so reconfig is structurally impossible; the recursive category is
 * the semantically correct slot.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<VwapState>` and `fromState` accepts the same.
 * The factory signature now takes `(options, warmUpOptions)` to match
 * the rest of the library; previous direct callers that used the
 * single-argument form (`createVwap({ fromState })`) must add an empty
 * options object: `createVwap({}, { fromState })`.
 *
 * Session-based VWAP with daily reset (simplified for incremental use).
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for VWAP. VWAP has no params, so `meta.params` is
 * always `{}` on the wire.
 */
export type VwapState = {
  cumulativeTpv: number;
  cumulativeVolume: number;
  count: number;
  currentDay: number;
};

export type VwapValue = {
  vwap: number | null;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const VWAP_VERSION = 1;

const MS_PER_DAY = 86400000;

/**
 * Create an incremental VWAP indicator (session-based with daily reset)
 *
 * @example
 * ```ts
 * const vwap = createVwap();
 * for (const candle of stream) {
 *   const { value } = vwap.next(candle);
 *   console.log(value.vwap);
 * }
 * ```
 */
export function createVwap(
  _options: Record<string, never> = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<VwapState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<VwapValue, IndicatorSnapshot<VwapState>> {
  const { state } = resolveResume<Record<string, never>, VwapState>({
    indicator: "vwap",
    version: VWAP_VERSION,
    category: "recursive",
    options: _options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  let cumulativeTpv: number;
  let cumulativeVolume: number;
  let count: number;
  let currentDay: number;

  if (state !== null) {
    cumulativeTpv = state.cumulativeTpv;
    cumulativeVolume = state.cumulativeVolume;
    count = state.count;
    currentDay = state.currentDay;
  } else {
    cumulativeTpv = 0;
    cumulativeVolume = 0;
    count = 0;
    currentDay = -1;
  }

  function processCandle(candle: NormalizedCandle): VwapValue {
    const day = Math.floor(candle.time / MS_PER_DAY);

    // Reset on new day
    if (day !== currentDay) {
      cumulativeTpv = 0;
      cumulativeVolume = 0;
      currentDay = day;
    }

    const tp = (candle.high + candle.low + candle.close) / 3;
    cumulativeTpv += tp * candle.volume;
    cumulativeVolume += candle.volume;

    const vwap = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null;
    return { vwap };
  }

  const indicator: IncrementalIndicator<VwapValue, IndicatorSnapshot<VwapState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const day = Math.floor(candle.time / MS_PER_DAY);
      let peekTpv = cumulativeTpv;
      let peekVol = cumulativeVolume;

      if (day !== currentDay) {
        peekTpv = 0;
        peekVol = 0;
      }

      const tp = (candle.high + candle.low + candle.close) / 3;
      peekTpv += tp * candle.volume;
      peekVol += candle.volume;

      const vwap = peekVol > 0 ? peekTpv / peekVol : null;
      return { time: candle.time, value: { vwap } };
    },

    getState(): IndicatorSnapshot<VwapState> {
      return makeSnapshot(
        "vwap",
        VWAP_VERSION,
        {},
        { cumulativeTpv, cumulativeVolume, count, currentDay },
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
