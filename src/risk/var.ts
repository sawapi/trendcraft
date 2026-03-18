/**
 * Value at Risk (VaR) and Conditional VaR (CVaR / Expected Shortfall)
 *
 * Provides three calculation methods:
 * - Historical simulation
 * - Parametric (normal distribution)
 * - Cornish-Fisher expansion (adjusts for skewness and kurtosis)
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** VaR calculation method */
export type VarMethod = "historical" | "parametric" | "cornishFisher";

/** Options for VaR calculation */
export type VarOptions = {
  /** Confidence level (default: 0.95) */
  confidence?: number;
  /** VaR calculation method (default: 'historical') */
  method?: VarMethod;
};

/** Result of a VaR calculation */
export type VarResult = {
  /** Value at Risk (positive number = loss amount as decimal, e.g. 0.05 = 5% loss) */
  var: number;
  /** Conditional VaR / Expected Shortfall (average loss beyond VaR) */
  cvar: number;
  /** Method used */
  method: VarMethod;
  /** Confidence level used */
  confidence: number;
  /** Number of observations */
  observations: number;
  /** Skewness of return distribution */
  skewness: number;
  /** Excess kurtosis of return distribution */
  kurtosis: number;
};

/** Options for rolling VaR */
export type RollingVarOptions = {
  /** Rolling window size (default: 60) */
  window?: number;
  /** Confidence level (default: 0.95) */
  confidence?: number;
  /** Method (default: 'historical') */
  method?: VarMethod;
};

/** Rolling VaR value */
export type RollingVarValue = {
  var: number;
  cvar: number;
};

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Standard normal PDF
 *
 * @example
 * ```ts
 * normalPdf(0); // ~0.3989
 * ```
 */
function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Inverse standard normal CDF using the Beasley-Springer-Moro algorithm.
 * Accurate to approximately 1e-8 for 0 < p < 1.
 *
 * @example
 * ```ts
 * normalInverseCdf(0.95); // ~1.6449
 * ```
 */
function normalInverseCdf(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error("normalInverseCdf: p must be in (0, 1)");
  }

  // Coefficients for the rational approximation
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    // Rational approximation for lower region
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    // Rational approximation for central region
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    // Rational approximation for upper region
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
          c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function stdDev(arr: number[], mu: number): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - mu;
    sum += d * d;
  }
  return Math.sqrt(sum / arr.length);
}

function skewness(arr: number[], mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = (arr[i] - mu) / sigma;
    sum += d * d * d;
  }
  return sum / arr.length;
}

function excessKurtosis(arr: number[], mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = (arr[i] - mu) / sigma;
    sum += d * d * d * d;
  }
  return sum / arr.length - 3;
}

// ---------------------------------------------------------------------------
// Main functions
// ---------------------------------------------------------------------------

/**
 * Calculate Value at Risk (VaR) and Conditional VaR (CVaR).
 *
 * VaR is returned as a positive number representing the potential loss.
 * For example, VaR = 0.05 means a 5% loss at the given confidence level.
 *
 * @param returns - Array of period returns (e.g. daily returns as decimals)
 * @param options - Calculation options
 * @returns VaR result including CVaR, distribution statistics
 *
 * @example
 * ```ts
 * const dailyReturns = [0.01, -0.02, 0.005, -0.03, 0.015, ...];
 * const result = calculateVaR(dailyReturns, { confidence: 0.95, method: 'historical' });
 * console.log(result.var);  // e.g. 0.025 (2.5% loss)
 * console.log(result.cvar); // e.g. 0.035 (3.5% avg loss beyond VaR)
 * ```
 */
export function calculateVaR(
  returns: number[],
  options?: VarOptions,
): VarResult {
  const confidence = options?.confidence ?? 0.95;
  const method = options?.method ?? "historical";

  if (returns.length === 0) {
    return {
      var: 0,
      cvar: 0,
      method,
      confidence,
      observations: 0,
      skewness: 0,
      kurtosis: 0,
    };
  }

  const mu = mean(returns);
  const sigma = stdDev(returns, mu);
  const skew = skewness(returns, mu, sigma);
  const kurt = excessKurtosis(returns, mu, sigma);

  let varValue: number;
  let cvarValue: number;

  switch (method) {
    case "historical": {
      const sorted = [...returns].sort((a, b) => a - b);
      const idx = Math.round((1 - confidence) * sorted.length);
      const cutoffIdx = Math.max(0, Math.min(idx, sorted.length - 1));
      varValue = -sorted[cutoffIdx];

      // CVaR = average of returns at or below VaR threshold
      const threshold = sorted[cutoffIdx];
      let tailSum = 0;
      let tailCount = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] <= threshold) {
          tailSum += sorted[i];
          tailCount++;
        }
      }
      cvarValue = tailCount > 0 ? -(tailSum / tailCount) : varValue;
      break;
    }

    case "parametric": {
      const z = normalInverseCdf(confidence);
      varValue = -(mu - z * sigma);

      // CVaR for normal distribution: -(mu - sigma * phi(z) / (1 - confidence))
      const phi = normalPdf(z);
      cvarValue = -(mu - (sigma * phi) / (1 - confidence));
      break;
    }

    case "cornishFisher": {
      const z = normalInverseCdf(confidence);
      // Cornish-Fisher expansion to adjust z-score for non-normal distributions
      const zCf =
        z +
        ((z * z - 1) * skew) / 6 +
        ((z * z * z - 3 * z) * kurt) / 24 -
        ((2 * z * z * z - 5 * z) * skew * skew) / 36;

      varValue = -(mu - zCf * sigma);

      // Hybrid CVaR: use returns below VaR threshold
      const threshold = mu - zCf * sigma;
      let tailSum = 0;
      let tailCount = 0;
      for (let i = 0; i < returns.length; i++) {
        if (returns[i] <= threshold) {
          tailSum += returns[i];
          tailCount++;
        }
      }
      cvarValue = tailCount > 0 ? -(tailSum / tailCount) : varValue;
      break;
    }
  }

  return {
    var: varValue,
    cvar: cvarValue,
    method,
    confidence,
    observations: returns.length,
    skewness: skew,
    kurtosis: kurt,
  };
}

/**
 * Calculate rolling VaR and CVaR over a sliding window.
 *
 * @param returns - Array of period returns
 * @param options - Rolling window options
 * @returns Array of rolling VaR/CVaR values (length = returns.length - window + 1)
 *
 * @example
 * ```ts
 * const dailyReturns = [...]; // 252 daily returns
 * const rolling = rollingVaR(dailyReturns, { window: 60, confidence: 0.95 });
 * // rolling.length === 193 (252 - 60 + 1)
 * ```
 */
export function rollingVaR(
  returns: number[],
  options?: RollingVarOptions,
): RollingVarValue[] {
  const window = options?.window ?? 60;
  const confidence = options?.confidence ?? 0.95;
  const method = options?.method ?? "historical";

  if (returns.length < window) {
    return [];
  }

  const results: RollingVarValue[] = [];

  for (let i = 0; i <= returns.length - window; i++) {
    const windowReturns = returns.slice(i, i + window);
    const result = calculateVaR(windowReturns, { confidence, method });
    results.push({ var: result.var, cvar: result.cvar });
  }

  return results;
}
