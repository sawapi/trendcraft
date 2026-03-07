/**
 * Core type definitions for TrendCraft
 *
 * Re-exports all types from submodules for backward compatibility.
 * Import from "trendcraft" or from specific submodules:
 *   - ./candle       Candle, Indicator, Timeframe, Signal, Utility Option types
 *   - ./backtest     Backtest, MTF types
 *   - ./volume-risk  Volume Analysis, ATR Risk, Position Sizing types
 *   - ./scoring      Signal Scoring, Volatility Regime, Scaled Entry, Fundamental types
 *   - ./optimization Optimization types
 *   - ./result       Result/Error types
 */

// ============================================
// Candle, Indicator, Timeframe, Signal, Utility Option Types
// ============================================

export type {
  Candle,
  NormalizedCandle,
  IndicatorValue,
  Series,
  PriceSource,
  TimeframeUnit,
  Timeframe,
  TimeframeShorthand,
  MacdValue,
  BollingerBandsValue,
  SignalType,
  Signal,
  SmaOptions,
  EmaOptions,
  RsiOptions,
  MacdOptions,
  BollingerBandsOptions,
  AtrOptions,
  HighestLowestOptions,
  ReturnsOptions,
  CrossOptions,
} from "./candle";

// ============================================
// Backtest & MTF Types
// ============================================

export type {
  PositionDirection,
  ExitReason,
  ConditionFn,
  PresetCondition,
  CombinedCondition,
  Condition,
  Trade,
  PartialTakeProfitConfig,
  BreakevenStopConfig,
  ScaleOutLevel,
  ScaleOutConfig,
  TimeExitConfig,
  AtrTrailingStopConfig,
  FillMode,
  SlTpMode,
  BacktestOptions,
  BacktestSettings,
  BacktestResult,
  MtfDataset,
  MtfContext,
  MtfConditionFn,
  MtfPresetCondition,
} from "./backtest";

// ============================================
// Volume Analysis, ATR Risk, Position Sizing Types
// ============================================

export type {
  VolumeAnomalyValue,
  VolumePriceLevel,
  VolumeProfileValue,
  VolumeTrendValue,
  AtrRiskOptions,
  ChandelierExitOptions,
  ChandelierExitValue,
  AtrStopsOptions,
  AtrStopsValue,
  PositionSizeResult,
  PositionSizingMethod,
  PositionSizingBaseOptions,
  RiskBasedSizingOptions,
  AtrBasedSizingOptions,
  KellySizingOptions,
  FixedFractionalOptions,
  PositionSizingOptions,
} from "./volume-risk";

// ============================================
// Signal Scoring, Volatility Regime, Scaled Entry, Fundamental Types
// ============================================

export type {
  PrecomputedIndicators,
  SignalEvaluator,
  SignalDefinition,
  ScoreResult,
  SignalContribution,
  ScoreBreakdown,
  ScoringConfig,
  ScoringPreset,
  VolatilityRegime,
  VolatilityRegimeOptions,
  VolatilityRegimeValue,
  ScaledEntryStrategy,
  ScaledEntryIntervalType,
  ScaledEntryConfig,
  FundamentalMetrics,
} from "./scoring";

// ============================================
// Optimization Types (re-export from optimization.ts)
// ============================================

export type {
  ParameterRange,
  OptimizationMetric,
  OptimizationConstraint,
  OptimizationResultEntry,
  GridSearchResult,
  GridSearchOptions,
  WalkForwardPeriod,
  WalkForwardResult,
  WalkForwardOptions,
} from "./optimization";

// ============================================
// Result Types (re-export from result.ts)
// ============================================

export type { Ok, Err, Result, TrendCraftErrorCode, TrendCraftError } from "./result";
export {
  ok,
  err,
  tcError,
  mapResult,
  flatMap,
  unwrapOr,
  unwrap,
  collectResults,
  partitionResults,
  tryCatch,
} from "./result";

// ============================================
// Trade Signal Types
// ============================================

export type {
  TradeAction,
  TradeDirection,
  SignalReason,
  PriceLevels,
  TradeSignal,
} from "./trade-signal";

// ============================================
// Plugin Types
// ============================================

export type { IndicatorPlugin } from "./plugin";
export { defineIndicator } from "./plugin";

// ============================================
// Validation Types
// ============================================

export type {
  ValidationResult,
  ValidationFinding,
  ValidationOptions,
  ValidationSeverity,
  GapDetectionOptions,
  SpikeDetectionOptions,
  VolumeAnomalyOptions,
  StaleDetectionOptions,
} from "../validation/types";
