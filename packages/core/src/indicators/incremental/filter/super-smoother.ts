/**
 * Incremental Ehlers Super Smoother (2-pole IIR filter)
 *
 * Mirrors batch `superSmoother()` exactly: emits `null` for the first two
 * bars (seeds the IIR memory with raw prices), then applies
 *
 *   out[i] = c1 * (price[i] + price[i-1]) / 2 + c2 * out[i-1] + c3 * out[i-2]
 *
 * with coefficients derived from the cutoff `period`. State carries the
 * last input + last two outputs.
 *
 * State category: **Recursive** (the two-tap IIR memory `outPrev1` /
 * `outPrev2` is the recursive accumulator). `period` determines the
 * filter coefficients and `source` the input series, so resuming with
 * either changed is mathematically undefined and refused.
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
 * Bare state shape for Super Smoother. Params (`period`, `source`)
 * live in `meta.params` on the wire.
 */
export type SuperSmootherState = {
  prevPrice: number | null;
  /** Memory `out[i-2]` after the last `next()` call. */
  outPrev2: number;
  /** Memory `out[i-1]` after the last `next()` call. */
  outPrev1: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const SUPER_SMOOTHER_VERSION = 1;

type SuperSmootherParams = {
  period: number;
  source: PriceSource;
};

function coefficients(period: number) {
  const piOverPeriod = Math.PI / period;
  const a1 = Math.exp(-Math.SQRT2 * piOverPeriod);
  const b1 = 2 * a1 * Math.cos(Math.SQRT2 * piOverPeriod);
  const c2 = b1;
  const c3 = -(a1 * a1);
  const c1 = 1 - c2 - c3;
  return { c1, c2, c3 };
}

/**
 * Create an incremental Ehlers Super Smoother filter.
 *
 * @example
 * ```ts
 * const ss = createSuperSmoother({ period: 10 });
 * for (const candle of stream) {
 *   const { value } = ss.next(candle);
 *   if (value !== null) console.log(value);
 * }
 * ```
 */
export function createSuperSmoother(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<SuperSmootherState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<SuperSmootherState>> {
  const { params, state } = resolveResume<SuperSmootherParams, SuperSmootherState>({
    indicator: "superSmoother",
    version: SUPER_SMOOTHER_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 10, source: "close" },
  });

  const period = requireParam(
    "superSmoother",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  const { c1, c2, c3 } = coefficients(period);

  let prevPrice: number | null;
  let outPrev2: number;
  let outPrev1: number;
  let count: number;

  if (state !== null) {
    prevPrice = state.prevPrice;
    outPrev2 = state.outPrev2;
    outPrev1 = state.outPrev1;
    count = state.count;
  } else {
    prevPrice = null;
    outPrev2 = 0;
    outPrev1 = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<SuperSmootherState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (count === 0) {
        // First bar: seed memory with raw price, emit null
        outPrev2 = price;
        outPrev1 = price;
        prevPrice = price;
        count++;
        return { time: candle.time, value: null };
      }
      if (count === 1) {
        // Second bar: shift memory, still emit null
        outPrev2 = outPrev1;
        outPrev1 = price;
        prevPrice = price;
        count++;
        return { time: candle.time, value: null };
      }

      // Steady state
      const out = (c1 * (price + (prevPrice as number))) / 2 + c2 * outPrev1 + c3 * outPrev2;
      outPrev2 = outPrev1;
      outPrev1 = out;
      prevPrice = price;
      count++;
      return { time: candle.time, value: out };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      if (count < 2) return { time: candle.time, value: null };
      const out = (c1 * (price + (prevPrice as number))) / 2 + c2 * outPrev1 + c3 * outPrev2;
      return { time: candle.time, value: out };
    },

    getState(): IndicatorSnapshot<SuperSmootherState> {
      return makeSnapshot(
        "superSmoother",
        SUPER_SMOOTHER_VERSION,
        { period, source },
        { prevPrice, outPrev2, outPrev1, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // First two bars emit null; the first real output appears on bar 3.
      return count >= 3;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
