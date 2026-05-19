/**
 * Incremental TSI (True Strength Index)
 *
 * TSI = 100 * EMA(EMA(momentum, longPeriod), shortPeriod) / EMA(EMA(|momentum|, longPeriod), shortPeriod)
 * Signal = EMA(TSI, signalPeriod)
 *
 * Uses 5 internal EMAs: 2 for the momentum path, 2 for the absolute momentum path,
 * and 1 for the signal line.
 *
 * State category: **Cascaded** (five recursive EMA stages plus the
 * `prevPrice` recursive accumulator). Resume with different periods /
 * source is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { EmaState } from "../moving-average/ema";
import { createEma } from "../moving-average/ema";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice, makeCandle } from "../utils";

export type TsiValue = {
  tsi: number;
  signal: number | null;
};

export type TsiState = {
  ema1MomState: IndicatorSnapshot<EmaState>;
  ema2MomState: IndicatorSnapshot<EmaState>;
  ema1AbsState: IndicatorSnapshot<EmaState>;
  ema2AbsState: IndicatorSnapshot<EmaState>;
  signalEmaState: IndicatorSnapshot<EmaState>;
  prevPrice: number | null;
  count: number;
};

export const TSI_VERSION = 1;

type TsiParams = {
  longPeriod: number;
  shortPeriod: number;
  signalPeriod: number;
  source: PriceSource;
};

/**
 * Create an incremental True Strength Index indicator
 *
 * @example
 * ```ts
 * const tsi = createTsi({ longPeriod: 25, shortPeriod: 13, signalPeriod: 7 });
 * for (const candle of stream) {
 *   const { value } = tsi.next(candle);
 *   if (value !== null) console.log(value.tsi, value.signal);
 * }
 * ```
 */
export function createTsi(
  options: {
    longPeriod?: number;
    shortPeriod?: number;
    signalPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<TsiState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<TsiValue | null, IndicatorSnapshot<TsiState>> {
  const { params, state } = resolveResume<TsiParams, TsiState>({
    indicator: "tsi",
    version: TSI_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { longPeriod: 25, shortPeriod: 13, signalPeriod: 7, source: "close" },
  });

  const longPeriod = requireParam(
    "tsi",
    params,
    "longPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const shortPeriod = requireParam(
    "tsi",
    params,
    "shortPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const signalPeriod = requireParam(
    "tsi",
    params,
    "signalPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let ema1Mom: ReturnType<typeof createEma>;
  let ema2Mom: ReturnType<typeof createEma>;
  let ema1Abs: ReturnType<typeof createEma>;
  let ema2Abs: ReturnType<typeof createEma>;
  let signalEma: ReturnType<typeof createEma>;
  let prevPrice: number | null;
  let count: number;

  if (state !== null) {
    ema1Mom = createEma({ period: longPeriod }, { fromState: state.ema1MomState });
    ema2Mom = createEma({ period: shortPeriod }, { fromState: state.ema2MomState });
    ema1Abs = createEma({ period: longPeriod }, { fromState: state.ema1AbsState });
    ema2Abs = createEma({ period: shortPeriod }, { fromState: state.ema2AbsState });
    signalEma = createEma({ period: signalPeriod }, { fromState: state.signalEmaState });
    prevPrice = state.prevPrice;
    count = state.count;
  } else {
    ema1Mom = createEma({ period: longPeriod });
    ema2Mom = createEma({ period: shortPeriod });
    ema1Abs = createEma({ period: longPeriod });
    ema2Abs = createEma({ period: shortPeriod });
    signalEma = createEma({ period: signalPeriod });
    prevPrice = null;
    count = 0;
  }

  function compute(
    candle: NormalizedCandle,
    mutate: boolean,
  ): { time: number; value: TsiValue | null } {
    const price = getSourcePrice(candle, source);

    if (prevPrice === null) {
      if (mutate) {
        prevPrice = price;
        count++;
      }
      return { time: candle.time, value: null };
    }

    const momentum = price - prevPrice;
    const absMomentum = Math.abs(momentum);
    const momCandle = makeCandle(candle.time, momentum);
    const absCandle = makeCandle(candle.time, absMomentum);

    // First EMA layer (long period)
    const v1 = mutate ? ema1Mom.next(momCandle).value : ema1Mom.peek(momCandle).value;
    const v1abs = mutate ? ema1Abs.next(absCandle).value : ema1Abs.peek(absCandle).value;

    // Second EMA layer (short period) - feed results of first layer
    let v2: number | null = null;
    let v2abs: number | null = null;

    if (v1 !== null) {
      const v1Candle = makeCandle(candle.time, v1);
      v2 = mutate ? ema2Mom.next(v1Candle).value : ema2Mom.peek(v1Candle).value;
    }

    if (v1abs !== null) {
      const v1absCandle = makeCandle(candle.time, v1abs);
      v2abs = mutate ? ema2Abs.next(v1absCandle).value : ema2Abs.peek(v1absCandle).value;
    }

    // Compute TSI
    if (v2 === null || v2abs === null || v2abs === 0) {
      if (mutate) {
        prevPrice = price;
        count++;
      }
      return { time: candle.time, value: null };
    }

    const tsiVal = 100 * (v2 / v2abs);
    const tsiCandle = makeCandle(candle.time, tsiVal);
    const sigResult = mutate ? signalEma.next(tsiCandle).value : signalEma.peek(tsiCandle).value;

    if (mutate) {
      prevPrice = price;
      count++;
    }

    return { time: candle.time, value: { tsi: tsiVal, signal: sigResult } };
  }

  const indicator: IncrementalIndicator<TsiValue | null, IndicatorSnapshot<TsiState>> = {
    next(candle: NormalizedCandle) {
      return compute(candle, true);
    },

    peek(candle: NormalizedCandle) {
      return compute(candle, false);
    },

    getState(): IndicatorSnapshot<TsiState> {
      return makeSnapshot(
        "tsi",
        TSI_VERSION,
        { longPeriod, shortPeriod, signalPeriod, source },
        {
          ema1MomState: ema1Mom.getState(),
          ema2MomState: ema2Mom.getState(),
          ema1AbsState: ema1Abs.getState(),
          ema2AbsState: ema2Abs.getState(),
          signalEmaState: signalEma.getState(),
          prevPrice,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // First non-null literal value emerges when both ema2Mom and
      // ema2Abs warm up — `compute()` returns a `null` literal until
      // then. Aligning isWarmedUp to that boundary matches the
      // contract DSL invariant [7]. `signalEma` warms up later but
      // only affects the inner `signal` field; the outer value is
      // already non-null when `tsi` first emerges.
      return ema2Mom.isWarmedUp && ema2Abs.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
