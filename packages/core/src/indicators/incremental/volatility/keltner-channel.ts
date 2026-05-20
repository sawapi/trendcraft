/**
 * Incremental Keltner Channel
 *
 * Composite indicator: EMA (middle band) + ATR (band width).
 * Middle Band = EMA(close)
 * Upper Band = EMA + multiplier × ATR
 * Lower Band = EMA - multiplier × ATR
 *
 * State category: **Mixed** (an inner recursive EMA snapshot and an
 * inner recursive ATR snapshot, composed in parallel). Resume with a
 * different `emaPeriod` / `atrPeriod` is refused.
 *
 * `multiplier` is a **resume-invariant param**: it only scales the
 * final `EMA ± multiplier × ATR` band width and never touches the
 * inner EMA / ATR state. Changing it on resume is mathematically safe
 * and stays supported (parity with 0.3.x). See STATE_CONTRACT.md §2.4.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { createEma, type EmaState } from "../moving-average/ema";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { type AtrState, createAtr } from "../volatility/atr";

/**
 * Keltner Channel output value
 */
export type KeltnerChannelValue = {
  upper: number | null;
  middle: number | null;
  lower: number | null;
};

/**
 * Bare state shape for Keltner Channel. Params (`emaPeriod`,
 * `atrPeriod`, `multiplier`) live in `meta.params` on the wire.
 */
export type KeltnerChannelState = {
  emaState: IndicatorSnapshot<EmaState>;
  atrState: IndicatorSnapshot<AtrState>;
  count: number;
};

export const KELTNER_CHANNEL_VERSION = 1;

type KeltnerChannelParams = {
  emaPeriod: number;
  atrPeriod: number;
  multiplier: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<KeltnerChannelState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<KeltnerChannelValue, IndicatorSnapshot<KeltnerChannelState>> {
  const { params, state } = resolveResume<KeltnerChannelParams, KeltnerChannelState>({
    indicator: "keltnerChannel",
    version: KELTNER_CHANNEL_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 },
    resumeInvariantParams: ["multiplier"],
  });

  const emaPeriod = requireParam(
    "keltnerChannel",
    params,
    "emaPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const atrPeriod = requireParam(
    "keltnerChannel",
    params,
    "atrPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const multiplier = requireParam(
    "keltnerChannel",
    params,
    "multiplier",
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
    "must be a positive number",
  );

  let emaInd: IncrementalIndicator<number | null, IndicatorSnapshot<EmaState>>;
  let atrInd: IncrementalIndicator<number | null, IndicatorSnapshot<AtrState>>;
  let count: number;

  if (state !== null) {
    emaInd = createEma({ period: emaPeriod, source: "close" }, { fromState: state.emaState });
    atrInd = createAtr({ period: atrPeriod }, { fromState: state.atrState });
    count = state.count;
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

  const indicator: IncrementalIndicator<
    KeltnerChannelValue,
    IndicatorSnapshot<KeltnerChannelState>
  > = {
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

    getState(): IndicatorSnapshot<KeltnerChannelState> {
      return makeSnapshot(
        "keltnerChannel",
        KELTNER_CHANNEL_VERSION,
        { emaPeriod, atrPeriod, multiplier },
        {
          emaState: emaInd.getState(),
          atrState: atrInd.getState(),
          count,
        },
      );
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
