/**
 * Ulcer Index indicator
 *
 * Measures downside risk/volatility by calculating the depth and duration
 * of percentage drawdowns from recent highs.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Ulcer Index options
 */
export type UlcerIndexOptions = {
  /** Period for calculation (default: 14) */
  period?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Ulcer Index
 *
 * 1. Percent Drawdown = ((Close - Highest Close over period) / Highest Close) × 100
 * 2. Squared Average = Average of (Percent Drawdown)^2 over period
 * 3. Ulcer Index = sqrt(Squared Average)
 *
 * Interpretation:
 * - Lower values indicate less downside risk
 * - Higher values indicate more drawdown stress
 * - Useful for risk-adjusted return metrics (UPI = Ulcer Performance Index)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Ulcer Index options
 * @returns Series of Ulcer Index values (null for insufficient data)
 *
 * @example
 * ```ts
 * const ui = ulcerIndex(candles);
 * const uiCustom = ulcerIndex(candles, { period: 14 });
 * ```
 */
export function ulcerIndex(
  candles: Candle[] | NormalizedCandle[],
  options: UlcerIndexOptions = {},
): Series<number | null> {
  const { period = 14, source = "close" } = options;

  if (period < 1) {
    throw new Error("Ulcer Index period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Find highest close in the period
    let highest = Number.NEGATIVE_INFINITY;
    for (let j = i - period + 1; j <= i; j++) {
      highest = Math.max(highest, prices[j]);
    }

    // Calculate sum of squared drawdowns
    let sumSquared = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const pctDrawdown = highest !== 0 ? ((prices[j] - highest) / highest) * 100 : 0;
      sumSquared += pctDrawdown * pctDrawdown;
    }

    const ui = Math.sqrt(sumSquared / period);
    result.push({ time: normalized[i].time, value: ui });
  }

  return tagSeries(result, { pane: "sub", label: "Ulcer" });
}
