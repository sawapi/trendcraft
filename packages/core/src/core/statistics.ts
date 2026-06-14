/**
 * General statistics utilities — percentile, median, quartiles.
 *
 * Linear-interpolation percentile is used elsewhere in core (monte-carlo
 * confidence intervals, drawdown distribution analysis) and is now also
 * needed by post-optimization analytics (`computeParameterSensitivity`,
 * `safeZoneFromResults`) and by example apps (echarts-viewer's
 * `strategyDna`). Exposing one canonical implementation keeps every
 * consumer agreed on edge-case semantics (empty / single-element
 * inputs, non-mutation, sort cost) so a "p25 of these scores" call
 * means the same thing everywhere.
 *
 * @example
 * ```ts
 * import { percentile, median, quartiles } from "trendcraft";
 *
 * percentile([10, 20, 30], 50);          // 20
 * median([3, 1, 4, 1, 5, 9, 2, 6]);      // 3.5
 * const [q1, q2, q3] = quartiles(scores);
 * ```
 */

/**
 * Return the value at the given percentile (`0..100`) using linear
 * interpolation between adjacent sorted values.
 *
 * - Empty array → `0`. Callers that need a "no data" signal should
 *   guard `values.length` first.
 * - Single-element array → that element regardless of `p`.
 * - Sorts a copy of the input. The original array is not mutated.
 *
 * Algorithm: `idx = (p / 100) * (n - 1)`, then linearly interpolate
 * between `sorted[floor(idx)]` and `sorted[ceil(idx)]`.
 */
export function percentile(values: number[], p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new Error(`percentile: p must be a finite number in [0, 100], got ${p}`);
  }
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Convenience: `percentile(values, 50)`. */
export function median(values: number[]): number {
  return percentile(values, 50);
}

/**
 * CDF of the standard normal distribution, `P(Z ≤ x)`.
 *
 * Horner form with Abramowitz & Stegun 7.1.26 coefficients
 * (`|error| < 1.5e-7`). The canonical implementation shared by the
 * probabilistic/deflated Sharpe ratios, alpha-decay significance and the
 * event-study tests, so every consumer uses the same approximation.
 */
export function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Sample skewness (the moment coefficient `g1`): the third standardized
 * central moment using population moments (`÷ n`). Positive means a longer
 * right tail. Returns `NaN` for fewer than three values or zero variance.
 */
export function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return Number.NaN;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= n;
  let m2 = 0;
  let m3 = 0;
  for (const v of values) {
    const d = v - mean;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  if (m2 === 0) return Number.NaN;
  return m3 / m2 ** 1.5;
}

/**
 * Excess kurtosis (the moment coefficient `g2`): the fourth standardized
 * central moment minus 3 (so a normal distribution is 0), using population
 * moments (`÷ n`). Returns `NaN` for fewer than four values or zero variance.
 */
export function kurtosis(values: number[]): number {
  const n = values.length;
  if (n < 4) return Number.NaN;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= n;
  let m2 = 0;
  let m4 = 0;
  for (const v of values) {
    const d = v - mean;
    const d2 = d * d;
    m2 += d2;
    m4 += d2 * d2;
  }
  m2 /= n;
  m4 /= n;
  if (m2 === 0) return Number.NaN;
  return m4 / (m2 * m2) - 3;
}

/**
 * Return `[Q1, Q2, Q3]` = `[p25, p50, p75]` from the input values.
 * Sorts internally once (cheaper than three separate `percentile`
 * calls on the same array).
 */
export function quartiles(values: number[]): [number, number, number] {
  if (values.length === 0) return [0, 0, 0];
  if (values.length === 1) return [values[0], values[0], values[0]];
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return [at(25), at(50), at(75)];
}
