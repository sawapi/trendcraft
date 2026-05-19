/**
 * Incremental T3 (Tillson T3 Moving Average)
 *
 * T3 = c1*e6 + c2*e5 + c3*e4 + c4*e3
 * where e1..e6 are cascaded EMAs and c1..c4 are volume factor coefficients.
 *
 * State category: **Cascaded** (six recursive EMA stages composed in
 * series). Resume with different `period` / `vFactor` / `source` is
 * refused.
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

export type T3State = {
  ema1State: IndicatorSnapshot<EmaState>;
  ema2State: IndicatorSnapshot<EmaState>;
  ema3State: IndicatorSnapshot<EmaState>;
  ema4State: IndicatorSnapshot<EmaState>;
  ema5State: IndicatorSnapshot<EmaState>;
  ema6State: IndicatorSnapshot<EmaState>;
  count: number;
};

export const T3_VERSION = 1;

type T3Params = {
  period: number;
  vFactor: number;
  source: PriceSource;
};

/**
 * Create an incremental T3 indicator
 *
 * @example
 * ```ts
 * const t3 = createT3({ period: 5, vFactor: 0.7 });
 * for (const candle of stream) {
 *   const { value } = t3.next(candle);
 *   if (t3.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createT3(
  options: { period?: number; vFactor?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<T3State>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<T3State>> {
  const { params, state } = resolveResume<T3Params, T3State>({
    indicator: "t3",
    version: T3_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 5, vFactor: 0.7, source: "close" },
  });

  const period = requireParam(
    "t3",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const vFactor = params.vFactor;
  const source = params.source;

  // T3 coefficients derived from volume factor
  const v2 = vFactor * vFactor;
  const v3 = v2 * vFactor;
  const c1 = -v3;
  const c2 = 3 * v2 + 3 * v3;
  const c3 = -6 * v2 - 3 * vFactor - 3 * v3;
  const c4 = 1 + 3 * vFactor + v3 + 3 * v2;

  let ema1: ReturnType<typeof createEma>;
  let ema2: ReturnType<typeof createEma>;
  let ema3: ReturnType<typeof createEma>;
  let ema4: ReturnType<typeof createEma>;
  let ema5: ReturnType<typeof createEma>;
  let ema6: ReturnType<typeof createEma>;
  let count: number;

  if (state !== null) {
    ema1 = createEma({ period, source }, { fromState: state.ema1State });
    ema2 = createEma({ period }, { fromState: state.ema2State });
    ema3 = createEma({ period }, { fromState: state.ema3State });
    ema4 = createEma({ period }, { fromState: state.ema4State });
    ema5 = createEma({ period }, { fromState: state.ema5State });
    ema6 = createEma({ period }, { fromState: state.ema6State });
    count = state.count;
  } else {
    ema1 = createEma({ period, source });
    ema2 = createEma({ period });
    ema3 = createEma({ period });
    ema4 = createEma({ period });
    ema5 = createEma({ period });
    ema6 = createEma({ period });
    count = 0;
  }

  function cascade(candle: NormalizedCandle, peek: boolean): number | null {
    const fn = peek ? "peek" : "next";
    const v1 = ema1[fn](candle).value;
    if (v1 === null) return null;

    const c1Candle = makeCandle(candle.time, v1);
    const v2 = ema2[fn](c1Candle).value;
    if (v2 === null) return null;

    const c2Candle = makeCandle(candle.time, v2);
    const v3 = ema3[fn](c2Candle).value;
    if (v3 === null) return null;

    const c3Candle = makeCandle(candle.time, v3);
    const v4 = ema4[fn](c3Candle).value;
    if (v4 === null) return null;

    const c4Candle = makeCandle(candle.time, v4);
    const v5 = ema5[fn](c4Candle).value;
    if (v5 === null) return null;

    const c5Candle = makeCandle(candle.time, v5);
    const v6 = ema6[fn](c5Candle).value;
    if (v6 === null) return null;

    return c1 * v6 + c2 * v5 + c3 * v4 + c4 * v3;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<T3State>> = {
    next(candle: NormalizedCandle) {
      count++;
      return { time: candle.time, value: cascade(candle, false) };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: cascade(candle, true) };
    },

    getState(): IndicatorSnapshot<T3State> {
      return makeSnapshot(
        "t3",
        T3_VERSION,
        { period, vFactor, source },
        {
          ema1State: ema1.getState(),
          ema2State: ema2.getState(),
          ema3State: ema3.getState(),
          ema4State: ema4.getState(),
          ema5State: ema5.getState(),
          ema6State: ema6.getState(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return ema6.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
