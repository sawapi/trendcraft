import { slopeOverIndex } from "../../core/statistics";
import type { TrendReason } from "./types";

/**
 * Calculate linear regression slope of a series
 * Returns the slope (per bar)
 *
 * Uses least squares method: slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
 *
 * Optimization: Uses index-based access instead of slice() to avoid array allocation.
 * Pre-computes Σx and Σx² since they only depend on n:
 *   Σx = n*(n-1)/2
 *   Σx² = n*(n-1)*(2n-1)/6
 */
export function calculateRegressionSlope(values: number[], period: number): number | null {
  const len = values.length;
  if (len < period) return null;

  if (period < 2) return null;
  return slopeOverIndex(values.slice(len - period));
}

/**
 * Count consecutive Higher Highs and Lower Lows
 *
 * HH (Higher High): Current high > previous high
 * LL (Lower Low): Current low < previous low
 *
 * Returns the count of consecutive HH or LL patterns
 */
export function countConsecutiveHHLL(
  highs: number[],
  lows: number[],
  idx: number,
  lookback: number,
): { consecutiveHH: number; consecutiveLL: number } {
  let consecutiveHH = 0;
  let consecutiveLL = 0;

  // Start from current bar and go backwards
  const startIdx = Math.max(1, idx - lookback + 1);

  // Count consecutive HH from current bar backwards
  for (let i = idx; i >= startIdx; i--) {
    if (highs[i] > highs[i - 1]) {
      consecutiveHH++;
    } else {
      break;
    }
  }

  // Count consecutive LL from current bar backwards
  for (let i = idx; i >= startIdx; i--) {
    if (lows[i] < lows[i - 1]) {
      consecutiveLL++;
    } else {
      break;
    }
  }

  return { consecutiveHH, consecutiveLL };
}

/**
 * Check if there's a directional trend even with low ADX
 *
 * Returns TrendReason if any of the following conditions are met:
 * 1. DI difference is significant (+DI >> -DI or vice versa) -> 'di_diff'
 * 2. Price has a consistent slope (linear regression) -> 'slope'
 * 3. Consecutive Higher Highs or Lower Lows pattern -> 'hhll'
 *
 * Returns null if no directional trend detected
 */
export function hasDirectionalTrend(
  plusDI: number | null,
  minusDI: number | null,
  regressionSlope: number | null,
  atr: number | null,
  consecutiveHH: number,
  consecutiveLL: number,
  opts: {
    diDifferenceThreshold: number;
    slopeThreshold: number;
    consecutiveHHLLThreshold: number;
  },
): TrendReason {
  // Condition 1: DI difference is significant
  if (plusDI !== null && minusDI !== null) {
    const diDiff = Math.abs(plusDI - minusDI);
    if (diDiff >= opts.diDifferenceThreshold) {
      return "di_diff";
    }
  }

  // Condition 2: Regression slope is significant (relative to ATR)
  if (regressionSlope !== null && atr !== null && atr > 0) {
    const normalizedSlope = Math.abs(regressionSlope) / atr;
    if (normalizedSlope >= opts.slopeThreshold) {
      return "slope";
    }
  }

  // Condition 3: Consecutive HH or LL pattern
  if (consecutiveHH >= opts.consecutiveHHLLThreshold) {
    return "hhll";
  }
  if (consecutiveLL >= opts.consecutiveHHLLThreshold) {
    return "hhll";
  }

  return null;
}
