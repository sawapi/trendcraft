/**
 * Incremental ADXR (Average Directional Movement Index Rating)
 *
 * ADXR = (ADX[current] + ADX[current - (period - 1)]) / 2
 * Wraps createDmi and maintains a circular buffer of ADX history.
 *
 * State category: **Mixed** (an inner recursive DMI snapshot plus a
 * windowed ADX lag-lookback buffer). Resume with different params is
 * refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import type { DmiState } from "./dmi";
import { createDmi } from "./dmi";

export type AdxrState = {
  dmiState: IndicatorSnapshot<DmiState>;
  adxBuffer: ReturnType<CircularBuffer<number | null>["snapshot"]>;
  count: number;
};

export const ADXR_VERSION = 1;

type AdxrParams = {
  period: number;
  dmiPeriod: number;
  adxPeriod: number;
};

/**
 * Create an incremental ADXR indicator
 *
 * @example
 * ```ts
 * const adxr = createAdxr({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = adxr.next(candle);
 *   if (adxr.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createAdxr(
  options: { period?: number; dmiPeriod?: number; adxPeriod?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AdxrState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<AdxrState>> {
  const { params, state } = resolveResume<AdxrParams, AdxrState>({
    indicator: "adxr",
    version: ADXR_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, dmiPeriod: 14, adxPeriod: 14 },
  });

  const period = requireParam(
    "adxr",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const dmiPeriod = requireParam(
    "adxr",
    params,
    "dmiPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const adxPeriod = requireParam(
    "adxr",
    params,
    "adxPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  // ADXR lookback matches TA-Lib: adx[i] + adx[i-(period-1)]
  const lookback = period - 1;

  let dmiInd: ReturnType<typeof createDmi>;
  let adxBuffer: CircularBuffer<number | null>;
  let count: number;

  if (state !== null) {
    dmiInd = createDmi({ period: dmiPeriod, adxPeriod }, { fromState: state.dmiState });
    adxBuffer = CircularBuffer.fromSnapshot(state.adxBuffer);
    count = state.count;
  } else {
    dmiInd = createDmi({ period: dmiPeriod, adxPeriod });
    // Buffer needs to hold at least lookback+1 values to access the past ADX
    adxBuffer = new CircularBuffer<number | null>(lookback + 1);
    count = 0;
  }

  function computeAdxr(currentAdx: number | null): number | null {
    if (currentAdx === null) return null;
    if (adxBuffer.length < lookback) return null;

    // The oldest value in the buffer when full represents adx[i - lookback]
    const pastAdx = adxBuffer.get(adxBuffer.length - lookback);
    if (pastAdx === null) return null;

    return (currentAdx + pastAdx) / 2;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<AdxrState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const dmiResult = dmiInd.next(candle);
      const currentAdx = dmiResult.value.adx;
      const value = computeAdxr(currentAdx);
      adxBuffer.push(currentAdx);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const dmiResult = dmiInd.peek(candle);
      const currentAdx = dmiResult.value.adx;

      if (currentAdx === null) return { time: candle.time, value: null };
      if (adxBuffer.length < lookback) return { time: candle.time, value: null };

      const pastAdx = adxBuffer.get(adxBuffer.length - lookback);
      if (pastAdx === null) return { time: candle.time, value: null };

      return { time: candle.time, value: (currentAdx + pastAdx) / 2 };
    },

    getState(): IndicatorSnapshot<AdxrState> {
      return makeSnapshot(
        "adxr",
        ADXR_VERSION,
        { period, dmiPeriod, adxPeriod },
        {
          dmiState: dmiInd.getState(),
          adxBuffer: adxBuffer.snapshot(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return adxBuffer.length > lookback && adxBuffer.get(adxBuffer.length - lookback) !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
