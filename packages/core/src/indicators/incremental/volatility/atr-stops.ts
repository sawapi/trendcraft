/**
 * Incremental ATR Stops
 *
 * Composes the incremental ATR indicator to compute stop-loss and
 * take-profit levels based on ATR distance from the current close.
 */

import type { AtrStopsValue, NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { type AtrState, createAtr } from "./atr";

export type AtrStopsState = {
  atrState: AtrState;
  period: number;
  stopMultiplier: number;
  takeProfitMultiplier: number;
  count: number;
};

const NULL_VALUE: AtrStopsValue = {
  longStopLevel: null,
  shortStopLevel: null,
  longTakeProfitLevel: null,
  shortTakeProfitLevel: null,
  atr: null,
  stopDistance: null,
  takeProfitDistance: null,
};

/**
 * Create an incremental ATR Stops indicator
 *
 * Provides ATR-based stop-loss and take-profit levels for both long
 * and short positions, computed from the current close price.
 *
 * @example
 * ```ts
 * const stops = createAtrStops({ period: 14, stopMultiplier: 2, takeProfitMultiplier: 3 });
 * for (const candle of stream) {
 *   const { value } = stops.next(candle);
 *   if (value.atr !== null) {
 *     console.log(`Long stop: ${value.longStopLevel}, TP: ${value.longTakeProfitLevel}`);
 *   }
 * }
 * ```
 */
export function createAtrStops(
  options: { period?: number; stopMultiplier?: number; takeProfitMultiplier?: number } = {},
  warmUpOptions?: WarmUpOptions<AtrStopsState>,
): IncrementalIndicator<AtrStopsValue, AtrStopsState> {
  const period = options.period ?? 14;
  const stopMultiplier = options.stopMultiplier ?? 2.0;
  const takeProfitMultiplier = options.takeProfitMultiplier ?? 3.0;

  let count: number;
  let atr: IncrementalIndicator<number | null, AtrState>;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    count = s.count;
    atr = createAtr({ period }, { fromState: s.atrState });
  } else {
    count = 0;
    atr = createAtr({ period });
  }

  function computeLevels(close: number, atrValue: number): AtrStopsValue {
    const stopDist = atrValue * stopMultiplier;
    const tpDist = atrValue * takeProfitMultiplier;

    return {
      longStopLevel: close - stopDist,
      shortStopLevel: close + stopDist,
      longTakeProfitLevel: close + tpDist,
      shortTakeProfitLevel: close - tpDist,
      atr: atrValue,
      stopDistance: stopDist,
      takeProfitDistance: tpDist,
    };
  }

  const indicator: IncrementalIndicator<AtrStopsValue, AtrStopsState> = {
    next(candle: NormalizedCandle) {
      count++;
      const atrResult = atr.next(candle);

      if (atrResult.value === null) {
        return { time: candle.time, value: NULL_VALUE };
      }

      return { time: candle.time, value: computeLevels(candle.close, atrResult.value) };
    },

    peek(candle: NormalizedCandle) {
      const atrResult = atr.peek(candle);

      if (atrResult.value === null) {
        return { time: candle.time, value: NULL_VALUE };
      }

      return { time: candle.time, value: computeLevels(candle.close, atrResult.value) };
    },

    getState(): AtrStopsState {
      return {
        atrState: atr.getState(),
        period,
        stopMultiplier,
        takeProfitMultiplier,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return atr.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
