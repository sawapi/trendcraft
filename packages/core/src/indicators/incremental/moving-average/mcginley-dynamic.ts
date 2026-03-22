/**
 * Incremental McGinley Dynamic
 *
 * MD[i] = MD[i-1] + (Price - MD[i-1]) / (k × period × (Price / MD[i-1])^4)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type McGinleyDynamicState = {
  period: number;
  k: number;
  source: PriceSource;
  prevMd: number | null;
  sum: number;
  count: number;
};

/**
 * Create an incremental McGinley Dynamic indicator
 *
 * @example
 * ```ts
 * const md = createMcGinleyDynamic({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = md.next(candle);
 *   if (md.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createMcGinleyDynamic(
  options: { period?: number; k?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<McGinleyDynamicState>,
): IncrementalIndicator<number | null, McGinleyDynamicState> {
  const period = options.period ?? 14;
  const k = options.k ?? 0.6;
  const source: PriceSource = options.source ?? "close";

  let prevMd: number | null;
  let sum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevMd = s.prevMd;
    sum = s.sum;
    count = s.count;
  } else {
    prevMd = null;
    sum = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, McGinleyDynamicState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      if (count < period) {
        sum += price;
        return { time: candle.time, value: null };
      }

      if (count === period) {
        sum += price;
        prevMd = sum / period;
        return { time: candle.time, value: prevMd };
      }

      // McGinley Dynamic formula
      const prev = prevMd as number;
      const ratio = price / prev;
      const denominator = k * period * ratio ** 4;
      prevMd = prev + (price - prev) / denominator;
      return { time: candle.time, value: prevMd };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      if (peekCount < period) {
        return { time: candle.time, value: null };
      }

      if (peekCount === period) {
        return { time: candle.time, value: (sum + price) / period };
      }

      const prev = prevMd as number;
      const ratio = price / prev;
      const denominator = k * period * ratio ** 4;
      return { time: candle.time, value: prev + (price - prev) / denominator };
    },

    getState(): McGinleyDynamicState {
      return { period, k, source, prevMd, sum, count };
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
