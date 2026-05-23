/**
 * Incremental Stochastics
 *
 * Implements %K and %D using sliding window min/max + SMA smoothing.
 *
 * State category: **Mixed** (raw high/low buffers feed derived rawK /
 * K buffers and their running sums). The rawK / K buffers hold values
 * derived from the whole `kPeriod` / `slowing` windows, so a param
 * change cannot be reconciled — resume with different
 * `kPeriod` / `dPeriod` / `slowing` is refused.
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

export type StochasticsValue = {
  k: number | null;
  d: number | null;
};

/**
 * Bare state shape for Stochastics. Params (`kPeriod`, `dPeriod`,
 * `slowing`) live in `meta.params` on the wire.
 */
export type StochasticsState = {
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  rawKBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  kBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  rawKSum: number;
  rawKValidCount: number;
  kSum: number;
  kValidCount: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const STOCHASTICS_VERSION = 1;

type StochasticsParams = {
  kPeriod: number;
  dPeriod: number;
  slowing: number;
};

/**
 * Create an incremental Stochastics indicator
 *
 * @example
 * ```ts
 * const stoch = createStochastics({ kPeriod: 14, dPeriod: 3, slowing: 3 });
 * for (const candle of stream) {
 *   const { value } = stoch.next(candle);
 *   if (stoch.isWarmedUp) console.log(value.k, value.d);
 * }
 * ```
 */
export function createStochastics(
  options: { kPeriod?: number; dPeriod?: number; slowing?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<StochasticsState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<StochasticsValue, IndicatorSnapshot<StochasticsState>> {
  const { params, state } = resolveResume<StochasticsParams, StochasticsState>({
    indicator: "stochastics",
    version: STOCHASTICS_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { kPeriod: 14, dPeriod: 3, slowing: 3 },
  });

  const isPositiveInt = (v: number): v is number => Number.isInteger(v) && v >= 1;
  const kPeriod = requireParam(
    "stochastics",
    params,
    "kPeriod",
    isPositiveInt,
    "must be a positive integer",
  );
  const dPeriod = requireParam(
    "stochastics",
    params,
    "dPeriod",
    isPositiveInt,
    "must be a positive integer",
  );
  const slowing = requireParam(
    "stochastics",
    params,
    "slowing",
    isPositiveInt,
    "must be a positive integer",
  );

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let rawKBuffer: CircularBuffer<number>;
  let kBuffer: CircularBuffer<number>;
  let rawKSum: number;
  let rawKValidCount: number;
  let kSum: number;
  let kValidCount: number;
  let count: number;

  if (state !== null) {
    highBuffer = CircularBuffer.fromSnapshot(state.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(state.lowBuffer);
    rawKBuffer = CircularBuffer.fromSnapshot(state.rawKBuffer);
    kBuffer = CircularBuffer.fromSnapshot(state.kBuffer);
    rawKSum = state.rawKSum;
    rawKValidCount = state.rawKValidCount;
    kSum = state.kSum;
    kValidCount = state.kValidCount;
    count = state.count;
  } else {
    highBuffer = new CircularBuffer<number>(kPeriod);
    lowBuffer = new CircularBuffer<number>(kPeriod);
    rawKBuffer = new CircularBuffer<number>(slowing);
    kBuffer = new CircularBuffer<number>(dPeriod);
    rawKSum = 0;
    rawKValidCount = 0;
    kSum = 0;
    kValidCount = 0;
    count = 0;
  }

  function getHighestHigh(): number {
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < highBuffer.length; i++) {
      if (highBuffer.get(i) > max) max = highBuffer.get(i);
    }
    return max;
  }

  function getLowestLow(): number {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < lowBuffer.length; i++) {
      if (lowBuffer.get(i) < min) min = lowBuffer.get(i);
    }
    return min;
  }

  const nullValue: StochasticsValue = { k: null, d: null };

  const indicator: IncrementalIndicator<StochasticsValue, IndicatorSnapshot<StochasticsState>> = {
    next(candle: NormalizedCandle) {
      count++;

      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);

      // Step 1: Raw %K
      if (count < kPeriod) {
        return { time: candle.time, value: nullValue };
      }

      const highestHigh = getHighestHigh();
      const lowestLow = getLowestLow();
      const range = highestHigh - lowestLow;
      const rawK = range === 0 ? 50 : (100 * (candle.close - lowestLow)) / range;

      // Step 2: SMA of rawK (slowing)
      if (rawKBuffer.isFull) {
        rawKSum = rawKSum - rawKBuffer.oldest() + rawK;
      } else {
        rawKSum += rawK;
      }
      rawKBuffer.push(rawK);
      rawKValidCount++;

      if (rawKValidCount < slowing) {
        return { time: candle.time, value: nullValue };
      }

      const kVal = rawKSum / slowing;

      // Step 3: SMA of K (dPeriod) = %D
      if (kBuffer.isFull) {
        kSum = kSum - kBuffer.oldest() + kVal;
      } else {
        kSum += kVal;
      }
      kBuffer.push(kVal);
      kValidCount++;

      if (kValidCount < dPeriod) {
        return { time: candle.time, value: { k: kVal, d: null } };
      }

      const dVal = kSum / dPeriod;
      return { time: candle.time, value: { k: kVal, d: dVal } };
    },

    peek(candle: NormalizedCandle) {
      if (count + 1 < kPeriod) {
        return { time: candle.time, value: nullValue };
      }

      // Would need to compute peek of sliding window - approximate with current state
      // For peek accuracy, this is a simplified version
      let maxH = candle.high;
      let minL = candle.low;
      const hLen = highBuffer.length;
      const skip = hLen >= kPeriod ? 1 : 0;
      for (let i = skip; i < hLen; i++) {
        if (highBuffer.get(i) > maxH) maxH = highBuffer.get(i);
        if (lowBuffer.get(i) < minL) minL = lowBuffer.get(i);
      }

      const range = maxH - minL;
      const rawK = range === 0 ? 50 : (100 * (candle.close - minL)) / range;

      const peekRawKValidCount = rawKValidCount + 1;
      if (peekRawKValidCount < slowing) {
        return { time: candle.time, value: nullValue };
      }

      let peekRawKSum = rawKSum;
      if (rawKBuffer.isFull) {
        peekRawKSum = peekRawKSum - rawKBuffer.oldest() + rawK;
      } else {
        peekRawKSum += rawK;
      }
      const kVal = peekRawKSum / slowing;

      const peekKValidCount = kValidCount + 1;
      if (peekKValidCount < dPeriod) {
        return { time: candle.time, value: { k: kVal, d: null } };
      }

      let peekKSum = kSum;
      if (kBuffer.isFull) {
        peekKSum = peekKSum - kBuffer.oldest() + kVal;
      } else {
        peekKSum += kVal;
      }
      const dVal = peekKSum / dPeriod;
      return { time: candle.time, value: { k: kVal, d: dVal } };
    },

    getState(): IndicatorSnapshot<StochasticsState> {
      return makeSnapshot(
        "stochastics",
        STOCHASTICS_VERSION,
        { kPeriod, dPeriod, slowing },
        {
          highBuffer: highBuffer.snapshot(),
          lowBuffer: lowBuffer.snapshot(),
          rawKBuffer: rawKBuffer.snapshot(),
          kBuffer: kBuffer.snapshot(),
          rawKSum,
          rawKValidCount,
          kSum,
          kValidCount,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return kValidCount >= dPeriod;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
