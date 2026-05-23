/**
 * Incremental DEMA (Double Exponential Moving Average)
 *
 * DEMA = 2 * EMA1 - EMA2
 * where EMA2 = EMA(EMA1, period)
 *
 * State category: **Cascaded** (two recursive EMA stages composed in
 * series). Resume with different `period` / `source` is refused — both
 * inner EMAs are permanently conditioned on their construction-time
 * params.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<DemaState>` and `fromState` accepts the same.
 * Params (`period`, `source`) live in `meta.params`; the bare state
 * holds only the two inner EMA snapshots plus `count`.
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

export type DemaState = {
  ema1State: IndicatorSnapshot<EmaState>;
  ema2State: IndicatorSnapshot<EmaState>;
  count: number;
};

export const DEMA_VERSION = 1;

type DemaParams = {
  period: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<DemaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<DemaState>> {
  const { params, state } = resolveResume<DemaParams, DemaState>({
    indicator: "dema",
    version: DEMA_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, source: "close" },
  });

  const period = requireParam(
    "dema",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let ema1: ReturnType<typeof createEma>;
  let ema2: ReturnType<typeof createEma>;
  let count: number;

  if (state !== null) {
    ema1 = createEma({ period, source }, { fromState: state.ema1State });
    ema2 = createEma({ period }, { fromState: state.ema2State });
    count = state.count;
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

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<DemaState>> = {
    next(candle: NormalizedCandle) {
      count++;
      return { time: candle.time, value: cascade(candle, false) };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: cascade(candle, true) };
    },

    getState(): IndicatorSnapshot<DemaState> {
      return makeSnapshot(
        "dema",
        DEMA_VERSION,
        { period, source },
        {
          ema1State: ema1.getState(),
          ema2State: ema2.getState(),
          count,
        },
      );
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
