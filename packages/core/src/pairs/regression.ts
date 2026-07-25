/**
 * Ordinary Least Squares regression utilities
 *
 * @module pairs/regression
 */

import { centeredCrossMoments } from "../core/statistics";

/**
 * Ordinary Least Squares regression
 * y = beta * x + intercept
 *
 * @param x - Independent variable values
 * @param y - Dependent variable values
 * @returns Regression coefficients, R-squared, and residuals
 *
 * @example
 * ```ts
 * const { beta, intercept, rSquared } = olsRegression([1, 2, 3], [2.1, 3.9, 6.1]);
 * // beta ≈ 2, intercept ≈ 0.033
 * ```
 */
export function olsRegression(
  x: number[],
  y: number[],
): {
  beta: number;
  intercept: number;
  rSquared: number;
  residuals: number[];
} {
  const n = x.length;
  const { meanX, meanY, sxx, sxy } = centeredCrossMoments(x, y);

  const beta = sxx !== 0 ? sxy / sxx : 0;
  const intercept = meanY - beta * meanX;

  // Calculate residuals and R-squared
  let ssRes = 0;
  let ssTot = 0;
  const residuals: number[] = [];

  for (let i = 0; i < n; i++) {
    const predicted = beta * x[i] + intercept;
    const res = y[i] - predicted;
    residuals.push(res);
    ssRes += res * res;
    ssTot += (y[i] - meanY) ** 2;
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { beta, intercept, rSquared, residuals };
}
