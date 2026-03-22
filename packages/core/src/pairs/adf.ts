/**
 * Augmented Dickey-Fuller test for stationarity
 *
 * @module pairs/adf
 */

import { invertMatrix, matMul, matVecMul, transpose } from "./matrix";

/**
 * Approximate p-value for ADF test statistic using linear interpolation
 * between MacKinnon critical values (constant-only case).
 */
function approximateAdfPValue(stat: number): number {
  // Critical value / p-value pairs for constant-only ADF
  if (stat < -3.43) return 0.01;
  if (stat < -2.86) return 0.01 + ((stat - -3.43) / (-2.86 - -3.43)) * 0.04;
  if (stat < -2.57) return 0.05 + ((stat - -2.86) / (-2.57 - -2.86)) * 0.05;
  if (stat < -1.94) return 0.1 + ((stat - -2.57) / (-1.94 - -2.57)) * 0.15;
  if (stat < -1.62) return 0.25 + ((stat - -1.94) / (-1.62 - -1.94)) * 0.25;
  return Math.min(1, 0.5 + (stat + 1.62) * 0.25);
}

/**
 * Augmented Dickey-Fuller test for stationarity
 *
 * Tests whether a time series has a unit root (is non-stationary).
 * Uses the regression: delta_y_t = c + gamma * y_{t-1} + sum(phi_i * delta_y_{t-i}) + error
 *
 * @param series - Time series values
 * @param maxLag - Maximum lag for augmentation (default: cube root of n-1)
 * @returns ADF test statistic, p-value, critical values, and lag used
 *
 * @example
 * ```ts
 * const result = adfTest(residuals);
 * if (result.adfStatistic < result.criticalValues["5%"]) {
 *   console.log("Series is stationary at 5% significance");
 * }
 * ```
 */
export function adfTest(
  series: number[],
  maxLag?: number,
): {
  adfStatistic: number;
  pValue: number;
  criticalValues: { "1%": number; "5%": number; "10%": number };
  lag: number;
} {
  const n = series.length;
  const lag = maxLag ?? Math.floor(Math.cbrt(n - 1));

  // Calculate first differences
  const dy: number[] = [];
  for (let i = 1; i < n; i++) {
    dy.push(series[i] - series[i - 1]);
  }

  // Build regression matrices
  // delta_y_t = c + gamma * y_{t-1} + sum(phi_i * delta_y_{t-i}) + error
  const startIdx = lag;
  const nObs = dy.length - startIdx;

  const criticalValues = { "1%": -3.43, "5%": -2.86, "10%": -2.57 };

  if (nObs < 10) {
    return { adfStatistic: 0, pValue: 1, criticalValues, lag };
  }

  // Dependent variable: delta_y from startIdx onwards
  const Y: number[] = [];
  // Independent variables: [1, y_{t-1}, delta_y_{t-1}, ..., delta_y_{t-lag}]
  const X: number[][] = [];

  for (let t = startIdx; t < dy.length; t++) {
    Y.push(dy[t]);
    const row: number[] = [1, series[t]]; // constant + lagged level
    for (let j = 1; j <= lag; j++) {
      row.push(dy[t - j]);
    }
    X.push(row);
  }

  // OLS: beta = (X'X)^-1 X'Y
  const k = X[0].length;
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtY = matVecMul(Xt, Y);
  const XtXInv = invertMatrix(XtX);

  if (!XtXInv) {
    return { adfStatistic: 0, pValue: 1, criticalValues, lag };
  }

  const beta = matVecMul(XtXInv, XtY);

  // Calculate residuals
  let sse = 0;
  for (let i = 0; i < nObs; i++) {
    let predicted = 0;
    for (let j = 0; j < k; j++) {
      predicted += X[i][j] * beta[j];
    }
    const residual = Y[i] - predicted;
    sse += residual * residual;
  }

  // Standard error of gamma (beta[1])
  const mse = sse / (nObs - k);
  const seGamma = Math.sqrt(mse * XtXInv[1][1]);

  // ADF statistic
  const gamma = beta[1];
  const adfStatistic = seGamma > 0 ? gamma / seGamma : 0;

  // Approximate p-value
  const pValue = approximateAdfPValue(adfStatistic);

  return { adfStatistic, pValue, criticalValues, lag };
}
