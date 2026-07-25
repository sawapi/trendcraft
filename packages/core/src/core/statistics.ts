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
 * Centred moments of one series, computed in two passes: the mean first,
 * then the sum of squared deviations from it.
 *
 * The textbook one-pass shortcut `Σx²/n − mean²` subtracts two nearly equal
 * large numbers whenever the values are large relative to their spread, and
 * loses every significant digit of the answer: at price ~1e8 with ordinary
 * intraday volatility it returns a standard deviation off by 700%, or a
 * negative variance that then gets clamped to zero. Prices in yen, won or
 * rupiah reach that range routinely. Two passes cost one extra loop and are
 * accurate at any offset, so this is the only variance form core uses.
 *
 * `sumSqDev` is the *sum* of squared deviations, not a variance: callers
 * divide by `n` for the population form or `n - 1` for the sample form.
 * Returns zeros for an empty input.
 *
 * @example
 * ```ts
 * const { n, mean, sumSqDev } = centeredMoments([10, 12, 11, 13]);
 * const stdDev = Math.sqrt(sumSqDev / n); // population stdDev of the window
 * ```
 */
export function centeredMoments(values: readonly number[]): {
  n: number;
  mean: number;
  sumSqDev: number;
} {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sumSqDev: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;
  let sumSqDev = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    sumSqDev += d * d;
  }
  return { n, mean, sumSqDev };
}

/**
 * Centred cross moments of two paired series — the building blocks of a
 * least-squares fit and of Pearson correlation.
 *
 * `sxx`/`syy` are sums of squared deviations and `sxy` the sum of the
 * cross-products, all taken about the means, so an OLS slope is `sxy / sxx`
 * and a correlation `sxy / sqrt(sxx · syy)`. The uncentred forms
 * (`Σx² − n·meanX²`, `n·Σxy − Σx·Σy`) cancel catastrophically at high value
 * levels — enough to flip the sign of a hedge ratio — which is why nothing
 * in core derives them that way.
 *
 * The series are compared over their common prefix; extra trailing values in
 * the longer one are ignored. Returns zeros when that prefix is empty.
 */
export function centeredCrossMoments(
  x: readonly number[],
  y: readonly number[],
): {
  n: number;
  meanX: number;
  meanY: number;
  sxx: number;
  syy: number;
  sxy: number;
} {
  const n = Math.min(x.length, y.length);
  if (n === 0) return { n: 0, meanX: 0, meanY: 0, sxx: 0, syy: 0, sxy: 0 };
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return { n, meanX, meanY, sxx, syy, sxy };
}

/**
 * Least-squares slope of `values` against the bar index `0..n-1`.
 *
 * The shape a dozen trend/accumulation checks need: "is this series rising,
 * and how fast". Written centred for the same reason as
 * {@link centeredCrossMoments} — the uncentred `n·Σi·y − Σi·Σy` form cancels
 * once the values are large relative to their spread, which for volume series
 * is routine. Returns 0 for fewer than two values.
 */
export function slopeOverIndex(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  // x = 0..n-1, so the x moments are exact closed forms.
  const meanX = (n - 1) / 2;
  const sxx = (n * (n * n - 1)) / 12;
  let sumY = 0;
  for (let i = 0; i < n; i++) sumY += values[i];
  const meanY = sumY / n;
  let sxy = 0;
  for (let i = 0; i < n; i++) sxy += (i - meanX) * (values[i] - meanY);
  return sxy / sxx;
}

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
