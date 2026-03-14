import type { CorrelationPoint } from "../types/correlation";
import { computeRanks } from "../utils/statistics";

/**
 * Calculate Pearson correlation between two arrays
 *
 * @param x - First array of values
 * @param y - Second array of values
 * @returns Pearson correlation coefficient (-1 to 1)
 *
 * @example
 * ```ts
 * const r = pearsonCorrelation([1, 2, 3], [1, 2, 3]);
 * // r === 1.0 (perfect positive correlation)
 * ```
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const denom = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

/**
 * Calculate Spearman rank correlation between two arrays
 *
 * @param x - First array of values
 * @param y - Second array of values
 * @returns Spearman rank correlation coefficient (-1 to 1)
 *
 * @example
 * ```ts
 * const r = spearmanRankCorrelation([1, 2, 3], [1, 2, 3]);
 * // r === 1.0 (perfect monotonic relationship)
 * ```
 */
export function spearmanRankCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const rankX = computeRanks(x);
  const rankY = computeRanks(y);
  return pearsonCorrelation(rankX, rankY);
}

/**
 * Calculate rolling correlation between two return series
 *
 * @param returnsA - Returns series for asset A
 * @param returnsB - Returns series for asset B
 * @param times - Timestamp for each observation
 * @param window - Rolling window size (default: 60)
 * @returns Rolling correlation series with both Pearson and Spearman
 *
 * @example
 * ```ts
 * const corr = rollingCorrelation(returnsA, returnsB, times, 60);
 * // corr[0].pearson => correlation over first window
 * ```
 */
export function rollingCorrelation(
  returnsA: number[],
  returnsB: number[],
  times: number[],
  window = 60,
): CorrelationPoint[] {
  const n = Math.min(returnsA.length, returnsB.length, times.length);
  const result: CorrelationPoint[] = [];

  for (let i = window - 1; i < n; i++) {
    const windowA = returnsA.slice(i - window + 1, i + 1);
    const windowB = returnsB.slice(i - window + 1, i + 1);

    result.push({
      time: times[i],
      pearson: pearsonCorrelation(windowA, windowB),
      spearman: spearmanRankCorrelation(windowA, windowB),
    });
  }

  return result;
}
