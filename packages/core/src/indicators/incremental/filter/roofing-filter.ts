/**
 * Incremental Ehlers Roofing Filter
 *
 * Bandpass filter: 2-pole high-pass (removes low-frequency trend) followed
 * by a Super Smoother (removes high-frequency noise). Mirrors the batch
 * `roofingFilter()` exactly — first 2 bars emit null, subsequent bars
 * apply the cascaded recurrences.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type RoofingFilterState = {
  highPassPeriod: number;
  lowPassPeriod: number;
  source: PriceSource;
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

function highPassCoeffs(period: number) {
  const a1 = Math.exp((-Math.SQRT2 * Math.PI) / period);
  const b1 = 2 * a1 * Math.cos((Math.SQRT2 * Math.PI) / period);
  const c2 = b1;
  const c3 = -(a1 * a1);
  // 2-pole Butterworth high-pass
  const c1 = (1 + c2 - c3) / 4;
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
  warmUpOptions?: WarmUpOptions<RoofingFilterState>,
): IncrementalIndicator<number | null, RoofingFilterState> {
  const highPassPeriod = options.highPassPeriod ?? 48;
  const lowPassPeriod = options.lowPassPeriod ?? 10;
  const source: PriceSource = options.source ?? "close";

  if (highPassPeriod < 1) throw new Error("Roofing filter highPassPeriod must be at least 1");
  if (lowPassPeriod < 1) throw new Error("Roofing filter lowPassPeriod must be at least 1");

  const hp = highPassCoeffs(highPassPeriod);
  const ss = superSmootherCoeffs(lowPassPeriod);

  let prevPrice: number | null;
  let prevPrice2: number | null;
  let hpPrev1: number;
  let hpPrev2: number;
  let filtPrev1: number;
  let filtPrev2: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevPrice = s.prevPrice;
    prevPrice2 = s.prevPrice2;
    hpPrev1 = s.hpPrev1;
    hpPrev2 = s.hpPrev2;
    filtPrev1 = s.filtPrev1;
    filtPrev2 = s.filtPrev2;
    count = s.count;
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

  const indicator: IncrementalIndicator<number | null, RoofingFilterState> = {
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

    getState(): RoofingFilterState {
      return {
        highPassPeriod,
        lowPassPeriod,
        source,
        prevPrice,
        prevPrice2,
        hpPrev1,
        hpPrev2,
        filtPrev1,
        filtPrev2,
        count,
      };
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
