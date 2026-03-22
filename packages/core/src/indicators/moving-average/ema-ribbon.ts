/**
 * EMA Ribbon
 *
 * Multiple EMAs plotted together to visualize trend strength and direction.
 * Bullish when shorter EMAs are above longer ones (properly ordered).
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { ema } from "./ema";

/**
 * EMA Ribbon value
 */
export type EmaRibbonValue = {
  /** EMA values indexed by period order (shortest to longest) */
  values: (number | null)[];
  /** True if all EMAs are in bullish order (shorter above longer) */
  bullish: boolean | null;
  /** True if the spread between fastest and slowest EMA is expanding */
  expanding: boolean | null;
};

/**
 * EMA Ribbon options
 */
export type EmaRibbonOptions = {
  /** EMA periods from shortest to longest (default: [8, 13, 21, 34, 55]) */
  periods?: number[];
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate EMA Ribbon
 *
 * Computes multiple EMAs and determines bullish/bearish alignment
 * and whether the ribbon is expanding or contracting.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of EMA Ribbon values
 *
 * @example
 * ```ts
 * const ribbon = emaRibbon(candles, { periods: [8, 13, 21, 34, 55] });
 * if (ribbon[i].value.bullish) {
 *   // All EMAs in bullish alignment
 * }
 * ```
 */
export function emaRibbon(
  candles: Candle[] | NormalizedCandle[],
  options: EmaRibbonOptions = {},
): Series<EmaRibbonValue> {
  const { periods = [8, 13, 21, 34, 55], source = "close" } = options;

  if (periods.length < 2) {
    throw new Error("EMA Ribbon requires at least 2 periods");
  }
  for (const p of periods) {
    if (!Number.isInteger(p)) {
      throw new Error("EMA Ribbon periods must be integers");
    }
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Sort periods ascending
  const sortedPeriods = [...periods].sort((a, b) => a - b);

  // Calculate all EMAs
  const emaResults = sortedPeriods.map((p) => ema(normalized, { period: p, source }));

  const result: Series<EmaRibbonValue> = [];
  let prevSpread: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    const values = emaResults.map((e) => e[i].value);
    const allValid = values.every((v) => v !== null);

    let bullish: boolean | null = null;
    let expanding: boolean | null = null;

    if (allValid) {
      // Bullish: shorter EMA > longer EMA for all adjacent pairs
      const validValues = values as number[];
      bullish = true;
      for (let j = 0; j < validValues.length - 1; j++) {
        if (validValues[j] <= validValues[j + 1]) {
          bullish = false;
          break;
        }
      }

      // Expanding: spread between fastest and slowest EMA
      const spread = Math.abs(validValues[0] - validValues[validValues.length - 1]);
      if (prevSpread !== null) {
        expanding = spread > prevSpread;
      }
      prevSpread = spread;
    } else {
      prevSpread = null;
    }

    result.push({
      time: normalized[i].time,
      value: { values, bullish, expanding },
    });
  }

  return result;
}
