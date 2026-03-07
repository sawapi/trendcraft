/**
 * Incremental Supertrend
 *
 * Uses ATR internally to calculate dynamic support/resistance bands.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { createAtr } from "../volatility/atr";

export type SupertrendValue = {
  supertrend: number | null;
  direction: 1 | -1 | 0;
  upperBand: number | null;
  lowerBand: number | null;
};

export type SupertrendState = {
  period: number;
  multiplier: number;
  atrState: unknown;
  prevFinalUpper: number | null;
  prevFinalLower: number | null;
  prevClose: number | null;
  direction: 1 | -1 | 0;
  count: number;
};

/**
 * Create an incremental Supertrend indicator
 *
 * @example
 * ```ts
 * const st = createSupertrend({ period: 10, multiplier: 3 });
 * for (const candle of stream) {
 *   const { value } = st.next(candle);
 *   if (st.isWarmedUp) console.log(value.supertrend, value.direction);
 * }
 * ```
 */
export function createSupertrend(
  options: { period?: number; multiplier?: number } = {},
  warmUpOptions?: WarmUpOptions<SupertrendState>,
): IncrementalIndicator<SupertrendValue, SupertrendState> {
  const period = options.period ?? 10;
  const multiplier = options.multiplier ?? 3;

  let atrIndicator = createAtr({ period });
  let prevFinalUpper: number | null = null;
  let prevFinalLower: number | null = null;
  let prevClose: number | null = null;
  let direction: 1 | -1 | 0 = 0;
  let count = 0;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    atrIndicator = createAtr({ period }, { fromState: s.atrState as any });
    prevFinalUpper = s.prevFinalUpper;
    prevFinalLower = s.prevFinalLower;
    prevClose = s.prevClose;
    direction = s.direction;
    count = s.count;
  }

  const nullValue: SupertrendValue = {
    supertrend: null,
    direction: 0,
    upperBand: null,
    lowerBand: null,
  };

  const indicator: IncrementalIndicator<SupertrendValue, SupertrendState> = {
    next(candle: NormalizedCandle) {
      count++;
      const atrResult = atrIndicator.next(candle);
      const atrVal = atrResult.value;

      if (atrVal === null) {
        prevClose = candle.close;
        return { time: candle.time, value: nullValue };
      }

      const hl2 = (candle.high + candle.low) / 2;
      const basicUpper = hl2 + multiplier * atrVal;
      const basicLower = hl2 - multiplier * atrVal;

      // Final Upper Band
      let finalUpper: number;
      if (prevFinalUpper === null) {
        finalUpper = basicUpper;
      } else {
        finalUpper =
          basicUpper < prevFinalUpper || (prevClose !== null && prevClose > prevFinalUpper)
            ? basicUpper
            : prevFinalUpper;
      }

      // Final Lower Band
      let finalLower: number;
      if (prevFinalLower === null) {
        finalLower = basicLower;
      } else {
        finalLower =
          basicLower > prevFinalLower || (prevClose !== null && prevClose < prevFinalLower)
            ? basicLower
            : prevFinalLower;
      }

      // Determine direction
      if (direction === 0) {
        // Initial direction
        direction = candle.close > finalUpper ? 1 : -1;
      } else if (direction === -1 && candle.close > finalUpper) {
        direction = 1;
      } else if (direction === 1 && candle.close < finalLower) {
        direction = -1;
      }

      const supertrend = direction === 1 ? finalLower : finalUpper;

      prevFinalUpper = finalUpper;
      prevFinalLower = finalLower;
      prevClose = candle.close;

      return {
        time: candle.time,
        value: { supertrend, direction, upperBand: finalUpper, lowerBand: finalLower },
      };
    },

    peek(candle: NormalizedCandle) {
      const atrPeek = atrIndicator.peek(candle);
      if (atrPeek.value === null) {
        return { time: candle.time, value: nullValue };
      }

      const hl2 = (candle.high + candle.low) / 2;
      const basicUpper = hl2 + multiplier * atrPeek.value;
      const basicLower = hl2 - multiplier * atrPeek.value;

      const finalUpper =
        prevFinalUpper === null
          ? basicUpper
          : basicUpper < prevFinalUpper || (prevClose !== null && prevClose > prevFinalUpper)
            ? basicUpper
            : prevFinalUpper;

      const finalLower =
        prevFinalLower === null
          ? basicLower
          : basicLower > prevFinalLower || (prevClose !== null && prevClose < prevFinalLower)
            ? basicLower
            : prevFinalLower;

      let dir = direction;
      if (dir === 0) {
        dir = candle.close > finalUpper ? 1 : -1;
      } else if (dir === -1 && candle.close > finalUpper) {
        dir = 1;
      } else if (dir === 1 && candle.close < finalLower) {
        dir = -1;
      }

      return {
        time: candle.time,
        value: {
          supertrend: dir === 1 ? finalLower : finalUpper,
          direction: dir,
          upperBand: finalUpper,
          lowerBand: finalLower,
        },
      };
    },

    getState(): SupertrendState {
      return {
        period,
        multiplier,
        atrState: atrIndicator.getState(),
        prevFinalUpper,
        prevFinalLower,
        prevClose,
        direction,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return atrIndicator.isWarmedUp && direction !== 0;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
