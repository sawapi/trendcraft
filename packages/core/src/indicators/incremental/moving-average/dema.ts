/**
 * Incremental DEMA (Double Exponential Moving Average)
 *
 * DEMA = 2 * EMA1 - EMA2
 * where EMA2 = EMA(EMA1, period)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";
import { createEma } from "./ema";
import type { EmaState } from "./ema";

export type DemaState = {
  period: number;
  source: PriceSource;
  ema1State: EmaState;
  ema2State: EmaState;
  count: number;
};

/**
 * Create an incremental DEMA indicator
 *
 * @example
 * ```ts
 * const dema = createDema({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = dema.next(candle);
 *   if (dema.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createDema(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<DemaState>,
): IncrementalIndicator<number | null, DemaState> {
  const period = options.period ?? 20;
  const source: PriceSource = options.source ?? "close";

  let ema1: ReturnType<typeof createEma>;
  let ema2: ReturnType<typeof createEma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    ema1 = createEma({ period, source }, { fromState: s.ema1State });
    ema2 = createEma({ period }, { fromState: s.ema2State });
    count = s.count;
  } else {
    ema1 = createEma({ period, source });
    ema2 = createEma({ period });
    count = 0;
  }

  function cascade(candle: NormalizedCandle, peek: boolean): number | null {
    const fn = peek ? "peek" : "next";
    const v1 = ema1[fn](candle).value;
    if (v1 === null) return null;

    const v2 = ema2[fn](makeCandle(candle.time, v1)).value;
    if (v2 === null) return null;

    return 2 * v1 - v2;
  }

  const indicator: IncrementalIndicator<number | null, DemaState> = {
    next(candle: NormalizedCandle) {
      count++;
      return { time: candle.time, value: cascade(candle, false) };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: cascade(candle, true) };
    },

    getState(): DemaState {
      return {
        period,
        source,
        ema1State: ema1.getState(),
        ema2State: ema2.getState(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return ema2.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
