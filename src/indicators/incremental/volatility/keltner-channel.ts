/**
 * Incremental Keltner Channel
 *
 * Composite indicator: EMA (middle band) + ATR (band width).
 * Middle Band = EMA(close)
 * Upper Band = EMA + multiplier × ATR
 * Lower Band = EMA - multiplier × ATR
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { createEma, type EmaState } from "../moving-average/ema";
import { createAtr, type AtrState } from "../volatility/atr";

/**
 * Keltner Channel output value
 */
export type KeltnerChannelValue = {
  upper: number | null;
  middle: number | null;
  lower: number | null;
};

/**
 * State for incremental Keltner Channel
 */
export type KeltnerChannelState = {
  emaPeriod: number;
  atrPeriod: number;
  multiplier: number;
  emaState: EmaState;
  atrState: AtrState;
  count: number;
};

/**
 * Create an incremental Keltner Channel indicator
 *
 * @example
 * ```ts
 * const kc = createKeltnerChannel({ emaPeriod: 20, atrPeriod: 10, multiplier: 2 });
 * for (const candle of stream) {
 *   const { value } = kc.next(candle);
 *   if (kc.isWarmedUp) console.log(value.upper, value.middle, value.lower);
 * }
 * ```
 */
export function createKeltnerChannel(
  options: { emaPeriod?: number; atrPeriod?: number; multiplier?: number } = {},
  warmUpOptions?: WarmUpOptions<KeltnerChannelState>,
): IncrementalIndicator<KeltnerChannelValue, KeltnerChannelState> {
  const emaPeriod = options.emaPeriod ?? 20;
  const atrPeriod = options.atrPeriod ?? 10;
  const multiplier = options.multiplier ?? 2;

  let emaInd: IncrementalIndicator<number | null, EmaState>;
  let atrInd: IncrementalIndicator<number | null, AtrState>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    emaInd = createEma({ period: emaPeriod, source: "close" }, { fromState: s.emaState });
    atrInd = createAtr({ period: atrPeriod }, { fromState: s.atrState });
    count = s.count;
  } else {
    emaInd = createEma({ period: emaPeriod, source: "close" });
    atrInd = createAtr({ period: atrPeriod });
    count = 0;
  }

  function computeValue(emaVal: number | null, atrVal: number | null): KeltnerChannelValue {
    if (emaVal === null || atrVal === null) {
      return { upper: null, middle: null, lower: null };
    }
    const bandwidth = multiplier * atrVal;
    return {
      upper: emaVal + bandwidth,
      middle: emaVal,
      lower: emaVal - bandwidth,
    };
  }

  const indicator: IncrementalIndicator<KeltnerChannelValue, KeltnerChannelState> = {
    next(candle: NormalizedCandle) {
      count++;
      const emaResult = emaInd.next(candle);
      const atrResult = atrInd.next(candle);
      const value = computeValue(emaResult.value, atrResult.value);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const emaResult = emaInd.peek(candle);
      const atrResult = atrInd.peek(candle);
      const value = computeValue(emaResult.value, atrResult.value);
      return { time: candle.time, value };
    },

    getState(): KeltnerChannelState {
      return {
        emaPeriod,
        atrPeriod,
        multiplier,
        emaState: emaInd.getState(),
        atrState: atrInd.getState(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return emaInd.isWarmedUp && atrInd.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
