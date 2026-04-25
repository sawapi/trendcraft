/**
 * GARCH(1,1) and EWMA Volatility Models
 *
 * GARCH (Generalized Autoregressive Conditional Heteroskedasticity) models
 * capture volatility clustering — periods of high volatility tend to be
 * followed by high volatility and vice versa.
 *
 * @module
 */

import { type AnnualizationOptions, annualizationFactor } from "../../calendar";
import { tagSeries } from "../../core/tag-series";
import type { Series } from "../../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** GARCH model options */
export type GarchOptions = AnnualizationOptions & {
  /** GARCH lag order (default: 1) */
  p?: number;
  /** ARCH lag order (default: 1) */
  q?: number;
  /** Maximum iterations for MLE optimization (default: 100) */
  maxIterations?: number;
  /** Convergence tolerance (default: 1e-6) */
  tolerance?: number;
};

/** GARCH model result */
export type GarchResult = {
  /** Conditional variance time series */
  conditionalVariance: Series<number>;
  /** Next period volatility forecast (annualized, as percentage) */
  volatilityForecast: number;
  /** Estimated GARCH parameters */
  params: { omega: number; alpha: number; beta: number };
  /** Log-likelihood of the fitted model */
  logLikelihood: number;
  /** Whether optimization converged */
  converged: boolean;
};

/** EWMA volatility options */
export type EwmaVolatilityOptions = AnnualizationOptions & {
  /** Decay factor (default: 0.94, RiskMetrics standard) */
  lambda?: number;
};

// ---------------------------------------------------------------------------
// Nelder-Mead Simplex Optimiser (internal)
// ---------------------------------------------------------------------------

type NelderMeadOptions = {
  maxIter: number;
  tol: number;
};

type NelderMeadResult = {
  x: number[];
  fx: number;
  converged: boolean;
};

/**
 * Nelder-Mead simplex optimisation for unconstrained minimisation.
 *
 * Standard coefficients: reflection α=1, expansion γ=2,
 * contraction ρ=0.5, shrink σ=0.5.
 */
/** @internal Exported for testing only */
export function nelderMead(
  fn: (x: number[]) => number,
  initial: number[],
  options?: Partial<NelderMeadOptions>,
): NelderMeadResult {
  const maxIter = options?.maxIter ?? 200;
  const tol = options?.tol ?? 1e-6;
  const n = initial.length;

  // Reflection / expansion / contraction / shrink coefficients
  const ALPHA = 1.0;
  const GAMMA = 2.0;
  const RHO = 0.5;
  const SIGMA = 0.5;

  // Build initial simplex: n+1 vertices
  const simplex: { x: number[]; fx: number }[] = [];

  const x0 = [...initial];
  simplex.push({ x: x0, fx: fn(x0) });

  for (let i = 0; i < n; i++) {
    const xi = [...initial];
    xi[i] += xi[i] !== 0 ? 0.05 * Math.abs(xi[i]) : 0.00025;
    simplex.push({ x: xi, fx: fn(xi) });
  }

  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort ascending by function value
    simplex.sort((a, b) => a.fx - b.fx);

    // Convergence check: range of function values
    const fRange = Math.abs(simplex[n].fx - simplex[0].fx);
    if (fRange < tol) {
      converged = true;
      break;
    }

    // Centroid of all points except the worst
    const centroid = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i].x[j];
      }
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;

    const worst = simplex[n];

    // Reflection
    const xr = centroid.map((c, j) => c + ALPHA * (c - worst.x[j]));
    const fr = fn(xr);

    if (fr < simplex[n - 1].fx && fr >= simplex[0].fx) {
      // Accept reflection
      simplex[n] = { x: xr, fx: fr };
      continue;
    }

    if (fr < simplex[0].fx) {
      // Expansion
      const xe = centroid.map((c, j) => c + GAMMA * (xr[j] - c));
      const fe = fn(xe);
      simplex[n] = fe < fr ? { x: xe, fx: fe } : { x: xr, fx: fr };
      continue;
    }

    // Contraction
    const xc = centroid.map((c, j) => c + RHO * (worst.x[j] - c));
    const fc = fn(xc);

    if (fc < worst.fx) {
      simplex[n] = { x: xc, fx: fc };
      continue;
    }

    // Shrink: move all points toward the best
    const best = simplex[0];
    for (let i = 1; i <= n; i++) {
      for (let j = 0; j < n; j++) {
        simplex[i].x[j] = best.x[j] + SIGMA * (simplex[i].x[j] - best.x[j]);
      }
      simplex[i].fx = fn(simplex[i].x);
    }
  }

  simplex.sort((a, b) => a.fx - b.fx);
  return { x: simplex[0].x, fx: simplex[0].fx, converged };
}

// ---------------------------------------------------------------------------
// Helper: sample variance
// ---------------------------------------------------------------------------

function sampleVariance(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
}

// ---------------------------------------------------------------------------
// garch
// ---------------------------------------------------------------------------

/**
 * Fit a GARCH(1,1) model to a return series via maximum likelihood estimation.
 *
 * The conditional variance follows:
 *   σ²_t = ω + α · r²_{t-1} + β · σ²_{t-1}
 *
 * Parameters are estimated by minimising the negative log-likelihood using
 * Nelder-Mead simplex optimisation. Stationarity constraint α + β < 1 is
 * enforced via a penalty term.
 *
 * @param returns - Array of log-returns (or simple returns)
 * @param options - GARCH fitting options
 * @returns GARCH model result including conditional variance series and forecast
 *
 * @example
 * ```ts
 * const returns = [0.01, -0.02, 0.005, -0.01, 0.03, -0.015, 0.008, -0.005];
 * const result = garch(returns);
 * console.log(result.params);           // { omega, alpha, beta }
 * console.log(result.volatilityForecast); // annualised vol forecast (%)
 * ```
 */
export function garch(returns: number[], options?: GarchOptions): GarchResult {
  const maxIterations = options?.maxIterations ?? 100;
  const tolerance = options?.tolerance ?? 1e-6;
  const sqrtAnnualization = Math.sqrt(annualizationFactor(options));

  const T = returns.length;
  if (T < 3) {
    // Not enough data — return degenerate result
    const v = sampleVariance(returns);
    return {
      conditionalVariance: returns.map((_, i) => ({ time: i, value: v })),
      volatilityForecast: Math.sqrt(v) * sqrtAnnualization * 100,
      params: { omega: v, alpha: 0, beta: 0 },
      logLikelihood: Number.NEGATIVE_INFINITY,
      converged: false,
    };
  }

  const unconditionalVar = sampleVariance(returns);

  // Negative log-likelihood (to minimise)
  const negLogLikelihood = (params: number[]): number => {
    const omega = params[0];
    const alpha = params[1];
    const beta = params[2];

    // Constraint checks — return penalty if violated
    if (omega <= 0 || alpha < 0 || beta < 0 || alpha + beta >= 1) {
      return 1e10;
    }

    let sigma2 = unconditionalVar; // initialise with unconditional variance
    let ll = 0;

    for (let t = 0; t < T; t++) {
      if (sigma2 < 1e-20) sigma2 = 1e-20; // numerical floor
      ll += Math.log(sigma2) + returns[t] ** 2 / sigma2;
      // Update for next period
      sigma2 = omega + alpha * returns[t] ** 2 + beta * sigma2;
    }

    return 0.5 * ll;
  };

  // Initial parameter guess
  const initOmega = unconditionalVar * 0.1;
  const initAlpha = 0.1;
  const initBeta = 0.8;

  const result = nelderMead(negLogLikelihood, [initOmega, initAlpha, initBeta], {
    maxIter: maxIterations,
    tol: tolerance,
  });

  let [omega, alpha, beta] = result.x;

  // Clamp to valid range
  if (omega <= 0) omega = 1e-10;
  if (alpha < 0) alpha = 0;
  if (beta < 0) beta = 0;
  if (alpha + beta >= 1) {
    const scale = 0.999 / (alpha + beta);
    alpha *= scale;
    beta *= scale;
  }

  // Reconstruct conditional variance series with fitted params
  const condVar: Series<number> = [];
  let sigma2 = unconditionalVar;

  for (let t = 0; t < T; t++) {
    condVar.push({ time: t, value: sigma2 });
    sigma2 = omega + alpha * returns[t] ** 2 + beta * sigma2;
  }

  // One-step-ahead forecast
  const forecastVar = sigma2; // already computed for t = T
  const volatilityForecast = Math.sqrt(forecastVar) * sqrtAnnualization * 100;

  return {
    conditionalVariance: condVar,
    volatilityForecast,
    params: { omega, alpha, beta },
    logLikelihood: -result.fx,
    converged: result.converged,
  };
}

// ---------------------------------------------------------------------------
// ewmaVolatility
// ---------------------------------------------------------------------------

/**
 * Compute EWMA (Exponentially Weighted Moving Average) volatility.
 *
 * The conditional variance follows:
 *   σ²_t = λ · σ²_{t-1} + (1 - λ) · r²_t
 *
 * The default decay factor λ = 0.94 matches the RiskMetrics standard.
 * Returns annualised volatility as a percentage: sqrt(σ²_t) * sqrt(252) * 100.
 *
 * @param returns - Array of log-returns (or simple returns)
 * @param options - EWMA options
 * @returns Series of annualised volatility values (percentage)
 *
 * @example
 * ```ts
 * const returns = [0.01, -0.02, 0.005, -0.01, 0.03, -0.015, 0.008, -0.005];
 * const vol = ewmaVolatility(returns);
 * // vol[0].value ~ annualised vol (%) at time 0
 * ```
 */
export function ewmaVolatility(returns: number[], options?: EwmaVolatilityOptions): Series<number> {
  const lambda = options?.lambda ?? 0.94;
  const T = returns.length;

  if (T === 0) return [];

  // Seed variance: variance of first min(10, T) returns
  const seedCount = Math.min(10, T);
  let sigma2 = sampleVariance(returns.slice(0, seedCount));
  if (sigma2 === 0) sigma2 = 1e-10; // prevent zero variance

  const sqrtAnnualization = Math.sqrt(annualizationFactor(options));
  const result: Series<number> = [];

  for (let t = 0; t < T; t++) {
    sigma2 = lambda * sigma2 + (1 - lambda) * returns[t] ** 2;
    result.push({ time: t, value: Math.sqrt(sigma2) * sqrtAnnualization * 100 });
  }

  return tagSeries(result, { kind: "garch", overlay: false, label: "GARCH" });
}
