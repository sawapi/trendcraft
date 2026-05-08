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
  AtrOptions,
  BollingerBandsOptions,
  BollingerBandsValue,
  Candle,
  CrossOptions,
  EmaOptions,
  HighestLowestOptions,
  IndicatorValue,
  MacdOptions,
  MacdValue,
  NormalizedCandle,
  PriceSource,
  ReturnsOptions,
  RsiOptions,
  Series,
  Signal,
  SignalType,
  SmaOptions,
  Timeframe,
  TimeframeShorthand,
  TimeframeUnit,
} from "./candle";

// ============================================
// Backtest & MTF Types
// ============================================

export type {
  AtrTrailingStopConfig,
  BacktestOptions,
  BacktestResult,
  BacktestSettings,
  BreakevenStopConfig,
  CombinedCondition,
  Condition,
  ConditionFn,
  DrawdownPeriod,
  ExitReason,
  FillMode,
  MtfConditionFn,
  MtfContext,
  MtfDataset,
  MtfPresetCondition,
  PartialTakeProfitConfig,
  PositionDirection,
  PresetCondition,
  ScaleOutConfig,
  ScaleOutLevel,
  SlTpMode,
  TimeExitConfig,
  Trade,
  VolumeConstraint,
} from "./backtest";

// ============================================
// Volume Analysis, ATR Risk, Position Sizing Types
// ============================================

export type {
  AtrBasedSizingOptions,
  AtrRiskOptions,
  AtrStopsOptions,
  AtrStopsValue,
  ChandelierExitOptions,
  ChandelierExitValue,
  FixedFractionalOptions,
  KellySizingOptions,
  PositionSizeResult,
  PositionSizingBaseOptions,
  PositionSizingMethod,
  PositionSizingOptions,
  RiskBasedSizingOptions,
  VolumeAnomalyValue,
  VolumePriceLevel,
  VolumeProfileValue,
  VolumeTrendValue,
} from "./volume-risk";

// ============================================
// Signal Scoring, Volatility Regime, Scaled Entry, Fundamental Types
// ============================================

export type {
  FundamentalMetrics,
  PrecomputedIndicators,
  ScaledEntryConfig,
  ScaledEntryIntervalType,
  ScaledEntryStrategy,
  ScoreBreakdown,
  ScoreResult,
  ScoringConfig,
  ScoringPreset,
  SignalContribution,
  SignalDefinition,
  SignalEvaluator,
  VolatilityRegime,
  VolatilityRegimeOptions,
  VolatilityRegimeValue,
} from "./scoring";

// ============================================
// Optimization Types (re-export from optimization.ts)
// ============================================

export type {
  GridSearchOptions,
  GridSearchResult,
  OptimizationConstraint,
  OptimizationMetric,
  OptimizationResultEntry,
  ParameterRange,
  WalkForwardOptions,
  WalkForwardPeriod,
  WalkForwardResult,
} from "./optimization";

// ============================================
// Result Types (re-export from result.ts)
// ============================================

export type { Err, Ok, Result, TrendCraftError, TrendCraftErrorCode } from "./result";
export {
  collectResults,
  err,
  flatMap,
  mapResult,
  ok,
  partitionResults,
  tcError,
  toResult,
  tryCatch,
  unwrap,
  unwrapOr,
} from "./result";

// ============================================
// Trade Signal Types
// ============================================

export type {
  PriceLevels,
  SignalReason,
  TradeAction,
  TradeDirection,
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
  GapDetectionOptions,
  SpikeDetectionOptions,
  StaleDetectionOptions,
  ValidationFinding,
  ValidationOptions,
  ValidationResult,
  ValidationSeverity,
  VolumeAnomalyOptions,
} from "../validation/types";

// ============================================
// Portfolio Types
// ============================================

export type {
  AllocationStrategy,
  BatchBacktestOptions,
  BatchBacktestResult,
  EquityPoint,
  PortfolioBacktestOptions,
  PortfolioBacktestResult,
  PortfolioMetrics,
  RebalanceConfig,
  SymbolBacktestResult,
  SymbolData,
} from "./portfolio";

// ============================================
// Robustness Types
// ============================================

export type {
  DimensionScore,
  QuickRobustnessOptions,
  QuickRobustnessResult,
  RobustnessGrade,
  RobustnessOptions,
  RobustnessResult,
} from "./robustness";

// ============================================
// Composable Indicator Algebra Types
// ============================================

export type { IndicatorFn, SeriesToCandlesOptions, SeriesTransformFn } from "./compose";

// ============================================
// Explainability Types
// ============================================

export type {
  ConditionTrace,
  ExplainOptions,
  SignalExplanation,
} from "./explainability";

// ============================================
// Alpha Decay Types
// ============================================

export type {
  AlphaDecayOptions,
  AlphaDecayResult,
  CusumBreak,
  DecayAssessment,
  DecayObservation,
  HitRatePoint,
  RollingICPoint,
} from "./alpha-decay";

// ============================================
// Pairs Trading / Cointegration Types
// ============================================

export type {
  CointegrationResult,
  MeanReversionResult,
  PairsAnalysisOptions,
  PairsAnalysisResult,
  PairsSignal,
  SpreadPoint,
} from "./pairs";

// ============================================
// Cross-Asset Correlation Types
// ============================================

export type {
  CorrelationAnalysisOptions,
  CorrelationAnalysisResult,
  CorrelationPoint,
  CorrelationRegime,
  CorrelationRegimePoint,
  DivergencePoint,
  LeadLagResult,
} from "./correlation";
