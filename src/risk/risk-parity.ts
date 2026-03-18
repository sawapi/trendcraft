/**
 * Risk Parity Allocation and Correlation-Adjusted Position Sizing
 *
 * Risk parity equalizes risk contribution across assets in a portfolio.
 * Correlation-adjusted sizing reduces position size when assets are highly correlated.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for risk parity allocation */
export type RiskParityOptions = {
  /** Maximum iterations for optimization (default: 100) */
  maxIterations?: number;
  /** Convergence tolerance (default: 1e-8) */
  tolerance?: number;
  /** Risk-free rate for Sharpe calculations (default: 0) */
  riskFreeRate?: number;
};

/** Result of risk parity allocation */
export type RiskParityResult = {
  /** Allocation weights (key: asset name, value: weight 0-1) */
  weights: Record<string, number>;
  /** Risk contribution of each asset (should be approximately equal in risk parity) */
  riskContributions: Record<string, number>;
  /** Portfolio volatility */
  portfolioVolatility: number;
  /** Correlation matrix */
  correlationMatrix: number[][];
};

/** Options for correlation-adjusted position sizing */
export type CorrelationAdjustedSizeOptions = {
  /** Base position size (in capital units or shares) */
  baseSize: number;
  /** Maximum average correlation to apply full size (default: 0.3) */
  lowCorrelationThreshold?: number;
  /** Average correlation above which position is minimized (default: 0.7) */
  highCorrelationThreshold?: number;
  /** Minimum size factor (default: 0.25) */
  minSizeFactor?: number;
};

/** Result of correlation-adjusted position sizing */
export type CorrelationAdjustedSizeResult = {
  /** Adjusted position size */
  adjustedSize: number;
  /** Size factor applied (0-1) */
  sizeFactor: number;
  /** Average pairwise correlation */
  averageCorrelation: number;
};

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

/**
 * Compute the Pearson correlation between two number arrays of equal length.
 * Returns 0 if either series has zero variance.
 */
function pearsonCorr(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) return 0;
  const muA = mean(a);
  const muB = mean(b);
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - muA;
    const db = b[i] - muB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
}

/**
 * Compute covariance matrix from an array of return series.
 * Each row in the input represents one asset's returns.
 */
function covarianceMatrix(series: number[][]): number[][] {
  const n = series.length;
  const len = series[0].length;
  const means = series.map(mean);
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < len; k++) {
        sum += (series[i][k] - means[i]) * (series[j][k] - means[j]);
      }
      const val = sum / len;
      cov[i][j] = val;
      cov[j][i] = val;
    }
  }
  return cov;
}

/**
 * Compute correlation matrix from a covariance matrix.
 */
function correlationFromCov(covMatrix: number[][]): number[][] {
  const n = covMatrix.length;
  const corr: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  );
  const stddevs = covMatrix.map((_, i) => Math.sqrt(covMatrix[i][i]));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const denom = stddevs[i] * stddevs[j];
      corr[i][j] = denom === 0 ? (i === j ? 1 : 0) : covMatrix[i][j] / denom;
    }
  }
  return corr;
}

/**
 * Calculate portfolio volatility given weights and covariance matrix.
 * sigma_p = sqrt(w' * Cov * w)
 */
function portfolioVol(weights: number[], covMatrix: number[][]): number {
  const n = weights.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sum += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return Math.sqrt(Math.max(0, sum));
}

/**
 * Normalize weights so they sum to 1.
 */
function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum === 0) return weights.map(() => 1 / weights.length);
  return weights.map((w) => w / sum);
}

// ---------------------------------------------------------------------------
// Main functions
// ---------------------------------------------------------------------------

/**
 * Calculate risk parity allocation weights.
 *
 * Risk parity equalizes the marginal risk contribution of each asset so that
 * no single asset dominates portfolio risk. The algorithm starts with
 * inverse-volatility weights and iteratively adjusts until risk contributions
 * converge.
 *
 * @param returnsSeries - Object mapping asset names to their return arrays
 * @param options - Optimization options
 * @returns Risk parity allocation result
 *
 * @example
 * ```ts
 * const returns = {
 *   SPY:  [0.01, -0.005, 0.008, ...],
 *   TLT:  [0.003, 0.002, -0.001, ...],
 *   GLD:  [-0.002, 0.004, 0.001, ...],
 * };
 * const result = riskParityAllocation(returns);
 * // result.weights => { SPY: 0.20, TLT: 0.45, GLD: 0.35 }
 * // result.riskContributions => approximately equal for each asset
 * ```
 */
export function riskParityAllocation(
  returnsSeries: Record<string, number[]>,
  options?: RiskParityOptions,
): RiskParityResult {
  const maxIterations = options?.maxIterations ?? 1000;
  const tolerance = options?.tolerance ?? 1e-8;

  const assetNames = Object.keys(returnsSeries);
  const n = assetNames.length;

  // Single asset case
  if (n === 1) {
    const series = [returnsSeries[assetNames[0]]];
    const covMat = covarianceMatrix(series);
    const vol = Math.sqrt(Math.max(0, covMat[0][0]));
    return {
      weights: { [assetNames[0]]: 1 },
      riskContributions: { [assetNames[0]]: 1 },
      portfolioVolatility: vol,
      correlationMatrix: [[1]],
    };
  }

  const series = assetNames.map((name) => returnsSeries[name]);
  const covMat = covarianceMatrix(series);
  const corrMat = correlationFromCov(covMat);

  // Initial weights: inverse volatility
  const vols = series.map((_, i) => Math.sqrt(Math.max(0, covMat[i][i])));
  let weights: number[];

  // Handle zero-volatility assets
  const hasNonZeroVol = vols.some((v) => v > 0);
  if (!hasNonZeroVol) {
    weights = new Array(n).fill(1 / n);
  } else {
    weights = vols.map((v) => (v > 0 ? 1 / v : 0));
    weights = normalizeWeights(weights);
  }

  // Iterative risk parity optimization using the Spinu (2013) approach:
  // Minimize sum_i (RC_i - target)^2 via damped multiplicative updates
  const targetRc = 1 / n;

  for (let iter = 0; iter < maxIterations; iter++) {
    const pVol = portfolioVol(weights, covMat);
    if (pVol === 0) break;

    // Calculate marginal risk contributions
    // RC_i = w_i * (Cov * w)_i / sigma_p
    const covW: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        covW[i] += covMat[i][j] * weights[j];
      }
    }

    const rc: number[] = new Array(n);
    let rcSum = 0;
    for (let i = 0; i < n; i++) {
      rc[i] = (weights[i] * covW[i]) / pVol;
      rcSum += rc[i];
    }

    // Normalize risk contributions to sum to 1
    const rcNorm: number[] = rc.map((r) => (rcSum > 0 ? r / rcSum : targetRc));

    // Check convergence
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(rcNorm[i] - targetRc));
    }
    if (maxDiff < tolerance) break;

    // Damped multiplicative update: w_i_new = w_i * sqrt(target / actual)
    // Using sqrt for damping prevents oscillation
    for (let i = 0; i < n; i++) {
      if (rcNorm[i] > 0) {
        weights[i] = weights[i] * Math.sqrt(targetRc / rcNorm[i]);
      }
    }
    weights = normalizeWeights(weights);
  }

  // Final risk contributions
  const finalVol = portfolioVol(weights, covMat);
  const finalCovW: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      finalCovW[i] += covMat[i][j] * weights[j];
    }
  }

  let rcSum = 0;
  const finalRc: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    finalRc[i] = finalVol > 0 ? (weights[i] * finalCovW[i]) / finalVol : 0;
    rcSum += finalRc[i];
  }

  // Build result objects
  const weightsObj: Record<string, number> = {};
  const rcObj: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    weightsObj[assetNames[i]] = weights[i];
    rcObj[assetNames[i]] = rcSum > 0 ? finalRc[i] / rcSum : 1 / n;
  }

  return {
    weights: weightsObj,
    riskContributions: rcObj,
    portfolioVolatility: finalVol,
    correlationMatrix: corrMat,
  };
}

/**
 * Adjust position size based on correlation with existing portfolio holdings.
 *
 * When the new position is highly correlated with existing holdings, the size
 * is reduced to limit concentration risk. When correlation is low, full size
 * is applied.
 *
 * @param currentReturns - Returns of the asset being sized
 * @param portfolioReturns - Returns of existing portfolio holdings
 * @param options - Sizing options including thresholds
 * @returns Adjusted size and correlation metrics
 *
 * @example
 * ```ts
 * const result = correlationAdjustedSize(
 *   stockReturns,
 *   [existingPos1Returns, existingPos2Returns],
 *   { baseSize: 10000 }
 * );
 * // result.adjustedSize might be 7500 if moderately correlated
 * ```
 */
export function correlationAdjustedSize(
  currentReturns: number[],
  portfolioReturns: number[][],
  options: CorrelationAdjustedSizeOptions,
): CorrelationAdjustedSizeResult {
  const {
    baseSize,
    lowCorrelationThreshold = 0.3,
    highCorrelationThreshold = 0.7,
    minSizeFactor = 0.25,
  } = options;

  // No existing holdings => full size
  if (portfolioReturns.length === 0) {
    return {
      adjustedSize: baseSize,
      sizeFactor: 1,
      averageCorrelation: 0,
    };
  }

  // Calculate average absolute correlation with each existing holding
  let totalCorr = 0;
  for (const holdingReturns of portfolioReturns) {
    // Use the shorter length for comparison
    const len = Math.min(currentReturns.length, holdingReturns.length);
    if (len === 0) continue;
    const a = currentReturns.slice(0, len);
    const b = holdingReturns.slice(0, len);
    totalCorr += Math.abs(pearsonCorr(a, b));
  }
  const avgCorr = totalCorr / portfolioReturns.length;

  // Linear interpolation between thresholds
  let sizeFactor: number;
  if (avgCorr <= lowCorrelationThreshold) {
    sizeFactor = 1;
  } else if (avgCorr >= highCorrelationThreshold) {
    sizeFactor = minSizeFactor;
  } else {
    // Linear interpolation
    const t =
      (avgCorr - lowCorrelationThreshold) /
      (highCorrelationThreshold - lowCorrelationThreshold);
    sizeFactor = 1 - t * (1 - minSizeFactor);
  }

  return {
    adjustedSize: baseSize * sizeFactor,
    sizeFactor,
    averageCorrelation: avgCorr,
  };
}
