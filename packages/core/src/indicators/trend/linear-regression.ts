/**
 * Linear Regression indicators
 *
 * Provides linear regression line value, slope, angle, intercept,
 * and R-squared for a rolling window of price data.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Linear Regression options
 */
export type LinearRegressionOptions = {
  /** Period for calculation (default: 14) */
  period?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Linear Regression value
 */
export type LinearRegressionValue = {
  /** Linear regression value at the current bar */
  value: number;
  /** Slope of the regression line */
  slope: number;
  /** Intercept of the regression line */
  intercept: number;
  /** R-squared (coefficient of determination, 0-1) */
  rSquared: number;
};

/**
 * Calculate Linear Regression
 *
 * Uses least-squares method to fit a straight line to the price data
 * over a rolling window.
 *
 * Interpretation:
 * - Slope > 0: Uptrend
 * - Slope < 0: Downtrend
 * - High R-squared: Strong trend consistency
 * - Low R-squared: Choppy/noisy price action
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Linear Regression options
 * @returns Series of Linear Regression values (null for insufficient data)
 *
 * @example
 * ```ts
 * const lr = linearRegression(candles);
 * // Use slope for trend direction
 * // Use R-squared for trend quality
 * ```
 */
export function linearRegression(
  candles: Candle[] | NormalizedCandle[],
  options: LinearRegressionOptions = {},
): Series<LinearRegressionValue | null> {
  const { period = 14, source = "close" } = options;

  if (period < 2) {
    throw new Error("Linear Regression period must be at least 2");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<LinearRegressionValue | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));

  // Pre-compute sum of x and x^2 for the window [0..period-1]
  // x values are 0, 1, 2, ..., period-1
  const sumX = (period * (period - 1)) / 2;
  const sumX2 = (period * (period - 1) * (2 * period - 1)) / 6;

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Calculate sums for least squares
    let sumY = 0;
    let sumXY = 0;

    for (let j = 0; j < period; j++) {
      const y = prices[i - period + 1 + j];
      sumY += y;
      sumXY += j * y;
    }

    // Slope and intercept
    const denominator = period * sumX2 - sumX * sumX;
    const slope = (period * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / period;

    // R-squared
    const meanY = sumY / period;
    let ssTot = 0;
    let ssRes = 0;

    for (let j = 0; j < period; j++) {
      const y = prices[i - period + 1 + j];
      const predicted = intercept + slope * j;
      ssTot += (y - meanY) * (y - meanY);
      ssRes += (y - predicted) * (y - predicted);
    }

    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Value at the current bar (end of regression line)
    const value = intercept + slope * (period - 1);

    result.push({
      time: normalized[i].time,
      value: { value, slope, intercept, rSquared },
    });
  }

  return tagSeries(result, { overlay: true, label: "LinReg" });
}
