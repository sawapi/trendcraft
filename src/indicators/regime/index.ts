/**
 * Regime Detection indicators.
 *
 * @module
 */

// HMM core algorithms
export { gaussianLogPdf, forward, backward, baumWelch, viterbi } from "./hmm-core";
export type { HmmModel, HmmOptions } from "./hmm-core";

// Feature extraction
export { extractFeatures } from "./hmm-features";
export type { FeatureOptions } from "./hmm-features";

// User-facing regime API
export { hmmRegimes, fitHmm, regimeTransitionMatrix } from "./hmm-regimes";
export type {
  HmmRegimeOptions,
  HmmRegimeValue,
  RegimeTransitionInfo,
} from "./hmm-regimes";
