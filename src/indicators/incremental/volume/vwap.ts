/**
 * Incremental VWAP (Volume Weighted Average Price)
 *
 * Session-based VWAP with daily reset (simplified for incremental use).
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type VwapState = {
  cumulativeTpv: number;
  cumulativeVolume: number;
  count: number;
  currentDay: number;
};

export type VwapValue = {
  vwap: number | null;
};

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
  warmUpOptions?: WarmUpOptions<VwapState>,
): IncrementalIndicator<VwapValue, VwapState> {
  let cumulativeTpv: number;
  let cumulativeVolume: number;
  let count: number;
  let currentDay: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    cumulativeTpv = s.cumulativeTpv;
    cumulativeVolume = s.cumulativeVolume;
    count = s.count;
    currentDay = s.currentDay;
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

  const indicator: IncrementalIndicator<VwapValue, VwapState> = {
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

    getState(): VwapState {
      return { cumulativeTpv, cumulativeVolume, count, currentDay };
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
