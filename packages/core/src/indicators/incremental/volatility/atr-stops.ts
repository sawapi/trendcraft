/**
 * Incremental ATR Stops
 *
 * Composes the incremental ATR indicator to compute stop-loss and
 * take-profit levels based on ATR distance from the current close.
 *
 * State category: **Mixed** (an inner recursive ATR snapshot). Resume
 * with a different `period` is refused. `stopMultiplier` /
 * `takeProfitMultiplier` are resume-invariant — they only scale the
 * final stop / take-profit levels, never the ATR state.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { AtrStopsValue, NormalizedCandle } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { type AtrState, createAtr } from "./atr";

export type AtrStopsState = {
  atrState: IndicatorSnapshot<AtrState>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ATR_STOPS_VERSION = 1;

type AtrStopsParams = {
  period: number;
  stopMultiplier: number;
  takeProfitMultiplier: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AtrStopsState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<AtrStopsValue, IndicatorSnapshot<AtrStopsState>> {
  const { params, state } = resolveResume<AtrStopsParams, AtrStopsState>({
    indicator: "atrStops",
    version: ATR_STOPS_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, stopMultiplier: 2.0, takeProfitMultiplier: 3.0 },
    resumeInvariantParams: ["stopMultiplier", "takeProfitMultiplier"],
  });

  const period = requireParam(
    "atrStops",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const stopMultiplier = requireParam(
    "atrStops",
    params,
    "stopMultiplier",
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
    "must be a positive number",
  );
  const takeProfitMultiplier = requireParam(
    "atrStops",
    params,
    "takeProfitMultiplier",
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
    "must be a positive number",
  );

  let count: number;
  let atr: IncrementalIndicator<number | null, IndicatorSnapshot<AtrState>>;

  if (state !== null) {
    count = state.count;
    atr = createAtr({ period }, { fromState: state.atrState });
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

  const indicator: IncrementalIndicator<AtrStopsValue, IndicatorSnapshot<AtrStopsState>> = {
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

    getState(): IndicatorSnapshot<AtrStopsState> {
      return makeSnapshot(
        "atrStops",
        ATR_STOPS_VERSION,
        { period, stopMultiplier, takeProfitMultiplier },
        { atrState: atr.getState(), count },
      );
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
