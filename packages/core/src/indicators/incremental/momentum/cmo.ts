/**
 * Incremental CMO (Chande Momentum Oscillator)
 *
 * CMO = 100 × (AvgGain - AvgLoss) / (AvgGain + AvgLoss)
 * Uses Wilder's smoothing method (same as RSI).
 *
 * State category: **Recursive** (`avgUp` / `avgDown` are the recursive
 * accumulators; `initialUps` / `initialDowns` form the warmup tally).
 * Resume with a different `period` / `source` is refused.
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
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for CMO. Params (`period`, `source`) live in
 * `meta.params` on the wire.
 */
export type CmoState = {
  prevClose: number | null;
  avgUp: number;
  avgDown: number;
  count: number;
  initialUps: number[];
  initialDowns: number[];
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const CMO_VERSION = 1;

type CmoParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental CMO indicator
 *
 * @example
 * ```ts
 * const cmo = createCmo({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = cmo.next(candle);
 *   if (cmo.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createCmo(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<CmoState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<CmoState>> {
  const { params, state } = resolveResume<CmoParams, CmoState>({
    indicator: "cmo",
    version: CMO_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, source: "close" },
  });

  const period = requireParam(
    "cmo",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let prevClose: number | null;
  let avgUp: number;
  let avgDown: number;
  let count: number;
  let initialUps: number[];
  let initialDowns: number[];

  if (state !== null) {
    prevClose = state.prevClose;
    avgUp = state.avgUp;
    avgDown = state.avgDown;
    count = state.count;
    initialUps = [...state.initialUps];
    initialDowns = [...state.initialDowns];
  } else {
    prevClose = null;
    avgUp = 0;
    avgDown = 0;
    count = 0;
    initialUps = [];
    initialDowns = [];
  }

  function computeCmo(au: number, ad: number): number {
    const total = au + ad;
    return total === 0 ? 0 : (100 * (au - ad)) / total;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<CmoState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      if (prevClose === null) {
        prevClose = price;
        return { time: candle.time, value: null };
      }

      const diff = price - prevClose;
      const up = diff > 0 ? diff : 0;
      const down = diff < 0 ? -diff : 0;
      prevClose = price;

      // count includes current candle. Need period+1 candles for first value.
      if (count <= period) {
        initialUps.push(up);
        initialDowns.push(down);
        return { time: candle.time, value: null };
      }

      if (count === period + 1) {
        initialUps.push(up);
        initialDowns.push(down);
        avgUp = initialUps.reduce((s, v) => s + v, 0) / period;
        avgDown = initialDowns.reduce((s, v) => s + v, 0) / period;
        initialUps = [];
        initialDowns = [];
        return { time: candle.time, value: computeCmo(avgUp, avgDown) };
      }

      // Wilder's smoothing
      avgUp = (avgUp * (period - 1) + up) / period;
      avgDown = (avgDown * (period - 1) + down) / period;

      return { time: candle.time, value: computeCmo(avgUp, avgDown) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (prevClose === null || count < period) {
        return { time: candle.time, value: null };
      }

      const diff = price - prevClose;
      const up = diff > 0 ? diff : 0;
      const down = diff < 0 ? -diff : 0;

      if (count === period) {
        const ups = [...initialUps, up];
        const downs = [...initialDowns, down];
        const au = ups.reduce((s, v) => s + v, 0) / period;
        const ad = downs.reduce((s, v) => s + v, 0) / period;
        return { time: candle.time, value: computeCmo(au, ad) };
      }

      const peekAvgUp = (avgUp * (period - 1) + up) / period;
      const peekAvgDown = (avgDown * (period - 1) + down) / period;

      return { time: candle.time, value: computeCmo(peekAvgUp, peekAvgDown) };
    },

    getState(): IndicatorSnapshot<CmoState> {
      return makeSnapshot(
        "cmo",
        CMO_VERSION,
        { period, source },
        {
          prevClose,
          avgUp,
          avgDown,
          count,
          initialUps: [...initialUps],
          initialDowns: [...initialDowns],
        },
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
