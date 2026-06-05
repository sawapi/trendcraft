/**
 * Incremental TEMA (Triple Exponential Moving Average)
 *
 * TEMA = 3 * EMA1 - 3 * EMA2 + EMA3
 * where EMA2 = EMA(EMA1, period), EMA3 = EMA(EMA2, period)
 *
 * State category: **Cascaded** (three recursive EMA stages composed in
 * series). Resume with different `period` / `source` is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { makeCandle } from "../utils";
import type { EmaState } from "./ema";
import { createEma } from "./ema";

export type TemaState = {
  ema1State: IndicatorSnapshot<EmaState>;
  ema2State: IndicatorSnapshot<EmaState>;
  ema3State: IndicatorSnapshot<EmaState>;
  count: number;
};

export const TEMA_VERSION = 1;

type TemaParams = {
  period: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<TemaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<TemaState>> {
  const { params, state } = resolveResume<TemaParams, TemaState>({
    indicator: "tema",
    version: TEMA_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, source: "close" },
  });

  const period = requireParam(
    "tema",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let ema1: ReturnType<typeof createEma>;
  let ema2: ReturnType<typeof createEma>;
  let ema3: ReturnType<typeof createEma>;
  let count: number;

  if (state !== null) {
    ema1 = createEma({ period, source }, { fromState: state.ema1State });
    ema2 = createEma({ period }, { fromState: state.ema2State });
    ema3 = createEma({ period }, { fromState: state.ema3State });
    count = state.count;
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

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<TemaState>> = {
    next(candle: NormalizedCandle) {
      count++;
      return { time: candle.time, value: cascade(candle, false) };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: cascade(candle, true) };
    },

    getState(): IndicatorSnapshot<TemaState> {
      return makeSnapshot(
        "tema",
        TEMA_VERSION,
        { period, source },
        {
          ema1State: ema1.getState(),
          ema2State: ema2.getState(),
          ema3State: ema3.getState(),
          count,
        },
      );
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
