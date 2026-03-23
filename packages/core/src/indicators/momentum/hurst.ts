/**
 * Hurst Exponent
 *
 * Measures the long-term memory (persistence) of a time series using
 * Rescaled Range (R/S) analysis. The exponent indicates whether the
 * series is trending, mean-reverting, or random.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Hurst exponent options
 */
export type HurstOptions = {
  /** Minimum window size for R/S analysis (default: 20) */
  minWindow?: number;
  /** Maximum window size / lookback for calculation (default: 100) */
  maxWindow?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Hurst Exponent using Rescaled Range (R/S) analysis
 *
 * For each bar, uses a rolling window of `maxWindow` bars, then performs
 * R/S analysis over multiple sub-window sizes from `minWindow` to `maxWindow`.
 * The Hurst exponent is the slope of log(R/S) vs log(n).
 *
 * Interpretation:
 * - H = 0.5: Random walk (no memory)
 * - H > 0.5: Trending / persistent (momentum)
 * - H < 0.5: Mean-reverting / anti-persistent
 * - H ≈ 1.0: Strong trend
 * - H ≈ 0.0: Strong mean reversion
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Hurst exponent options
 * @returns Series of Hurst exponent values (0-1 range, null for insufficient data)
 *
 * @example
 * ```ts
 * const hurstData = hurst(candles);
 * const isTrending = hurstData[i].value !== null && hurstData[i].value! > 0.5;
 * const isMeanReverting = hurstData[i].value !== null && hurstData[i].value! < 0.5;
 * ```
 */
export function hurst(
  candles: Candle[] | NormalizedCandle[],
  options: HurstOptions = {},
): Series<number | null> {
  const { minWindow = 20, maxWindow = 100, source = "close" } = options;

  if (minWindow < 2) {
    throw new Error("Hurst minWindow must be at least 2");
  }
  if (maxWindow <= minWindow) {
    throw new Error("Hurst maxWindow must be greater than minWindow");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  // Pre-extract prices for log returns
  const prices = normalized.map((c) => getPrice(c, source));

  for (let i = 0; i < normalized.length; i++) {
    if (i < maxWindow - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Extract the window of log returns
    const windowStart = i - maxWindow + 1;
    const returns: number[] = [];
    for (let j = windowStart + 1; j <= i; j++) {
      if (prices[j - 1] > 0) {
        returns.push(Math.log(prices[j] / prices[j - 1]));
      } else {
        returns.push(0);
      }
    }

    const h = calculateHurstFromReturns(returns, minWindow);
    result.push({ time: normalized[i].time, value: h });
  }

  return tagSeries(result, { pane: "sub", label: "Hurst", yRange: [0, 1], referenceLines: [0.5] });
}

/**
 * Calculate Hurst exponent from a series of returns using R/S analysis.
 * Uses multiple window sizes and linear regression on log-log plot.
 */
function calculateHurstFromReturns(returns: number[], minWindow: number): number | null {
  const n = returns.length;
  if (n < minWindow) return null;

  // Generate window sizes (powers of 2 and intermediate values)
  const windowSizes: number[] = [];
  for (let size = minWindow; size <= n; size = Math.floor(size * 1.5)) {
    windowSizes.push(size);
  }
  if (windowSizes[windowSizes.length - 1] !== n) {
    windowSizes.push(n);
  }

  if (windowSizes.length < 2) return null;

  const logN: number[] = [];
  const logRS: number[] = [];

  for (const size of windowSizes) {
    const numSegments = Math.floor(n / size);
    if (numSegments < 1) continue;

    let rsSum = 0;
    let validSegments = 0;

    for (let seg = 0; seg < numSegments; seg++) {
      const start = seg * size;
      const segment = returns.slice(start, start + size);

      const rs = rescaledRange(segment);
      if (rs !== null && rs > 0) {
        rsSum += rs;
        validSegments++;
      }
    }

    if (validSegments > 0) {
      const avgRS = rsSum / validSegments;
      logN.push(Math.log(size));
      logRS.push(Math.log(avgRS));
    }
  }

  if (logN.length < 2) return null;

  // Linear regression: logRS = H * logN + c
  const slope = linearRegressionSlope(logN, logRS);

  // Clamp to reasonable range [0, 1]
  return Math.max(0, Math.min(1, slope));
}

/**
 * Calculate R/S (Rescaled Range) for a segment of returns
 */
function rescaledRange(returns: number[]): number | null {
  const n = returns.length;
  if (n < 2) return null;

  // Mean
  let sum = 0;
  for (let i = 0; i < n; i++) sum += returns[i];
  const mean = sum / n;

  // Cumulative deviations from mean
  const cumDev: number[] = new Array(n);
  cumDev[0] = returns[0] - mean;
  for (let i = 1; i < n; i++) {
    cumDev[i] = cumDev[i - 1] + (returns[i] - mean);
  }

  // Range
  let maxDev = Number.NEGATIVE_INFINITY;
  let minDev = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    if (cumDev[i] > maxDev) maxDev = cumDev[i];
    if (cumDev[i] < minDev) minDev = cumDev[i];
  }
  const range = maxDev - minDev;

  // Standard deviation
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const d = returns[i] - mean;
    variance += d * d;
  }
  // Use sample standard deviation (n-1) per academic convention for R/S analysis
  const std = Math.sqrt(variance / (n - 1));

  if (std === 0) return null;

  return range / std;
}

/**
 * Simple linear regression slope
 */
function linearRegressionSlope(x: number[], y: number[]): number {
  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
  }
  const denominator = n * sumXX - sumX * sumX;
  // When all x values are identical, regression is undefined;
  // return 0.5 (random walk) as a neutral fallback
  if (denominator === 0) return 0.5;
  return (n * sumXY - sumX * sumY) / denominator;
}
