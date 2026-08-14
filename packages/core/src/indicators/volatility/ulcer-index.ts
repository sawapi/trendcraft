/**
 * Ulcer Index indicator
 *
 * Measures downside risk/volatility by calculating the depth and duration
 * of percentage drawdowns from recent highs.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { assertPeriod } from "../../utils/validate-period";

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
 * Calculate Ulcer Index (Peter Martin & Byron McCann, 1987 / 1989)
 *
 * The canonical two-stage formula:
 *
 *   1. For each bar j: rolling_max[j] = max(close[j-N+1..j])
 *   2. For each bar j: drawdown[j] = (close[j] - rolling_max[j]) / rolling_max[j] × 100
 *   3. UI[i] = sqrt(mean(drawdown[i-N+1..i]^2))
 *
 * Each per-bar drawdown is measured against THAT bar's own rolling
 * peak — not against a single peak shared across the window. This
 * matches the StockCharts / Wikipedia / pandas-ta interpretation of
 * Peter Martin's original definition. Total warmup is therefore
 * `2 * period - 1` bars (first non-null at index `2 * period - 2`).
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

  assertPeriod("Ulcer Index period", period);

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));

  // Stage 1: per-bar rolling max + per-bar drawdown
  const drawdowns: (number | null)[] = new Array(normalized.length).fill(null);
  for (let j = period - 1; j < normalized.length; j++) {
    let rollingMax = Number.NEGATIVE_INFINITY;
    for (let k = j - period + 1; k <= j; k++) {
      if (prices[k] > rollingMax) rollingMax = prices[k];
    }
    drawdowns[j] = rollingMax !== 0 ? ((prices[j] - rollingMax) / rollingMax) * 100 : 0;
  }

  // Stage 2: rolling sum-of-squares of the drawdown series
  for (let i = 0; i < normalized.length; i++) {
    // Need a full window of valid drawdowns: drawdowns[i-N+1..i] all
    // non-null, which requires i - N + 1 >= N - 1, i.e. i >= 2N - 2.
    if (i < 2 * period - 2) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let sumSquared = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const dd = drawdowns[j] as number;
      sumSquared += dd * dd;
    }

    result.push({ time: normalized[i].time, value: Math.sqrt(sumSquared / period) });
  }

  return tagSeries(result, withLabelParams({ overlay: false, label: "Ulcer" }, [period]));
}
