/**
 * Incremental HMA (Hull Moving Average)
 *
 * HMA(n) = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
 *
 * State category: **Cascaded** (3 stacked WMAs). The inner half/full
 * WMAs hold raw price buffers, but the outer `finalWma` holds
 * intermediate `2*WMA(n/2) - WMA(n)` values whose meaning depends on
 * `period`. Reconfiguring `period` mid-stream invalidates that
 * intermediate buffer, so resume requires identical `period` and
 * `source` (or omit them and let the snapshot's params win).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IndicatorSnapshot } from "../state-contract";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";
import type { WmaState } from "./wma";
import { createWma } from "./wma";

export type HmaState = {
  period: number;
  source: PriceSource;
  halfWmaState: IndicatorSnapshot<WmaState>;
  fullWmaState: IndicatorSnapshot<WmaState>;
  finalWmaState: IndicatorSnapshot<WmaState>;
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
  // Resume order: explicit option > snapshot value > canonical default.
  const fs = warmUpOptions?.fromState ?? null;
  const period = options.period ?? fs?.period ?? 9;
  const source: PriceSource = options.source ?? fs?.source ?? "close";
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  let halfWma: ReturnType<typeof createWma>;
  let fullWma: ReturnType<typeof createWma>;
  let finalWma: ReturnType<typeof createWma>;
  let count: number;

  if (fs) {
    // HMA is a cascade: the outer `finalWma` carries intermediate
    // `2*WMA(n/2) - WMA(n)` values whose semantics depend on `period`.
    // Reconfiguring `period` invalidates those intermediates, so
    // resume requires identical params.
    if (fs.period !== period || fs.source !== source) {
      throw new Error("HMA: incompatible snapshot, re-warm required");
    }
    halfWma = createWma({ period: halfPeriod, source }, { fromState: fs.halfWmaState });
    fullWma = createWma({ period, source }, { fromState: fs.fullWmaState });
    finalWma = createWma({ period: sqrtPeriod }, { fromState: fs.finalWmaState });
    count = fs.count;
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
