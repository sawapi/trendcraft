/**
 * Signal Evaluators Index
 *
 * Re-exports all signal evaluators and pre-built signal definitions.
 */

// Momentum signals
export {
  createMacdBearishEvaluator,
  createMacdBullishEvaluator,
  createRsiNeutralEvaluator,
  createRsiOverboughtEvaluator,
  createRsiOversoldEvaluator,
  createStochBullishCrossEvaluator,
  createStochOverboughtEvaluator,
  createStochOversoldEvaluator,
  macdBearish,
  macdBullish,
  rsiOverbought70,
  // Pre-built
  rsiOversold30,
  stochOverbought,
  stochOversold,
} from "./momentum";

// Trend signals
export {
  createDeathCrossEvaluator,
  createGoldenCrossEvaluator,
  createPerfectOrderBearishEvaluator,
  createPerfectOrderBullishEvaluator,
  createPOConfirmationEvaluator,
  createPriceAboveEmaEvaluator,
  createPriceBelowEmaEvaluator,
  createPullbackEntryEvaluator,
  goldenCross50200,
  perfectOrderBearish,
  // Pre-built
  perfectOrderBullish,
  poConfirmation,
  priceAboveEma20,
  pullbackEntry20,
} from "./trend";

// Volume signals
export {
  bullishVolumeTrend,
  cmfPositive,
  createBearishVolumeTrendEvaluator,
  createBullishVolumeTrendEvaluator,
  createCmfNegativeEvaluator,
  createCmfPositiveEvaluator,
  createHighVolumeUpCandleEvaluator,
  createVolumeAnomalyEvaluator,
  createVolumeSpikeEvaluator,
  highVolumeUpCandle,
  volumeAnomaly2z,
  // Pre-built
  volumeSpike,
} from "./volume";
