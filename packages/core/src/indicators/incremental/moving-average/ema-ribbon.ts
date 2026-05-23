/**
 * Incremental EMA Ribbon
 *
 * Multiple EMAs to visualize trend strength and direction.
 *
 * State category: **Cascaded** (parallel recursive EMA stages, each
 * processed independently from the same input). Resume with different
 * `periods` / `source` is refused — periods is an array of construction
 * keys, every inner EMA is permanently bound to its period.
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
import type { EmaState } from "./ema";
import { createEma } from "./ema";

export type EmaRibbonValue = {
  values: (number | null)[];
  bullish: boolean | null;
  expanding: boolean | null;
};

export type EmaRibbonState = {
  emaStates: IndicatorSnapshot<EmaState>[];
  prevSpread: number | null;
  count: number;
};

export const EMA_RIBBON_VERSION = 1;

type EmaRibbonParams = {
  periods: number[];
  source: PriceSource;
};

/**
 * Create an incremental EMA Ribbon indicator
 *
 * @example
 * ```ts
 * const ribbon = createEmaRibbon({ periods: [8, 13, 21, 34, 55] });
 * for (const candle of stream) {
 *   const { value } = ribbon.next(candle);
 *   if (value.bullish) console.log('Bullish alignment');
 * }
 * ```
 */
export function createEmaRibbon(
  options: { periods?: number[]; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<EmaRibbonState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<EmaRibbonValue, IndicatorSnapshot<EmaRibbonState>> {
  // Normalize `periods` before resolveResume so that resuming from a
  // snapshot created with the same unsorted array (e.g.
  // `createEmaRibbon({ periods: [10, 3, 5] })`) does not throw.
  // `meta.params.periods` is stored sorted (see `getState()` below), so
  // comparing the raw `options.periods` against the snapshot would
  // false-positive on order-only differences even though the indicator
  // has always been order-insensitive (matches batch `emaRibbon`).
  const normalizedOptions = options.periods
    ? { ...options, periods: [...options.periods].sort((a, b) => a - b) }
    : options;

  const { params, state } = resolveResume<EmaRibbonParams, EmaRibbonState>({
    indicator: "emaRibbon",
    version: EMA_RIBBON_VERSION,
    category: "cascaded",
    options: normalizedOptions,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { periods: [8, 13, 21, 34, 55], source: "close" },
  });

  const periods = requireParam(
    "emaRibbon",
    params,
    "periods",
    (v): v is number[] =>
      Array.isArray(v) && v.length > 0 && v.every((n) => Number.isInteger(n) && n >= 1),
    "must be a non-empty array of positive integers",
  );
  const source = params.source;

  let emas: ReturnType<typeof createEma>[];
  let prevSpread: number | null;
  let count: number;

  if (state !== null) {
    emas = state.emaStates.map((st, i) =>
      createEma({ period: periods[i], source }, { fromState: st }),
    );
    prevSpread = state.prevSpread;
    count = state.count;
  } else {
    emas = periods.map((p) => createEma({ period: p, source }));
    prevSpread = null;
    count = 0;
  }

  function computeMetrics(values: (number | null)[]): {
    bullish: boolean | null;
    expanding: boolean | null;
  } {
    const allValid = values.every((v) => v !== null);
    if (!allValid) {
      return { bullish: null, expanding: null };
    }

    const validValues = values as number[];

    // Bullish: shorter EMA > longer EMA for all adjacent pairs
    let bullish = true;
    for (let j = 0; j < validValues.length - 1; j++) {
      if (validValues[j] <= validValues[j + 1]) {
        bullish = false;
        break;
      }
    }

    // Expanding: spread between fastest and slowest
    const spread = Math.abs(validValues[0] - validValues[validValues.length - 1]);
    const expanding = prevSpread !== null ? spread > prevSpread : null;

    return { bullish, expanding };
  }

  const indicator: IncrementalIndicator<EmaRibbonValue, IndicatorSnapshot<EmaRibbonState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const values = emas.map((e) => e.next(candle).value);
      const { bullish, expanding } = computeMetrics(values);

      // Update prevSpread
      const allValid = values.every((v) => v !== null);
      if (allValid) {
        const validValues = values as number[];
        prevSpread = Math.abs(validValues[0] - validValues[validValues.length - 1]);
      } else {
        prevSpread = null;
      }

      return { time: candle.time, value: { values, bullish, expanding } };
    },

    peek(candle: NormalizedCandle) {
      const values = emas.map((e) => e.peek(candle).value);
      const allValid = values.every((v) => v !== null);

      if (!allValid) {
        return { time: candle.time, value: { values, bullish: null, expanding: null } };
      }

      const validValues = values as number[];
      let bullish = true;
      for (let j = 0; j < validValues.length - 1; j++) {
        if (validValues[j] <= validValues[j + 1]) {
          bullish = false;
          break;
        }
      }

      const spread = Math.abs(validValues[0] - validValues[validValues.length - 1]);
      const expanding = prevSpread !== null ? spread > prevSpread : null;

      return { time: candle.time, value: { values, bullish, expanding } };
    },

    getState(): IndicatorSnapshot<EmaRibbonState> {
      return makeSnapshot(
        "emaRibbon",
        EMA_RIBBON_VERSION,
        { periods, source },
        {
          emaStates: emas.map((e) => e.getState()),
          prevSpread,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return emas[emas.length - 1].isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
