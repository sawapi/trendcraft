/**
 * Incremental TEMA (Triple Exponential Moving Average)
 *
 * TEMA = 3 * EMA1 - 3 * EMA2 + EMA3
 * where EMA2 = EMA(EMA1, period), EMA3 = EMA(EMA2, period)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";
import { createEma } from "./ema";
import type { EmaState } from "./ema";

export type TemaState = {
  period: number;
  source: PriceSource;
  ema1State: EmaState;
  ema2State: EmaState;
  ema3State: EmaState;
  count: number;
};

/**
 * Create an incremental TEMA indicator
 *
 * @example
 * ```ts
 * const tema = createTema({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = tema.next(candle);
 *   if (tema.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createTema(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<TemaState>,
): IncrementalIndicator<number | null, TemaState> {
  const period = options.period ?? 20;
  const source: PriceSource = options.source ?? "close";

  let ema1: ReturnType<typeof createEma>;
  let ema2: ReturnType<typeof createEma>;
  let ema3: ReturnType<typeof createEma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    ema1 = createEma({ period, source }, { fromState: s.ema1State });
    ema2 = createEma({ period }, { fromState: s.ema2State });
    ema3 = createEma({ period }, { fromState: s.ema3State });
    count = s.count;
  } else {
    ema1 = createEma({ period, source });
    ema2 = createEma({ period });
    ema3 = createEma({ period });
    count = 0;
  }

  function cascade(candle: NormalizedCandle, peek: boolean): number | null {
    const fn = peek ? "peek" : "next";
    const v1 = ema1[fn](candle).value;
    if (v1 === null) return null;

    const v2 = ema2[fn](makeCandle(candle.time, v1)).value;
    if (v2 === null) return null;

    const v3 = ema3[fn](makeCandle(candle.time, v2)).value;
    if (v3 === null) return null;

    return 3 * v1 - 3 * v2 + v3;
  }

  const indicator: IncrementalIndicator<number | null, TemaState> = {
    next(candle: NormalizedCandle) {
      count++;
      return { time: candle.time, value: cascade(candle, false) };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: cascade(candle, true) };
    },

    getState(): TemaState {
      return {
        period,
        source,
        ema1State: ema1.getState(),
        ema2State: ema2.getState(),
        ema3State: ema3.getState(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return ema3.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
