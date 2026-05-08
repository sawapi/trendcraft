/**
 * Alpha Decay / Signal Degradation Monitor
 *
 * @packageDocumentation
 */

export {
  analyzeAlphaDecay,
  createObservationsFromScores,
  createObservationsFromTrades,
} from "./monitor";

export { linearRegression, spearmanCorrelation } from "./statistics";
