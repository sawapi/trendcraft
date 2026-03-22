/**
 * Alpha Decay / Signal Degradation Monitor
 *
 * @packageDocumentation
 */

export {
  analyzeAlphaDecay,
  createObservationsFromTrades,
  createObservationsFromScores,
} from "./monitor";

export { spearmanCorrelation, linearRegression } from "./statistics";
