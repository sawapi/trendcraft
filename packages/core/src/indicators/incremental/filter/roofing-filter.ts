/**
 * Incremental Ehlers Roofing Filter
 *
 * Bandpass filter: 2-pole high-pass (removes low-frequency trend) followed
 * by a Super Smoother (removes high-frequency noise). Mirrors the batch
 * `roofingFilter()` exactly — first 2 bars emit null, subsequent bars
 * apply the cascaded recurrences.
 *
 * State category: **Cascaded** (a 2-pole high-pass IIR feeds a 2-pole
 * Super Smoother IIR — two coupled recursive stages). `highPassPeriod`
 * / `lowPassPeriod` set the per-stage coefficients and `source` the
 * input series, so resuming with any of them changed is mathematically
 * undefined and refused.
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
 * Bare state shape for the Roofing Filter. Params (`highPassPeriod`,
 * `lowPassPeriod`, `source`) live in `meta.params` on the wire.
 */
export type RoofingFilterState = {
  /** price[i-1] */
  prevPrice: number | null;
  /** price[i-2] */
  prevPrice2: number | null;
  /** hp[i-1] */
  hpPrev1: number;
  /** hp[i-2] */
  hpPrev2: number;
  /** filt[i-1] */
  filtPrev1: number;
  /** filt[i-2] */
  filtPrev2: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ROOFING_FILTER_VERSION = 1;

type RoofingFilterParams = {
  highPassPeriod: number;
  lowPassPeriod: number;
  source: PriceSource;
};

function highPassCoeffs(period: number) {
  // 2-pole high-pass, Ehlers canonical form (Cybernetic Analysis ch. 13).
  // Mirrors the batch coefficients exactly so resume + streaming agree.
  const theta = (Math.SQRT2 * Math.PI) / period;
  const alpha1 = (Math.cos(theta) + Math.sin(theta) - 1) / Math.cos(theta);
  const c1 = (1 - alpha1 / 2) * (1 - alpha1 / 2);
  const c2 = 2 * (1 - alpha1);
  const c3 = -((1 - alpha1) * (1 - alpha1));
  return { c1, c2, c3 };
}

function superSmootherCoeffs(period: number) {
  const a1 = Math.exp((-Math.SQRT2 * Math.PI) / period);
  const b1 = 2 * a1 * Math.cos((Math.SQRT2 * Math.PI) / period);
  const c2 = b1;
  const c3 = -(a1 * a1);
  const c1 = 1 - c2 - c3;
  return { c1, c2, c3 };
}

/**
 * Create an incremental Ehlers Roofing Filter.
 *
 * @example
 * ```ts
 * const rf = createRoofingFilter({ highPassPeriod: 48, lowPassPeriod: 10 });
 * for (const candle of stream) {
 *   const { value } = rf.next(candle);
 *   if (value !== null) console.log(value);
 * }
 * ```
 */
export function createRoofingFilter(
  options: { highPassPeriod?: number; lowPassPeriod?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<RoofingFilterState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<RoofingFilterState>> {
  const { params, state } = resolveResume<RoofingFilterParams, RoofingFilterState>({
    indicator: "roofingFilter",
    version: ROOFING_FILTER_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { highPassPeriod: 48, lowPassPeriod: 10, source: "close" },
  });

  // See batch `roofingFilter()` for why the canonical formula requires
  // highPassPeriod >= 2 (only period=1 leaves the unit circle).
  const highPassPeriod = requireParam(
    "roofingFilter",
    params,
    "highPassPeriod",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const lowPassPeriod = requireParam(
    "roofingFilter",
    params,
    "lowPassPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  const hp = highPassCoeffs(highPassPeriod);
  const ss = superSmootherCoeffs(lowPassPeriod);

  let prevPrice: number | null;
  let prevPrice2: number | null;
  let hpPrev1: number;
  let hpPrev2: number;
  let filtPrev1: number;
  let filtPrev2: number;
  let count: number;

  if (state !== null) {
    prevPrice = state.prevPrice;
    prevPrice2 = state.prevPrice2;
    hpPrev1 = state.hpPrev1;
    hpPrev2 = state.hpPrev2;
    filtPrev1 = state.filtPrev1;
    filtPrev2 = state.filtPrev2;
    count = state.count;
  } else {
    prevPrice = null;
    prevPrice2 = null;
    hpPrev1 = 0;
    hpPrev2 = 0;
    filtPrev1 = 0;
    filtPrev2 = 0;
    count = 0;
  }

  function step(price: number): { hpVal: number; filtVal: number } {
    // batch index: i, with prevPrice = price[i-1], prevPrice2 = price[i-2]
    const p1 = prevPrice as number;
    const p2 = prevPrice2 as number;
    const hpVal = hp.c1 * (price - 2 * p1 + p2) + hp.c2 * hpPrev1 + hp.c3 * hpPrev2;
    // batch: filt[i] = c1SS * (hp[i] + hp[i-1]) / 2 + c2SS * filt[i-1] + c3SS * filt[i-2]
    const filtVal = (ss.c1 * (hpVal + hpPrev1)) / 2 + ss.c2 * filtPrev1 + ss.c3 * filtPrev2;
    return { hpVal, filtVal };
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<RoofingFilterState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (count < 2) {
        // batch seeds hp[0..1] = 0 and filt[0..1] = 0; emit null
        // Maintain price history through prevPrice/prevPrice2 so step() at i=2 is correct.
        prevPrice2 = prevPrice;
        prevPrice = price;
        count++;
        return { time: candle.time, value: null };
      }

      const { hpVal, filtVal } = step(price);
      // Shift filter memories
      hpPrev2 = hpPrev1;
      hpPrev1 = hpVal;
      filtPrev2 = filtPrev1;
      filtPrev1 = filtVal;
      prevPrice2 = prevPrice;
      prevPrice = price;
      count++;
      return { time: candle.time, value: filtVal };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      if (count < 2) return { time: candle.time, value: null };
      const { filtVal } = step(price);
      return { time: candle.time, value: filtVal };
    },

    getState(): IndicatorSnapshot<RoofingFilterState> {
      return makeSnapshot(
        "roofingFilter",
        ROOFING_FILTER_VERSION,
        { highPassPeriod, lowPassPeriod, source },
        {
          prevPrice,
          prevPrice2,
          hpPrev1,
          hpPrev2,
          filtPrev1,
          filtPrev2,
          count,
        },
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
