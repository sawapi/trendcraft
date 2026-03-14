/**
 * Incremental EMA Ribbon
 *
 * Multiple EMAs to visualize trend strength and direction.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { createEma } from "./ema";
import type { EmaState } from "./ema";

export type EmaRibbonValue = {
  values: (number | null)[];
  bullish: boolean | null;
  expanding: boolean | null;
};

export type EmaRibbonState = {
  periods: number[];
  source: PriceSource;
  emaStates: EmaState[];
  prevSpread: number | null;
  count: number;
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
  warmUpOptions?: WarmUpOptions<EmaRibbonState>,
): IncrementalIndicator<EmaRibbonValue, EmaRibbonState> {
  const periods = [...(options.periods ?? [8, 13, 21, 34, 55])].sort((a, b) => a - b);
  const source: PriceSource = options.source ?? "close";

  let emas: ReturnType<typeof createEma>[];
  let prevSpread: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    emas = s.emaStates.map((st, i) => createEma({ period: periods[i], source }, { fromState: st }));
    prevSpread = s.prevSpread;
    count = s.count;
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

  const indicator: IncrementalIndicator<EmaRibbonValue, EmaRibbonState> = {
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

    getState(): EmaRibbonState {
      return {
        periods,
        source,
        emaStates: emas.map((e) => e.getState()),
        prevSpread,
        count,
      };
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
