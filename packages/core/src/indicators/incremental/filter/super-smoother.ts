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
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type SuperSmootherState = {
  period: number;
  source: PriceSource;
  prevPrice: number | null;
  /** Memory `out[i-2]` after the last `next()` call. */
  outPrev2: number;
  /** Memory `out[i-1]` after the last `next()` call. */
  outPrev1: number;
  count: number;
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
  warmUpOptions?: WarmUpOptions<SuperSmootherState>,
): IncrementalIndicator<number | null, SuperSmootherState> {
  const period = options.period ?? 10;
  const source: PriceSource = options.source ?? "close";

  if (period < 1) {
    throw new Error("Super Smoother period must be at least 1");
  }

  const { c1, c2, c3 } = coefficients(period);

  let prevPrice: number | null;
  let outPrev2: number;
  let outPrev1: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevPrice = s.prevPrice;
    outPrev2 = s.outPrev2;
    outPrev1 = s.outPrev1;
    count = s.count;
  } else {
    prevPrice = null;
    outPrev2 = 0;
    outPrev1 = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, SuperSmootherState> = {
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

    getState(): SuperSmootherState {
      return { period, source, prevPrice, outPrev2, outPrev1, count };
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
