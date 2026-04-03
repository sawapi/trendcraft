/**
 * HMM Regime Detection - user-facing API.
 *
 * Uses a Gaussian Hidden Markov Model to detect market regimes
 * (trending-up, ranging, trending-down) from price data.
 *
 * @module
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, Series } from "../../types";
import { HMM_REGIME_META } from "../indicator-meta";
import { baumWelch, forward, viterbi } from "./hmm-core";
import type { HmmModel, HmmOptions } from "./hmm-core";
import { extractFeatures } from "./hmm-features";
import type { FeatureOptions } from "./hmm-features";

// ============================================
// Types
// ============================================

/** Options for HMM regime detection */
export type HmmRegimeOptions = {
  /** Number of regime states (default: 3) */
  numStates?: number;
  /** Max EM iterations (default: 100) */
  maxIterations?: number;
  /** Random seed (default: 42) */
  seed?: number;
  /** Number of random restarts (default: 5) */
  numRestarts?: number;
  /** Feature extraction options */
  featureOptions?: FeatureOptions;
};

/** Regime detection result per time step */
export type HmmRegimeValue = {
  /** Regime index (0-based) */
  regime: number;
  /** Human-readable label: "trending-up", "ranging", "trending-down" or "state-N" */
  label: string;
  /** State probabilities at this time step */
  probabilities: number[];
  /** Log-likelihood of the fitted model */
  logLikelihood: number;
};

/** Transition matrix analysis */
export type RegimeTransitionInfo = {
  /** Transition probability matrix */
  matrix: number[][];
  /** Labels for each state */
  labels: string[];
  /** Expected duration in each state: 1 / (1 - self-transition prob) */
  expectedDurations: number[];
  /** Stationary distribution (eigenvector of transition matrix) */
  stationaryDistribution: number[];
};

// ============================================
// Label Assignment
// ============================================

/**
 * Assign labels to states based on mean return.
 * For 3 states: sort by mean return -> trending-down, ranging, trending-up.
 * For other counts: use "state-0", "state-1", etc.
 */
function assignLabels(model: HmmModel): string[] {
  const N = model.numStates;
  if (N === 3) {
    // Sort state indices by mean return (feature 0)
    const indexed = model.emissionMeans
      .map((m, i) => ({ idx: i, meanReturn: m[0] }))
      .sort((a, b) => a.meanReturn - b.meanReturn);

    const labels = new Array(N);
    labels[indexed[0].idx] = "trending-down";
    labels[indexed[1].idx] = "ranging";
    labels[indexed[2].idx] = "trending-up";
    return labels;
  }

  return Array.from({ length: N }, (_, i) => `state-${i}`);
}

// ============================================
// Stationary Distribution
// ============================================

/**
 * Compute stationary distribution by power iteration.
 */
function computeStationaryDistribution(transitionMatrix: number[][]): number[] {
  const N = transitionMatrix.length;
  let dist = new Array(N).fill(1 / N);

  // Power iteration (100 steps is more than enough)
  for (let iter = 0; iter < 100; iter++) {
    const newDist = new Array(N).fill(0);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        newDist[j] += dist[i] * transitionMatrix[i][j];
      }
    }
    dist = newDist;
  }

  // Normalize
  const sum = dist.reduce((s, v) => s + v, 0);
  if (sum > 0) {
    for (let i = 0; i < N; i++) {
      dist[i] /= sum;
    }
  }

  return dist;
}

// ============================================
// Helpers
// ============================================

function toBaumWelchOptions(options?: HmmRegimeOptions): HmmOptions {
  return {
    numStates: options?.numStates ?? 3,
    maxIterations: options?.maxIterations ?? 100,
    seed: options?.seed ?? 42,
    numRestarts: options?.numRestarts ?? 5,
  };
}

// ============================================
// Public API
// ============================================

/**
 * Detect market regimes using a Hidden Markov Model.
 *
 * Fits a Gaussian HMM to candle features (returns, volatility, volume ratio,
 * range, body ratio) and classifies each bar into a regime state.
 *
 * @param candles - Raw or normalized candle data
 * @param options - Detection options
 * @returns Series of regime values with probabilities
 *
 * @example
 * ```ts
 * import { hmmRegimes } from "trendcraft";
 *
 * const regimes = hmmRegimes(candles, { numStates: 3 });
 * for (const r of regimes) {
 *   console.log(`${r.value.label}: ${r.value.probabilities}`);
 * }
 * ```
 */
export function hmmRegimes(candles: Candle[], options?: HmmRegimeOptions): Series<HmmRegimeValue> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const features = extractFeatures(normalized, options?.featureOptions);
  const model = baumWelch(features, toBaumWelchOptions(options));

  const states = viterbi(features, model);
  const { alpha } = forward(features, model);
  const labels = assignLabels(model);

  const result: Series<HmmRegimeValue> = new Array(normalized.length);
  for (let t = 0; t < normalized.length; t++) {
    result[t] = {
      time: normalized[t].time,
      value: {
        regime: states[t],
        label: labels[states[t]],
        probabilities: [...alpha[t]],
        logLikelihood: model.logLikelihood,
      },
    };
  }

  return tagSeries(result, HMM_REGIME_META);
}

/**
 * Fit an HMM model to candle data without decoding states.
 *
 * Useful for model analysis (transition matrix inspection, parameter export).
 *
 * @param candles - Raw or normalized candle data
 * @param options - Model fitting options
 * @returns Fitted HMM model
 *
 * @example
 * ```ts
 * import { fitHmm, regimeTransitionMatrix } from "trendcraft";
 *
 * const model = fitHmm(candles, { numStates: 3 });
 * const info = regimeTransitionMatrix(model);
 * console.log(info.expectedDurations);
 * ```
 */
export function fitHmm(candles: Candle[], options?: HmmRegimeOptions): HmmModel {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const features = extractFeatures(normalized, options?.featureOptions);
  return baumWelch(features, toBaumWelchOptions(options));
}

/**
 * Extract transition information from a fitted HMM model.
 *
 * @param model - Fitted HMM model
 * @param labels - Optional state labels (auto-assigned if omitted)
 * @returns Transition matrix analysis with expected durations and stationary distribution
 *
 * @example
 * ```ts
 * import { fitHmm, regimeTransitionMatrix } from "trendcraft";
 *
 * const model = fitHmm(candles, { numStates: 3 });
 * const info = regimeTransitionMatrix(model);
 * console.log(info.stationaryDistribution);
 * ```
 */
export function regimeTransitionMatrix(model: HmmModel, labels?: string[]): RegimeTransitionInfo {
  const N = model.numStates;
  const resolvedLabels = labels ?? assignLabels(model);

  const expectedDurations = new Array(N);
  for (let i = 0; i < N; i++) {
    const selfProb = model.transitionMatrix[i][i];
    expectedDurations[i] = selfProb < 1 ? 1 / (1 - selfProb) : Number.POSITIVE_INFINITY;
  }

  const stationaryDistribution = computeStationaryDistribution(model.transitionMatrix);

  return {
    matrix: model.transitionMatrix.map((row) => [...row]),
    labels: [...resolvedLabels],
    expectedDurations,
    stationaryDistribution,
  };
}
