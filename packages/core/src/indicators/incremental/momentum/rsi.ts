/**
 * Incremental RSI (Relative Strength Index)
 *
 * Uses Wilder's smoothing method for consistency with batch implementation.
 *
 * State category: **Recursive** (`avgGain` / `avgLoss` are the recursive
 * accumulators; `initialGains` / `initialLosses` form the warmup tally
 * that gets baked into the averages at `count === period + 1` and is no
 * longer consulted afterwards). Resume with a different `period` /
 * `source` is mathematically undefined — the recursive averages are
 * permanently conditioned on construction-time params — and is refused.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<RsiState>` and `fromState` accepts the same.
 * Params (`period`, `source`) now live in `meta.params`.
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
 * Bare state shape for RSI. Params (`period`, `source`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type RsiState = {
  prevClose: number | null;
  avgGain: number;
  avgLoss: number;
  count: number;
  initialGains: number[];
  initialLosses: number[];
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const RSI_VERSION = 1;

type RsiParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental RSI indicator (Wilder's method)
 *
 * @example
 * ```ts
 * const rsi14 = createRsi({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = rsi14.next(candle);
 *   if (rsi14.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createRsi(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<RsiState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<RsiState>> {
  const { params, state } = resolveResume<RsiParams, RsiState>({
    indicator: "rsi",
    version: RSI_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, source: "close" },
  });

  const period = requireParam(
    "rsi",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let prevClose: number | null;
  let avgGain: number;
  let avgLoss: number;
  let count: number;
  let initialGains: number[];
  let initialLosses: number[];

  if (state !== null) {
    prevClose = state.prevClose;
    avgGain = state.avgGain;
    avgLoss = state.avgLoss;
    count = state.count;
    initialGains = [...state.initialGains];
    initialLosses = [...state.initialLosses];
  } else {
    prevClose = null;
    avgGain = 0;
    avgLoss = 0;
    count = 0;
    initialGains = [];
    initialLosses = [];
  }

  function computeRsi(ag: number, al: number): number | null {
    if (al === 0 && ag === 0) return 50;
    if (al === 0) return 100;
    const rs = ag / al;
    return 100 - 100 / (1 + rs);
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<RsiState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      if (prevClose === null) {
        // First candle: no change to compute
        prevClose = price;
        return { time: candle.time, value: null };
      }

      const change = price - prevClose;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      prevClose = price;

      // count includes current candle. We need period+1 candles to produce first RSI.
      // Candle 1: no change (null), candles 2..period: collect gains/losses, candle period+1: first RSI

      if (count <= period) {
        // Still in initial collection phase (indices 1..period-1 of changes)
        initialGains.push(gain);
        initialLosses.push(loss);
        return { time: candle.time, value: null };
      }

      if (count === period + 1) {
        // First RSI value: simple average of first 'period' gains/losses
        // initialGains/Losses has period-1 values, plus the current one
        initialGains.push(gain);
        initialLosses.push(loss);

        avgGain = initialGains.reduce((s, v) => s + v, 0) / period;
        avgLoss = initialLosses.reduce((s, v) => s + v, 0) / period;

        // Free memory
        initialGains = [];
        initialLosses = [];

        return { time: candle.time, value: computeRsi(avgGain, avgLoss) };
      }

      // Wilder's smoothing: ((prev * (period - 1)) + current) / period
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      return { time: candle.time, value: computeRsi(avgGain, avgLoss) };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null || count < period) {
        return { time: candle.time, value: null };
      }

      const price = getSourcePrice(candle, source);
      const change = price - prevClose;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      if (count === period) {
        // Would be the first RSI value
        const gains = [...initialGains, gain];
        const losses = [...initialLosses, loss];
        const ag = gains.reduce((s, v) => s + v, 0) / period;
        const al = losses.reduce((s, v) => s + v, 0) / period;
        return { time: candle.time, value: computeRsi(ag, al) };
      }

      const peekAvgGain = (avgGain * (period - 1) + gain) / period;
      const peekAvgLoss = (avgLoss * (period - 1) + loss) / period;
      return { time: candle.time, value: computeRsi(peekAvgGain, peekAvgLoss) };
    },

    getState(): IndicatorSnapshot<RsiState> {
      return makeSnapshot(
        "rsi",
        RSI_VERSION,
        { period, source },
        {
          prevClose,
          avgGain,
          avgLoss,
          count,
          initialGains: [...initialGains],
          initialLosses: [...initialLosses],
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
