/**
 * Signal Evaluators Index
 *
 * Re-exports all signal evaluators and pre-built signal definitions.
 */

// Momentum signals
export {
  createRsiOversoldEvaluator,
  createRsiOverboughtEvaluator,
  createRsiNeutralEvaluator,
  createMacdBullishEvaluator,
  createMacdBearishEvaluator,
  createStochOversoldEvaluator,
  createStochOverboughtEvaluator,
  createStochBullishCrossEvaluator,
  // Pre-built
  rsiOversold30,
  rsiOverbought70,
  macdBullish,
  macdBearish,
  stochOversold,
  stochOverbought,
} from "./momentum";

// Trend signals
export {
  createPerfectOrderBullishEvaluator,
  createPerfectOrderBearishEvaluator,
  createPOConfirmationEvaluator,
  createPullbackEntryEvaluator,
  createGoldenCrossEvaluator,
  createDeathCrossEvaluator,
  createPriceAboveEmaEvaluator,
  createPriceBelowEmaEvaluator,
  // Pre-built
  perfectOrderBullish,
  perfectOrderBearish,
  poConfirmation,
  pullbackEntry20,
  goldenCross50200,
  priceAboveEma20,
} from "./trend";

// Volume signals
export {
  createVolumeSpikeEvaluator,
  createVolumeAnomalyEvaluator,
  createBullishVolumeTrendEvaluator,
  createBearishVolumeTrendEvaluator,
  createCmfPositiveEvaluator,
  createCmfNegativeEvaluator,
  createHighVolumeUpCandleEvaluator,
  // Pre-built
  volumeSpike,
  volumeAnomaly2z,
  bullishVolumeTrend,
  cmfPositive,
  highVolumeUpCandle,
} from "./volume";
