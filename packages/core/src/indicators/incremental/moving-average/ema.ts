/**
 * Incremental EMA (Exponential Moving Average)
 *
 * State category: **Recursive** (`prevEma` is the recursive
 * accumulator; `sum` is a warmup tally that gets baked into `prevEma`
 * at `count === period` and is no longer consulted afterwards).
 * Resume with different `period` / `source` is mathematically
 * undefined — the recursive accumulator is permanently conditioned on
 * its construction-time params — and is refused.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<EmaState>` and `fromState` accepts the same.
 * Params (`period`, `source`) now live in `meta.params`; the
 * derived `multiplier` (= `2 / (period + 1)`) is computed in the
 * factory closure rather than persisted, since it is uniquely
 * determined by `period`. The factory signature is unchanged
 * `(options, warmUpOptions?)` — direct callers do not need to
 * change call shape; only the snapshot envelope returned by
 * `getState()` (and accepted by `fromState`) changes.
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
 * Bare state shape for EMA. Params (`period`, `source`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 * `multiplier` is derived from `period` in the factory closure and
 * also intentionally absent from the persisted state.
 */
export type EmaState = {
  prevEma: number | null;
  sum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const EMA_VERSION = 1;

type EmaParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental EMA indicator
 *
 * @example
 * ```ts
 * const ema20 = createEma({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = ema20.next(candle);
 *   if (ema20.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createEma(
  options: { period?: number; source?: PriceSource },
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<EmaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<EmaState>> {
  const { params, state } = resolveResume<EmaParams, EmaState>({
    indicator: "ema",
    version: EMA_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { source: "close" },
  });

  const period = requireParam(
    "ema",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const multiplier = 2 / (period + 1);

  let prevEma: number | null;
  let sum: number;
  let count: number;

  if (state !== null) {
    prevEma = state.prevEma;
    sum = state.sum;
    count = state.count;
  } else {
    prevEma = null;
    sum = 0;
    count = 0;
  }

  function computeValue(price: number, currentCount: number): number | null {
    if (currentCount < period) {
      return null;
    }
    if (currentCount === period) {
      // First EMA = SMA of first 'period' values
      return (sum + price) / period;
    }
    // EMA = price * multiplier + prevEma * (1 - multiplier)
    const prev = prevEma ?? 0; // guaranteed non-null when currentCount > period
    return price * multiplier + prev * (1 - multiplier);
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<EmaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      if (count < period) {
        sum += price;
        prevEma = null;
        return { time: candle.time, value: null };
      }

      if (count === period) {
        sum += price;
        prevEma = sum / period;
        return { time: candle.time, value: prevEma };
      }

      // Standard EMA calculation (prevEma guaranteed non-null after count === period)
      prevEma = price * multiplier + (prevEma ?? 0) * (1 - multiplier);
      return { time: candle.time, value: prevEma };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const value = computeValue(price, count + 1);
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<EmaState> {
      return makeSnapshot("ema", EMA_VERSION, { period, source }, { prevEma, sum, count });
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
