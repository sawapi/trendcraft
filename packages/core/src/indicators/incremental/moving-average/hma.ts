/**
 * Incremental HMA (Hull Moving Average)
 *
 * HMA(n) = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";
import { createWma } from "./wma";
import type { WmaState } from "./wma";

export type HmaState = {
  period: number;
  source: PriceSource;
  halfWmaState: WmaState;
  fullWmaState: WmaState;
  finalWmaState: WmaState;
  count: number;
};

/**
 * Create an incremental HMA indicator
 *
 * @example
 * ```ts
 * const hma = createHma({ period: 9 });
 * for (const candle of stream) {
 *   const { value } = hma.next(candle);
 *   if (hma.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createHma(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<HmaState>,
): IncrementalIndicator<number | null, HmaState> {
  const period = options.period ?? 9;
  const source: PriceSource = options.source ?? "close";
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  let halfWma: ReturnType<typeof createWma>;
  let fullWma: ReturnType<typeof createWma>;
  let finalWma: ReturnType<typeof createWma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    halfWma = createWma({ period: halfPeriod, source }, { fromState: s.halfWmaState });
    fullWma = createWma({ period, source }, { fromState: s.fullWmaState });
    finalWma = createWma({ period: sqrtPeriod }, { fromState: s.finalWmaState });
    count = s.count;
  } else {
    halfWma = createWma({ period: halfPeriod, source });
    fullWma = createWma({ period, source });
    finalWma = createWma({ period: sqrtPeriod });
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, HmaState> = {
    next(candle: NormalizedCandle) {
      count++;

      const hv = halfWma.next(candle).value;
      const fv = fullWma.next(candle).value;

      if (hv === null || fv === null) {
        return { time: candle.time, value: null };
      }

      const diff = 2 * hv - fv;
      const result = finalWma.next(makeCandle(candle.time, diff));
      return { time: candle.time, value: result.value };
    },

    peek(candle: NormalizedCandle) {
      const hv = halfWma.peek(candle).value;
      const fv = fullWma.peek(candle).value;

      if (hv === null || fv === null) {
        return { time: candle.time, value: null };
      }

      const diff = 2 * hv - fv;
      return { time: candle.time, value: finalWma.peek(makeCandle(candle.time, diff)).value };
    },

    getState(): HmaState {
      return {
        period,
        source,
        halfWmaState: halfWma.getState(),
        fullWmaState: fullWma.getState(),
        finalWmaState: finalWma.getState(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return finalWma.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
