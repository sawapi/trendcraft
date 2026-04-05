/**
 * Incremental Balance of Power (BOP)
 *
 * BOP = SMA((close - open) / (high - low), smoothPeriod)
 * Measures the strength of buyers vs sellers by relating the price change to the range.
 */

import type { NormalizedCandle } from "../../../types";
import { createSma } from "../moving-average/sma";
import type { SmaState } from "../moving-average/sma";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";

export type BalanceOfPowerState = {
  smaState: SmaState;
  smoothPeriod: number;
  count: number;
};

/**
 * Create an incremental Balance of Power indicator
 *
 * @example
 * ```ts
 * const bop = createBalanceOfPower({ smoothPeriod: 14 });
 * for (const candle of stream) {
 *   const { value } = bop.next(candle);
 *   if (bop.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createBalanceOfPower(
  options: { smoothPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<BalanceOfPowerState>,
): IncrementalIndicator<number | null, BalanceOfPowerState> {
  const smoothPeriod = options.smoothPeriod ?? 14;

  let sma: ReturnType<typeof createSma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    sma = createSma({ period: smoothPeriod }, { fromState: s.smaState });
    count = s.count;
  } else {
    sma = createSma({ period: smoothPeriod });
    count = 0;
  }

  function rawBop(candle: NormalizedCandle): number {
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    return (candle.close - candle.open) / range;
  }

  const indicator: IncrementalIndicator<number | null, BalanceOfPowerState> = {
    next(candle: NormalizedCandle) {
      count++;
      const bop = rawBop(candle);
      return sma.next(makeCandle(candle.time, bop));
    },

    peek(candle: NormalizedCandle) {
      const bop = rawBop(candle);
      return sma.peek(makeCandle(candle.time, bop));
    },

    getState(): BalanceOfPowerState {
      return {
        smaState: sma.getState(),
        smoothPeriod,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return sma.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
