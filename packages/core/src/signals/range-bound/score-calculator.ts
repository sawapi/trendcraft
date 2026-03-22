import type { RangeBoundOptions } from "./types";

/**
 * Calculate ADX-based score (0-100)
 * Low ADX = high score (more likely range-bound)
 */
export function calculateAdxScore(
  adx: number | null,
  adxThreshold: number,
  adxTrendThreshold: number,
): number {
  if (adx === null) return 50; // Neutral when no data

  if (adx <= adxThreshold) return 100;
  if (adx >= adxTrendThreshold) return 0;

  // Linear interpolation between thresholds
  return Math.round((100 * (adxTrendThreshold - adx)) / (adxTrendThreshold - adxThreshold));
}

/**
 * Calculate percentile-based score (0-100)
 * Lower percentile = higher score (narrower = more likely range-bound)
 *
 * Optimized to avoid full sort by using binary search for counting
 */
export function calculatePercentileScore(
  currentValue: number | null,
  history: number[],
  lookback: number,
): number {
  if (currentValue === null) return 50; // Neutral when no data

  // Get recent history length
  const startIdx = Math.max(0, history.length - lookback);
  const recentLength = history.length - startIdx;
  if (recentLength < lookback * 0.3) return 50; // Need at least 30% of lookback

  // Count values below current (O(n) but avoids O(n log n) sort)
  let belowCount = 0;
  for (let i = startIdx; i < history.length; i++) {
    if (history[i] < currentValue) {
      belowCount++;
    }
  }

  const percentile = (belowCount / recentLength) * 100;

  // Invert: low percentile (narrow) = high score
  return Math.round(100 - percentile);
}

/**
 * Calculate composite range score
 */
export function calculateRangeScore(
  adxScore: number,
  bandwidthScore: number,
  donchianScore: number,
  atrScore: number,
  opts: Required<RangeBoundOptions>,
): number {
  const totalWeight = opts.adxWeight + opts.bandwidthWeight + opts.donchianWeight + opts.atrWeight;

  const score =
    (adxScore * opts.adxWeight +
      bandwidthScore * opts.bandwidthWeight +
      donchianScore * opts.donchianWeight +
      atrScore * opts.atrWeight) /
    totalWeight;

  return Math.round(score);
}
