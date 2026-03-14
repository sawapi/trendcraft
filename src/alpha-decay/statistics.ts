/**
 * Statistical primitives for alpha decay analysis
 *
 * Provides Spearman rank correlation, linear regression, and supporting
 * mathematical functions (t-distribution CDF, incomplete beta, log-gamma).
 * No external dependencies.
 */

import { computeRanks } from "../utils/statistics";

/**
 * Approximate CDF of the standard normal distribution
 *
 * Uses Horner form with Abramowitz & Stegun coefficients.
 *
 * @param x - z-score
 * @returns Cumulative probability P(Z <= x)
 */
function normalCdf(x: number): number {
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
 * Log-gamma function using Lanczos approximation
 *
 * @param x - Positive real number
 * @returns ln(Gamma(x))
 */
function logGamma(x: number): number {
  if (x <= 0) return 0;
  const c = [
    76.18009172947146, -86.50532032941678, 24.01409824083091, -1.231739572450155,
    0.001208650973866179, -0.000005395239384953,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310007 * ser) / x);
}

/**
 * Log of the beta function B(a, b) = Gamma(a)*Gamma(b)/Gamma(a+b)
 */
function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/**
 * Continued fraction evaluation for the regularized incomplete beta function
 */
function cfBeta(x: number, a: number, b: number): number {
  const maxIter = 100;
  const eps = 1e-10;
  let am = 1;
  let bm = 1;
  let az = 1;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let bz = 1 - (qab * x) / qap;

  for (let m = 1; m <= maxIter; m++) {
    const em = m;
    const tem = em + em;
    let d = (em * (b - m) * x) / ((qam + tem) * (a + tem));
    const ap = az + d * am;
    const bp = bz + d * bm;
    d = (-(a + em) * (qab + em) * x) / ((a + tem) * (qap + tem));
    const app = ap + d * az;
    const bpp = bp + d * bz;
    const aold = az;
    am = ap / bpp;
    bm = bp / bpp;
    az = app / bpp;
    bz = 1;
    if (Math.abs(az - aold) < eps * Math.abs(az)) return az;
  }
  return az;
}

/**
 * Regularized incomplete beta function I_x(a, b) approximation
 */
function incompleteBetaApprox(x: number, a: number, b: number): number {
  if (x < 0.5) {
    const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
    return (bt * cfBeta(x, a, b)) / a;
  }
  return 1 - incompleteBetaApprox(1 - x, b, a);
}

/**
 * Approximate CDF of the t-distribution
 *
 * Uses normal approximation for df > 100, otherwise uses the
 * regularized incomplete beta function.
 *
 * @param t - t statistic (non-negative)
 * @param df - Degrees of freedom
 * @returns Cumulative probability P(T <= t) for positive t
 */
function approximateTCdf(t: number, df: number): number {
  if (df > 100) {
    return normalCdf(t);
  }
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  return 1 - 0.5 * incompleteBetaApprox(x, a, b);
}

/**
 * Spearman rank correlation coefficient
 *
 * Computes the Information Coefficient (IC) as the rank correlation
 * between signal predictions and actual forward returns.
 *
 * @param x - First variable (e.g., signal values)
 * @param y - Second variable (e.g., forward returns)
 * @returns Correlation coefficient rho and its p-value
 *
 * @example
 * ```ts
 * const { rho, pValue } = spearmanCorrelation([1, 2, 3], [10, 20, 30]);
 * // rho = 1.0 (perfect positive), pValue ≈ 0
 * ```
 */
export function spearmanCorrelation(x: number[], y: number[]): { rho: number; pValue: number } {
  const n = x.length;
  if (n < 3) return { rho: 0, pValue: 1 };

  const rankX = computeRanks(x);
  const rankY = computeRanks(y);

  // Pearson correlation on ranks
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += rankX[i];
    sumY += rankY[i];
    sumXY += rankX[i] * rankY[i];
    sumX2 += rankX[i] ** 2;
    sumY2 += rankY[i] ** 2;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  const rho = denominator === 0 ? 0 : numerator / denominator;

  // Approximate p-value using t-distribution
  if (Math.abs(rho) >= 1) {
    return { rho: Math.sign(rho), pValue: 0 };
  }
  const tStat = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  const pValue = 2 * (1 - approximateTCdf(Math.abs(tStat), n - 2));

  return { rho, pValue };
}

/**
 * Simple linear regression: returns slope and intercept
 *
 * Fits y = slope * x + intercept using ordinary least squares.
 *
 * @param x - Independent variable values
 * @param y - Dependent variable values
 * @returns Slope and intercept of the best-fit line
 *
 * @example
 * ```ts
 * const { slope, intercept } = linearRegression([0, 1, 2], [1, 3, 5]);
 * // slope = 2, intercept = 1
 * ```
 */
export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}
