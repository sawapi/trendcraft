/**
 * Incremental Heikin-Ashi
 *
 * Smoothed candles that depend on the previous HA open/close.
 *
 * State category: **Recursive** (`prevHaOpen` / `prevHaClose` are the
 * recursive accumulators). Heikin-Ashi takes no params, so there is
 * nothing to reconfigure — every resume is a verbatim restore.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

const EPSILON = 1e-10;

export type HeikinAshiValue = {
  open: number;
  high: number;
  low: number;
  close: number;
  trend: 1 | -1 | 0;
};

/**
 * Bare state shape for Heikin-Ashi. Heikin-Ashi has no params, so
 * `meta.params` is an empty object on the wire.
 */
export type HeikinAshiState = {
  prevHaOpen: number | null;
  prevHaClose: number | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const HEIKIN_ASHI_VERSION = 1;

// biome-ignore lint/complexity/noBannedTypes: Heikin-Ashi genuinely has no params.
type HeikinAshiParams = {};

/**
 * Create an incremental Heikin-Ashi indicator.
 *
 * @example
 * ```ts
 * const ha = createHeikinAshi();
 * for (const candle of stream) {
 *   const { value } = ha.next(candle);
 *   if (value.trend === 1) console.log("bullish");
 * }
 * ```
 */
export function createHeikinAshi(
  _options: Record<string, never> = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<HeikinAshiState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<HeikinAshiValue, IndicatorSnapshot<HeikinAshiState>> {
  const { state } = resolveResume<HeikinAshiParams, HeikinAshiState>({
    indicator: "heikinAshi",
    version: HEIKIN_ASHI_VERSION,
    category: "recursive",
    options: {},
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {},
  });

  let prevHaOpen: number | null;
  let prevHaClose: number | null;
  let count: number;

  if (state !== null) {
    prevHaOpen = state.prevHaOpen;
    prevHaClose = state.prevHaClose;
    count = state.count;
  } else {
    prevHaOpen = null;
    prevHaClose = null;
    count = 0;
  }

  function compute(
    candle: NormalizedCandle,
    prevOpen: number | null,
    prevClose: number | null,
  ): HeikinAshiValue {
    const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
    const haOpen =
      prevOpen === null || prevClose === null
        ? (candle.open + candle.close) / 2
        : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(candle.high, haOpen, haClose);
    const haLow = Math.min(candle.low, haOpen, haClose);

    let trend: 1 | -1 | 0 = 0;
    if (haClose > haOpen + EPSILON && Math.abs(haLow - haOpen) < EPSILON) {
      trend = 1;
    } else if (haClose < haOpen - EPSILON && Math.abs(haHigh - haOpen) < EPSILON) {
      trend = -1;
    }

    return { open: haOpen, high: haHigh, low: haLow, close: haClose, trend };
  }

  const indicator: IncrementalIndicator<HeikinAshiValue, IndicatorSnapshot<HeikinAshiState>> = {
    next(candle: NormalizedCandle) {
      const value = compute(candle, prevHaOpen, prevHaClose);
      prevHaOpen = value.open;
      prevHaClose = value.close;
      count++;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: compute(candle, prevHaOpen, prevHaClose) };
    },

    getState(): IndicatorSnapshot<HeikinAshiState> {
      return makeSnapshot(
        "heikinAshi",
        HEIKIN_ASHI_VERSION,
        {},
        { prevHaOpen, prevHaClose, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count > 0;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
