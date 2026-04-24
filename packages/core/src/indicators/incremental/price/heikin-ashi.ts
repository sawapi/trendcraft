/**
 * Incremental Heikin-Ashi
 *
 * Smoothed candles that depend on the previous HA open/close.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

const EPSILON = 1e-10;

export type HeikinAshiValue = {
  open: number;
  high: number;
  low: number;
  close: number;
  trend: 1 | -1 | 0;
};

export type HeikinAshiState = {
  prevHaOpen: number | null;
  prevHaClose: number | null;
  count: number;
};

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
  warmUpOptions?: WarmUpOptions<HeikinAshiState>,
): IncrementalIndicator<HeikinAshiValue, HeikinAshiState> {
  let prevHaOpen: number | null;
  let prevHaClose: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    prevHaOpen = warmUpOptions.fromState.prevHaOpen;
    prevHaClose = warmUpOptions.fromState.prevHaClose;
    count = warmUpOptions.fromState.count;
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

  const indicator: IncrementalIndicator<HeikinAshiValue, HeikinAshiState> = {
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

    getState(): HeikinAshiState {
      return { prevHaOpen, prevHaClose, count };
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
