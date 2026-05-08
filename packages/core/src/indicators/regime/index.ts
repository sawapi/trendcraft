/**
 * Regime Detection indicators.
 *
 * @module
 */

export type { HmmModel, HmmOptions } from "./hmm-core";
// HMM core algorithms
export { backward, baumWelch, forward, gaussianLogPdf, viterbi } from "./hmm-core";
export type { FeatureOptions } from "./hmm-features";
// Feature extraction
export { extractFeatures } from "./hmm-features";
export type {
  HmmRegimeOptions,
  HmmRegimeValue,
  RegimeTransitionInfo,
} from "./hmm-regimes";
// User-facing regime API
export { fitHmm, hmmRegimes, regimeTransitionMatrix } from "./hmm-regimes";
