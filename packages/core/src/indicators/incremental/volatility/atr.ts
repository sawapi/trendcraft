/**
 * Incremental ATR (Average True Range)
 *
 * Uses Wilder's smoothing method for consistency with batch implementation.
 *
 * State category: **Recursive** (`atr` is the recursive accumulator;
 * `trSum` is the warmup tally baked into the first ATR at
 * `count === period + 1`). Resume with a different `period` is
 * mathematically undefined and refused.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<AtrState>` and `fromState` accepts the same.
 */

import type { NormalizedCandle } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for ATR. Param (`period`) lives in `meta.params`.
 */
export type AtrState = {
  prevClose: number | null;
  atr: number | null;
  trSum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ATR_VERSION = 1;

type AtrParams = {
  period: number;
};

/**
 * Create an incremental ATR indicator (Wilder's method)
 *
 * @example
 * ```ts
 * const atr14 = createAtr({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = atr14.next(candle);
 *   if (atr14.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createAtr(
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AtrState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<AtrState>> {
  const { params, state } = resolveResume<AtrParams, AtrState>({
    indicator: "atr",
    version: ATR_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14 },
  });

  const period = requireParam(
    "atr",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let prevClose: number | null;
  let atrValue: number | null;
  let trSum: number;
  let count: number;

  if (state !== null) {
    prevClose = state.prevClose;
    atrValue = state.atr;
    trSum = state.trSum;
    count = state.count;
  } else {
    prevClose = null;
    atrValue = null;
    trSum = 0;
    count = 0;
  }

  function calculateTR(candle: NormalizedCandle, pc: number): number {
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - pc),
      Math.abs(candle.low - pc),
    );
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<AtrState>> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        // First candle: no TR (TR[0] = 0 in TA-Lib convention)
        prevClose = candle.close;
        return { time: candle.time, value: null };
      }

      const tr = calculateTR(candle, prevClose);
      prevClose = candle.close;

      // count=1 was the first candle (no TR), count=2..period: accumulate TR
      // First ATR at count = period + 1 (index = period in 0-based)
      if (count <= period) {
        trSum += tr;
        return { time: candle.time, value: null };
      }

      if (count === period + 1) {
        // First ATR = simple average of TR[1..period]
        trSum += tr;
        atrValue = trSum / period;
        return { time: candle.time, value: atrValue };
      }

      // Wilder's smoothing: ((prevATR * (period - 1)) + currentTR) / period
      atrValue = ((atrValue ?? 0) * (period - 1) + tr) / period;
      return { time: candle.time, value: atrValue };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null || count < period) {
        return { time: candle.time, value: null };
      }

      const tr = calculateTR(candle, prevClose);

      if (count === period) {
        const peekAtr = (trSum + tr) / period;
        return { time: candle.time, value: peekAtr };
      }

      const peekAtr = ((atrValue ?? 0) * (period - 1) + tr) / period;
      return { time: candle.time, value: peekAtr };
    },

    getState(): IndicatorSnapshot<AtrState> {
      return makeSnapshot(
        "atr",
        ATR_VERSION,
        { period },
        { prevClose, atr: atrValue, trSum, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count > period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
