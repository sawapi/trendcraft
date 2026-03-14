/**
 * Spread and z-score calculation for pairs trading
 *
 * @module pairs/spread
 */

import type { PairsAnalysisOptions, SpreadPoint } from "../types/pairs";

/**
 * Calculate spread between two price series given a hedge ratio
 *
 * spread_t = Y_t - hedgeRatio * X_t - intercept
 *
 * Z-scores can be computed using the full sample or a rolling window.
 *
 * @param seriesY - Dependent variable prices
 * @param seriesX - Independent variable prices
 * @param hedgeRatio - Hedge ratio (beta from OLS regression)
 * @param intercept - Regression intercept
 * @param times - Timestamps for each data point
 * @param options - Analysis options (rollingWindow)
 * @returns Array of SpreadPoint with spread, z-score, mean, and stdDev
 *
 * @example
 * ```ts
 * const spread = calculateSpread(pricesA, pricesB, 1.5, 0.2, times, { rollingWindow: 20 });
 * const latestZScore = spread[spread.length - 1].zScore;
 * ```
 */
export function calculateSpread(
  seriesY: number[],
  seriesX: number[],
  hedgeRatio: number,
  intercept: number,
  times: number[],
  options: PairsAnalysisOptions = {},
): SpreadPoint[] {
  const n = Math.min(seriesY.length, seriesX.length);
  const window = options.rollingWindow ?? 0;

  // Calculate raw spread
  const spreads: number[] = [];
  for (let i = 0; i < n; i++) {
    spreads.push(seriesY[i] - hedgeRatio * seriesX[i] - intercept);
  }

  const result: SpreadPoint[] = [];

  if (window === 0) {
    // Full-sample z-score
    const mean = spreads.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(spreads.reduce((a, v) => a + (v - mean) ** 2, 0) / n);

    for (let i = 0; i < n; i++) {
      result.push({
        time: times[i],
        spread: spreads[i],
        zScore: stdDev > 0 ? (spreads[i] - mean) / stdDev : 0,
        mean,
        stdDev,
      });
    }
  } else {
    // Rolling z-score
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - window + 1);
      const windowData = spreads.slice(start, i + 1);
      const mean = windowData.reduce((a, b) => a + b, 0) / windowData.length;
      const stdDev = Math.sqrt(
        windowData.reduce((a, v) => a + (v - mean) ** 2, 0) / windowData.length,
      );

      result.push({
        time: times[i],
        spread: spreads[i],
        zScore: stdDev > 0 ? (spreads[i] - mean) / stdDev : 0,
        mean,
        stdDev,
      });
    }
  }

  return result;
}
