/**
 * Pure HMM (Hidden Markov Model) algorithms.
 *
 * Implements Baum-Welch (EM), Viterbi decoding, and scaled forward-backward
 * for Gaussian emission HMMs with diagonal covariance.
 *
 * @module
 */

import { mulberry32, randNormal } from "../../ml/tensor";

// ============================================
// Types
// ============================================

/** Fitted HMM model parameters */
export type HmmModel = {
  /** Number of hidden states */
  numStates: number;
  /** Initial state probabilities */
  pi: number[];
  /** Transition matrix: A[i][j] = P(state j | state i) */
  transitionMatrix: number[][];
  /** Gaussian emission means per state per feature */
  emissionMeans: number[][];
  /** Gaussian emission variances per state per feature (diagonal covariance) */
  emissionVariances: number[][];
  /** Log-likelihood of the fitted model */
  logLikelihood: number;
  /** Whether EM converged within tolerance */
  converged: boolean;
};

/** Options for Baum-Welch and related algorithms */
export type HmmOptions = {
  /** Number of hidden states (default: 3) */
  numStates?: number;
  /** Maximum EM iterations (default: 100) */
  maxIterations?: number;
  /** Convergence tolerance for log-likelihood (default: 1e-6) */
  tolerance?: number;
  /** Random seed for initialization (default: 42) */
  seed?: number;
  /** Number of random restarts to pick the best model (default: 5) */
  numRestarts?: number;
  /** Minimum variance floor to prevent degenerate distributions (default: 1e-6) */
  varianceFloor?: number;
};

// ============================================
// Gaussian Log PDF
// ============================================

/**
 * Log probability density of a univariate Gaussian.
 *
 * @param x - Observed value
 * @param mean - Distribution mean
 * @param variance - Distribution variance (must be > 0)
 * @returns Log probability density
 *
 * @example
 * ```ts
 * gaussianLogPdf(0, 0, 1); // -0.9189...
 * ```
 */
export function gaussianLogPdf(x: number, mean: number, variance: number): number {
  const diff = x - mean;
  return -0.5 * (Math.log(2 * Math.PI * variance) + (diff * diff) / variance);
}

/**
 * Compute log emission probability for an observation vector under a given state.
 * Assumes diagonal covariance (independent features).
 */
function logEmissionProb(obs: number[], means: number[], variances: number[]): number {
  let logP = 0;
  for (let f = 0; f < obs.length; f++) {
    logP += gaussianLogPdf(obs[f], means[f], variances[f]);
  }
  return logP;
}

// ============================================
// Scaled Forward Algorithm
// ============================================

/**
 * Scaled forward algorithm for HMM.
 *
 * Computes forward variables alpha[t][i] with scaling to prevent underflow.
 * Log-likelihood can be recovered as sum(log(scales[t])).
 *
 * @param observations - T x D matrix of observations
 * @param model - Fitted HMM model
 * @returns Scaled alpha matrix and scale factors
 *
 * @example
 * ```ts
 * const { alpha, scales } = forward(obs, model);
 * const logLik = scales.reduce((s, c) => s + Math.log(c), 0);
 * ```
 */
export function forward(
  observations: number[][],
  model: HmmModel,
): { alpha: number[][]; scales: number[] } {
  const T = observations.length;
  const N = model.numStates;
  const alpha: number[][] = new Array(T);
  const scales: number[] = new Array(T);

  // t = 0: initialization
  alpha[0] = new Array(N);
  let scale = 0;
  for (let i = 0; i < N; i++) {
    const logE = logEmissionProb(
      observations[0],
      model.emissionMeans[i],
      model.emissionVariances[i],
    );
    alpha[0][i] = model.pi[i] * Math.exp(logE);
    scale += alpha[0][i];
  }
  // Scale so sum(alpha[0]) = 1
  scales[0] = scale;
  if (scale > 0) {
    for (let i = 0; i < N; i++) {
      alpha[0][i] /= scale;
    }
  }

  // t = 1..T-1: induction
  for (let t = 1; t < T; t++) {
    alpha[t] = new Array(N);
    scale = 0;
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let i = 0; i < N; i++) {
        sum += alpha[t - 1][i] * model.transitionMatrix[i][j];
      }
      const logE = logEmissionProb(
        observations[t],
        model.emissionMeans[j],
        model.emissionVariances[j],
      );
      alpha[t][j] = sum * Math.exp(logE);
      scale += alpha[t][j];
    }
    scales[t] = scale;
    if (scale > 0) {
      for (let j = 0; j < N; j++) {
        alpha[t][j] /= scale;
      }
    }
  }

  return { alpha, scales };
}

// ============================================
// Scaled Backward Algorithm
// ============================================

/**
 * Scaled backward algorithm for HMM.
 *
 * Uses the same scale factors from the forward pass.
 *
 * @param observations - T x D matrix of observations
 * @param model - Fitted HMM model
 * @param scales - Scale factors from forward pass
 * @returns Scaled beta matrix
 *
 * @example
 * ```ts
 * const { alpha, scales } = forward(obs, model);
 * const beta = backward(obs, model, scales);
 * ```
 */
export function backward(observations: number[][], model: HmmModel, scales: number[]): number[][] {
  const T = observations.length;
  const N = model.numStates;
  const beta: number[][] = new Array(T);

  // t = T-1: initialization
  beta[T - 1] = new Array(N).fill(1);

  // t = T-2..0: induction
  for (let t = T - 2; t >= 0; t--) {
    beta[t] = new Array(N);
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < N; j++) {
        const logE = logEmissionProb(
          observations[t + 1],
          model.emissionMeans[j],
          model.emissionVariances[j],
        );
        sum += model.transitionMatrix[i][j] * Math.exp(logE) * beta[t + 1][j];
      }
      beta[t][i] = sum;
    }
    // Scale using same factor
    const s = scales[t + 1];
    if (s > 0) {
      for (let i = 0; i < N; i++) {
        beta[t][i] /= s;
      }
    }
  }

  return beta;
}

// ============================================
// Baum-Welch (EM)
// ============================================

/**
 * Initialize an HMM model with random parameters.
 */
function initializeModel(
  observations: number[][],
  numStates: number,
  rng: () => number,
  varianceFloor: number,
): HmmModel {
  const T = observations.length;
  const D = observations[0].length;

  // Pi: uniform
  const pi = new Array(numStates).fill(1 / numStates);

  // Transition matrix: diagonal-dominant
  const transitionMatrix: number[][] = new Array(numStates);
  for (let i = 0; i < numStates; i++) {
    transitionMatrix[i] = new Array(numStates);
    let rowSum = 0;
    for (let j = 0; j < numStates; j++) {
      transitionMatrix[i][j] = i === j ? 0.7 : 0.3 / (numStates - 1);
      rowSum += transitionMatrix[i][j];
    }
    // Normalize row
    for (let j = 0; j < numStates; j++) {
      transitionMatrix[i][j] /= rowSum;
    }
  }

  // Compute sample variance per feature
  const globalMean = new Array(D).fill(0);
  for (let t = 0; t < T; t++) {
    for (let d = 0; d < D; d++) {
      globalMean[d] += observations[t][d];
    }
  }
  for (let d = 0; d < D; d++) {
    globalMean[d] /= T;
  }

  const globalVar = new Array(D).fill(0);
  for (let t = 0; t < T; t++) {
    for (let d = 0; d < D; d++) {
      const diff = observations[t][d] - globalMean[d];
      globalVar[d] += diff * diff;
    }
  }
  for (let d = 0; d < D; d++) {
    globalVar[d] = Math.max(globalVar[d] / T, varianceFloor);
  }

  // Emission means: random subset from observations + noise
  const emissionMeans: number[][] = new Array(numStates);
  const emissionVariances: number[][] = new Array(numStates);
  for (let s = 0; s < numStates; s++) {
    const idx = Math.floor(rng() * T);
    emissionMeans[s] = new Array(D);
    emissionVariances[s] = new Array(D);
    for (let d = 0; d < D; d++) {
      emissionMeans[s][d] = observations[idx][d] + randNormal(rng) * Math.sqrt(globalVar[d]) * 0.1;
      emissionVariances[s][d] = globalVar[d];
    }
  }

  return {
    numStates,
    pi,
    transitionMatrix,
    emissionMeans,
    emissionVariances,
    logLikelihood: Number.NEGATIVE_INFINITY,
    converged: false,
  };
}

/**
 * Baum-Welch EM algorithm for fitting an HMM to observed data.
 *
 * Fits a Gaussian HMM with diagonal covariance using the EM algorithm.
 * Uses multiple random restarts to avoid local optima.
 *
 * @param observations - T x D matrix of observations (T time steps, D features)
 * @param options - Algorithm options
 * @returns Fitted HMM model with the best log-likelihood across restarts
 *
 * @example
 * ```ts
 * import { baumWelch } from "trendcraft";
 *
 * const obs = [[0.01, 0.1], [-0.02, 0.3], [0.005, 0.12]];
 * const model = baumWelch(obs, { numStates: 2, seed: 42 });
 * console.log(model.transitionMatrix);
 * ```
 */
export function baumWelch(observations: number[][], options?: HmmOptions): HmmModel {
  const numStates = options?.numStates ?? 3;
  const maxIterations = options?.maxIterations ?? 100;
  const tolerance = options?.tolerance ?? 1e-6;
  const seed = options?.seed ?? 42;
  const numRestarts = options?.numRestarts ?? 5;
  const varianceFloor = options?.varianceFloor ?? 1e-6;

  const T = observations.length;
  const D = observations[0].length;

  let bestModel: HmmModel | null = null;

  for (let restart = 0; restart < numRestarts; restart++) {
    const rng = mulberry32(seed + restart * 1000);
    let model = initializeModel(observations, numStates, rng, varianceFloor);

    let prevLogLik = Number.NEGATIVE_INFINITY;
    let converged = false;

    for (let iter = 0; iter < maxIterations; iter++) {
      // E-step: forward-backward
      const { alpha, scales } = forward(observations, model);
      const beta = backward(observations, model, scales);

      // Log-likelihood
      let logLik = 0;
      for (let t = 0; t < T; t++) {
        if (scales[t] > 0) {
          logLik += Math.log(scales[t]);
        }
      }

      // Check convergence
      if (Math.abs(logLik - prevLogLik) < tolerance) {
        converged = true;
        model.logLikelihood = logLik;
        model.converged = true;
        break;
      }
      prevLogLik = logLik;

      // Compute gamma[t][i] = P(state i at time t | observations)
      const gamma: number[][] = new Array(T);
      for (let t = 0; t < T; t++) {
        gamma[t] = new Array(numStates);
        let sum = 0;
        for (let i = 0; i < numStates; i++) {
          gamma[t][i] = alpha[t][i] * beta[t][i];
          sum += gamma[t][i];
        }
        if (sum > 0) {
          for (let i = 0; i < numStates; i++) {
            gamma[t][i] /= sum;
          }
        }
      }

      // Compute xi[t][i][j] = P(state i at t, state j at t+1 | observations)
      const xi: number[][][] = new Array(T - 1);
      for (let t = 0; t < T - 1; t++) {
        xi[t] = new Array(numStates);
        let totalSum = 0;
        for (let i = 0; i < numStates; i++) {
          xi[t][i] = new Array(numStates);
          for (let j = 0; j < numStates; j++) {
            const logE = logEmissionProb(
              observations[t + 1],
              model.emissionMeans[j],
              model.emissionVariances[j],
            );
            xi[t][i][j] =
              alpha[t][i] * model.transitionMatrix[i][j] * Math.exp(logE) * beta[t + 1][j];
            totalSum += xi[t][i][j];
          }
        }
        if (totalSum > 0) {
          for (let i = 0; i < numStates; i++) {
            for (let j = 0; j < numStates; j++) {
              xi[t][i][j] /= totalSum;
            }
          }
        }
      }

      // M-step: update parameters
      const newPi = new Array(numStates);
      const newTransition: number[][] = new Array(numStates);
      const newMeans: number[][] = new Array(numStates);
      const newVariances: number[][] = new Array(numStates);

      for (let i = 0; i < numStates; i++) {
        // Pi
        newPi[i] = gamma[0][i];

        // Transition matrix
        newTransition[i] = new Array(numStates);
        let gammaSum = 0;
        for (let t = 0; t < T - 1; t++) {
          gammaSum += gamma[t][i];
        }

        for (let j = 0; j < numStates; j++) {
          let xiSum = 0;
          for (let t = 0; t < T - 1; t++) {
            xiSum += xi[t][i][j];
          }
          newTransition[i][j] = gammaSum > 0 ? xiSum / gammaSum : 1 / numStates;
        }

        // Emission means
        newMeans[i] = new Array(D).fill(0);
        let totalGamma = 0;
        for (let t = 0; t < T; t++) {
          totalGamma += gamma[t][i];
          for (let d = 0; d < D; d++) {
            newMeans[i][d] += gamma[t][i] * observations[t][d];
          }
        }
        if (totalGamma > 0) {
          for (let d = 0; d < D; d++) {
            newMeans[i][d] /= totalGamma;
          }
        }

        // Emission variances
        newVariances[i] = new Array(D).fill(0);
        for (let t = 0; t < T; t++) {
          for (let d = 0; d < D; d++) {
            const diff = observations[t][d] - newMeans[i][d];
            newVariances[i][d] += gamma[t][i] * diff * diff;
          }
        }
        if (totalGamma > 0) {
          for (let d = 0; d < D; d++) {
            newVariances[i][d] = Math.max(newVariances[i][d] / totalGamma, varianceFloor);
          }
        } else {
          for (let d = 0; d < D; d++) {
            newVariances[i][d] = varianceFloor;
          }
        }
      }

      model = {
        numStates,
        pi: newPi,
        transitionMatrix: newTransition,
        emissionMeans: newMeans,
        emissionVariances: newVariances,
        logLikelihood: logLik,
        converged: false,
      };
    }

    // Compute final log-likelihood if not converged
    if (!model.converged) {
      const { scales } = forward(observations, model);
      let logLik = 0;
      for (let t = 0; t < T; t++) {
        if (scales[t] > 0) {
          logLik += Math.log(scales[t]);
        }
      }
      model.logLikelihood = logLik;
    }

    if (!bestModel || model.logLikelihood > bestModel.logLikelihood) {
      bestModel = model;
    }
  }

  return bestModel!;
}

// ============================================
// Viterbi Algorithm
// ============================================

/**
 * Log-space Viterbi algorithm for finding the most likely state sequence.
 *
 * @param observations - T x D matrix of observations
 * @param model - Fitted HMM model
 * @returns Array of state indices (0-based) for each time step
 *
 * @example
 * ```ts
 * const model = baumWelch(obs, { numStates: 2 });
 * const states = viterbi(obs, model);
 * // states[0] = 0 or 1
 * ```
 */
export function viterbi(observations: number[][], model: HmmModel): number[] {
  const T = observations.length;
  const N = model.numStates;

  // delta[t][i] = max log probability of path ending in state i at time t
  const delta: number[][] = new Array(T);
  // psi[t][i] = backpointer for traceback
  const psi: number[][] = new Array(T);

  // t = 0: initialization
  delta[0] = new Array(N);
  psi[0] = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const logPi = model.pi[i] > 0 ? Math.log(model.pi[i]) : -1e300;
    const logE = logEmissionProb(
      observations[0],
      model.emissionMeans[i],
      model.emissionVariances[i],
    );
    delta[0][i] = logPi + logE;
  }

  // t = 1..T-1: induction
  for (let t = 1; t < T; t++) {
    delta[t] = new Array(N);
    psi[t] = new Array(N);
    for (let j = 0; j < N; j++) {
      let maxVal = Number.NEGATIVE_INFINITY;
      let maxIdx = 0;
      for (let i = 0; i < N; i++) {
        const logA =
          model.transitionMatrix[i][j] > 0 ? Math.log(model.transitionMatrix[i][j]) : -1e300;
        const val = delta[t - 1][i] + logA;
        if (val > maxVal) {
          maxVal = val;
          maxIdx = i;
        }
      }
      const logE = logEmissionProb(
        observations[t],
        model.emissionMeans[j],
        model.emissionVariances[j],
      );
      delta[t][j] = maxVal + logE;
      psi[t][j] = maxIdx;
    }
  }

  // Traceback
  const path = new Array(T);
  let maxVal = Number.NEGATIVE_INFINITY;
  let maxIdx = 0;
  for (let i = 0; i < N; i++) {
    if (delta[T - 1][i] > maxVal) {
      maxVal = delta[T - 1][i];
      maxIdx = i;
    }
  }
  path[T - 1] = maxIdx;
  for (let t = T - 2; t >= 0; t--) {
    path[t] = psi[t + 1][path[t + 1]];
  }

  return path;
}
