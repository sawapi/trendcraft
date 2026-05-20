/**
 * Incremental HMA (Hull Moving Average)
 *
 * HMA(n) = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
 *
 * State category: **Cascaded** (3 stacked WMAs). The inner half/full
 * WMAs hold raw price buffers, but the outer `finalWma` holds
 * intermediate `2*WMA(n/2) - WMA(n)` values whose meaning depends on
 * `period`. Reconfiguring `period` mid-stream invalidates that
 * intermediate buffer, so the cascaded-category policy refuses any
 * `period` / `source` change on resume.
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
import { makeCandle } from "../utils";
import type { WmaState } from "./wma";
import { createWma } from "./wma";

export type HmaState = {
  halfWmaState: IndicatorSnapshot<WmaState>;
  fullWmaState: IndicatorSnapshot<WmaState>;
  finalWmaState: IndicatorSnapshot<WmaState>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const HMA_VERSION = 1;

type HmaParams = {
  period: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<HmaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<HmaState>> {
  const { params, state } = resolveResume<HmaParams, HmaState>({
    indicator: "hma",
    version: HMA_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 9, source: "close" },
  });

  const period = requireParam(
    "hma",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  let halfWma: ReturnType<typeof createWma>;
  let fullWma: ReturnType<typeof createWma>;
  let finalWma: ReturnType<typeof createWma>;
  let count: number;

  if (state !== null) {
    halfWma = createWma({ period: halfPeriod, source }, { fromState: state.halfWmaState });
    fullWma = createWma({ period, source }, { fromState: state.fullWmaState });
    finalWma = createWma({ period: sqrtPeriod }, { fromState: state.finalWmaState });
    count = state.count;
  } else {
    halfWma = createWma({ period: halfPeriod, source });
    fullWma = createWma({ period, source });
    finalWma = createWma({ period: sqrtPeriod });
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<HmaState>> = {
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

    getState(): IndicatorSnapshot<HmaState> {
      return makeSnapshot(
        "hma",
        HMA_VERSION,
        { period, source },
        {
          halfWmaState: halfWma.getState(),
          fullWmaState: fullWma.getState(),
          finalWmaState: finalWma.getState(),
          count,
        },
      );
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
