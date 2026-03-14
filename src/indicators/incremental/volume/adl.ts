/**
 * Incremental ADL (Accumulation/Distribution Line)
 *
 * CLV = ((Close - Low) - (High - Close)) / (High - Low)
 * ADL = cumulative sum of CLV * Volume
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type AdlState = {
  adl: number;
  count: number;
};

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
  warmUpOptions?: WarmUpOptions<AdlState>,
): IncrementalIndicator<number, AdlState> {
  let adlValue: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    adlValue = s.adl;
    count = s.count;
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

  const indicator: IncrementalIndicator<number, AdlState> = {
    next(candle: NormalizedCandle) {
      count++;
      adlValue += computeMoneyFlow(candle);
      return { time: candle.time, value: adlValue };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: adlValue + computeMoneyFlow(candle) };
    },

    getState(): AdlState {
      return { adl: adlValue, count };
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
