/**
 * Mean reversion analysis: half-life and Hurst exponent
 *
 * @module pairs/mean-reversion
 */

import type { MeanReversionResult } from "../types/pairs";
import { olsRegression } from "./regression";

/**
 * Estimate Hurst exponent using rescaled range (R/S) analysis
 *
 * H < 0.5 indicates mean-reverting behavior
 * H = 0.5 indicates random walk
 * H > 0.5 indicates trending behavior
 */
function estimateHurst(series: number[]): number {
  const n = series.length;
  if (n < 20) return 0.5;

  const sizes: number[] = [];
  const rsValues: number[] = [];

  for (let size = 10; size <= Math.floor(n / 2); size = Math.floor(size * 1.5)) {
    const numBlocks = Math.floor(n / size);
    if (numBlocks < 1) break;

    let rsSum = 0;
    let validBlocks = 0;

    for (let b = 0; b < numBlocks; b++) {
      const block = series.slice(b * size, (b + 1) * size);
      const mean = block.reduce((a, v) => a + v, 0) / block.length;

      // Cumulative deviations
      let cumDev = 0;
      let maxDev = Number.NEGATIVE_INFINITY;
      let minDev = Number.POSITIVE_INFINITY;
      let sumSq = 0;

      for (const v of block) {
        cumDev += v - mean;
        maxDev = Math.max(maxDev, cumDev);
        minDev = Math.min(minDev, cumDev);
        sumSq += (v - mean) ** 2;
      }

      const range = maxDev - minDev;
      const stdDev = Math.sqrt(sumSq / block.length);

      if (stdDev > 0) {
        rsSum += range / stdDev;
        validBlocks++;
      }
    }

    if (validBlocks > 0) {
      sizes.push(Math.log(size));
      rsValues.push(Math.log(rsSum / validBlocks));
    }
  }

  if (sizes.length < 2) return 0.5;

  // Linear regression: log(R/S) = H * log(n) + c
  const { beta: hurst } = olsRegression(sizes, rsValues);
  return Math.max(0, Math.min(1, hurst));
}

/**
 * Analyze mean reversion properties of a spread series
 *
 * Uses AR(1) model: spread_t = lambda * spread_{t-1} + error
 * Half-life = -ln(2) / ln(lambda)
 *
 * @param spreads - Spread values
 * @param maxHalfLife - Maximum half-life to consider mean-reverting (default: 100)
 * @returns Mean reversion analysis including half-life, lambda, and Hurst exponent
 *
 * @example
 * ```ts
 * const result = analyzeMeanReversion(spreadValues, 100);
 * if (result.isMeanReverting) {
 *   console.log(`Half-life: ${result.halfLife} bars`);
 * }
 * ```
 */
export function analyzeMeanReversion(spreads: number[], maxHalfLife = 100): MeanReversionResult {
  if (spreads.length < 10) {
    return {
      halfLife: Number.POSITIVE_INFINITY,
      lambda: 1,
      isMeanReverting: false,
      hurstExponent: 0.5,
    };
  }

  // AR(1): spread_t = c + lambda * spread_{t-1} + error
  const y = spreads.slice(1);
  const x = spreads.slice(0, -1);
  const { beta: lambda } = olsRegression(x, y);

  // Half-life
  const halfLife =
    lambda < 1 && lambda > 0 ? -Math.log(2) / Math.log(lambda) : Number.POSITIVE_INFINITY;

  // Hurst exponent (rescaled range method)
  const hurstExponent = estimateHurst(spreads);

  // Primary criterion: AR(1) half-life within reasonable range
  // Hurst exponent from R/S analysis can overestimate for short-memory processes,
  // so we use it as supplementary evidence rather than a hard gate
  const isMeanReverting = halfLife > 0 && halfLife < maxHalfLife && lambda < 1;

  return { halfLife, lambda, isMeanReverting, hurstExponent };
}
