/**
 * TrendCraft - Financial Data Analysis Library
 *
 * @packageDocumentation
 */

// Types
export type {
  // Candle types
  Candle,
  NormalizedCandle,
  // Indicator types
  IndicatorValue,
  Series,
  PriceSource,
  // Timeframe types
  Timeframe,
  TimeframeUnit,
  TimeframeShorthand,
  // Indicator result types
  MacdValue,
  BollingerBandsValue,
  // Signal types
  SignalType,
  Signal,
  // Option types
  SmaOptions,
  EmaOptions,
  RsiOptions,
  MacdOptions,
  BollingerBandsOptions,
  AtrOptions,
  HighestLowestOptions,
  ReturnsOptions,
  CrossOptions,
  // Backtest types
  Condition,
  ConditionFn,
  PresetCondition,
  CombinedCondition,
  Trade,
  ExitReason,
  BacktestOptions,
  BacktestResult,
  BacktestSettings,
  PartialTakeProfitConfig,
  AtrTrailingStopConfig,
  FillMode,
  SlTpMode,
  // MTF types
  MtfContext,
  MtfDataset,
  MtfConditionFn,
  MtfPresetCondition,
  // Volume analysis types
  VolumeAnomalyValue,
  VolumeProfileValue,
  VolumePriceLevel,
  VolumeTrendValue,
  // ATR risk management types
  AtrRiskOptions,
  ChandelierExitOptions,
  ChandelierExitValue,
  AtrStopsOptions,
  AtrStopsValue,
  // Volatility regime types
  VolatilityRegime,
  VolatilityRegimeOptions,
  VolatilityRegimeValue,
  // Scaled entry types
  ScaledEntryStrategy,
  ScaledEntryIntervalType,
  ScaledEntryConfig,
  // Fundamental metrics types
  FundamentalMetrics,
} from "./types";

// Core utilities
export {
  normalizeTime,
  normalizeCandle,
  normalizeCandles,
  getPrice,
  getPriceSeries,
} from "./core/normalize";

export { resample, parseTimeframe } from "./core/resample";

// Fundamentals utilities
export {
  parseFundamentals,
  createFundamentalsMap,
  getFundamentalsAt,
} from "./core/fundamentals";
export type { ParseFundamentalsOptions } from "./core/fundamentals";

// MTF context utilities
export {
  createMtfContext,
  buildMtfIndexMap,
  updateMtfIndices,
  getMtfCandle,
  getMtfIndicator,
  setMtfIndicator,
  getCurrentMtfIndicatorValue,
  hasMtfTimeframe,
  getMtfTimeframes,
} from "./core/mtf-context";

// Indicators
export {
  // Moving Averages
  sma,
  ema,
  wma,
  // Momentum
  rsi,
  macd,
  stochastics,
  fastStochastics,
  slowStochastics,
  dmi,
  stochRsi,
  cci,
  williamsR,
  roc,
  // Volatility
  bollingerBands,
  atr,
  donchianChannel,
  keltnerChannel,
  chandelierExit,
  atrStops,
  calculateAtrStop,
  calculateAtrTakeProfit,
  calculateAtrTrailingStop,
  // Volume
  volumeMa,
  obv,
  mfi,
  vwap,
  cmf,
  volumeAnomaly,
  volumeProfile,
  volumeProfileSeries,
  volumeTrend,
  // Price
  highestLowest,
  highest,
  lowest,
  returns,
  cumulativeReturns,
  pivotPoints,
  swingPoints,
  getSwingHighs,
  getSwingLows,
  // Trend
  ichimoku,
  supertrend,
  parabolicSar,
  // ATR Filter (stock screening)
  calculateAtrPercent,
  atrPercentSeries,
  passesAtrFilter,
  filterStocksByAtr,
  DEFAULT_ATR_THRESHOLD,
  // Relative Strength
  benchmarkRS,
  calculateRSRating,
  isOutperforming,
  rankByRS,
  topByRS,
  bottomByRS,
  filterByRSPercentile,
  compareRS,
  // SMC (Smart Money Concepts)
  orderBlock,
  getActiveOrderBlocks,
  getNearestOrderBlock,
  liquiditySweep,
  getRecoveredSweeps,
  hasRecentSweepSignal,
  // BOS/CHoCH/FVG (SMC price structure)
  breakOfStructure,
  changeOfCharacter,
  fairValueGap,
  getUnfilledFvgs,
  getNearestFvg,
} from "./indicators";

export type {
  VolumeMaOptions,
  HighestLowestValue,
  StochasticsValue,
  StochasticsOptions,
  DmiValue,
  DmiOptions,
  StochRsiValue,
  StochRsiOptions,
  DonchianValue,
  DonchianOptions,
  KeltnerChannelOptions,
  KeltnerChannelValue,
  MfiOptions,
  CmfOptions,
  WmaOptions,
  VwapOptions,
  VwapValue,
  CciOptions,
  WilliamsROptions,
  RocOptions,
  PivotPointsOptions,
  PivotPointsValue,
  SwingPointValue,
  SwingPointOptions,
  IchimokuOptions,
  IchimokuValue,
  SupertrendOptions,
  SupertrendValue,
  ParabolicSarOptions,
  ParabolicSarValue,
  AtrFilterOptions,
  AtrFilterResult,
  RSValue,
  BenchmarkRSOptions,
  SymbolRSRank,
  MultiRSOptions,
  // SMC types
  OrderBlock,
  OrderBlockValue,
  OrderBlockOptions,
  LiquiditySweep,
  LiquiditySweepValue,
  LiquiditySweepOptions,
  // BOS/CHoCH/FVG types
  BosValue,
  BosOptions,
  FvgValue,
  FvgGap,
  FvgOptions,
} from "./indicators";

// Fluent API
export { TrendCraft, StrategyBuilder, MtfStrategyBuilder, TrendCraftMtf } from "./core/trendcraft";
export type { AnalysisResult } from "./core/trendcraft";

// Backtest conditions
export {
  // Combinators
  and,
  or,
  not,
  // Preset conditions
  goldenCross as goldenCrossCondition,
  deadCross as deadCrossCondition,
  rsiBelow,
  rsiAbove,
  macdCrossUp,
  macdCrossDown,
  bollingerBreakout,
  bollingerTouch,
  priceAboveSma,
  priceBelowSma,
  priceDroppedAtr,
  // Validated conditions (with damashi detection)
  validatedGoldenCross,
  validatedDeadCross,
  // Perfect Order conditions
  perfectOrderBullish,
  perfectOrderBearish,
  perfectOrderCollapsed,
  perfectOrderActiveBullish,
  perfectOrderActiveBearish,
  // Enhanced Perfect Order conditions
  perfectOrderBullishConfirmed,
  perfectOrderBearishConfirmed,
  perfectOrderConfirmationFormed,
  perfectOrderBreakdown,
  perfectOrderMaCollapsed,
  perfectOrderPreBullish,
  perfectOrderPreBearish,
  // PO+ and PB entry conditions
  poPlusEntry,
  pbEntry,
  poPlusPbEntry,
  // Stochastics conditions
  stochBelow,
  stochAbove,
  stochCrossUp,
  stochCrossDown,
  // DMI/ADX conditions
  dmiBullish,
  dmiBearish,
  adxStrong,
  // Volume conditions
  volumeAboveAvg,
  // Fundamental conditions
  perBelow,
  perAbove,
  perBetween,
  pbrBelow,
  pbrAbove,
  pbrBetween,
  // Engine
  runBacktest,
  runBacktestScaled,
} from "./backtest";

export type {
  ValidatedCrossOptions,
  PerfectOrderConditionOptions,
  PerfectOrderEnhancedConditionOptions,
  ScaledBacktestOptions,
} from "./backtest";

// Signals
export {
  crossOver,
  crossUnder,
  goldenCross,
  deadCross,
  validateCrossSignals,
  obvDivergence,
  rsiDivergence,
  macdDivergence,
  detectDivergence,
  bollingerSqueeze,
  perfectOrder,
  perfectOrderEnhanced,
  rangeBound,
  volumeBreakout,
  volumeAccumulation,
  volumeMaCross,
  volumeAboveAverage,
  // Price Patterns
  doubleTop,
  doubleBottom,
  headAndShoulders,
  inverseHeadAndShoulders,
  cupWithHandle,
} from "./signals";
export type {
  CrossValidationOptions,
  CrossSignalQuality,
  DivergenceSignal,
  DivergenceOptions,
  SqueezeSignal,
  SqueezeOptions,
  PerfectOrderType,
  PerfectOrderValue,
  PerfectOrderOptions,
  SlopeDirection,
  PerfectOrderState,
  PerfectOrderValueEnhanced,
  PerfectOrderOptionsEnhanced,
  TrendReason,
  RangeBoundState,
  RangeBoundValue,
  RangeBoundOptions,
  VolumeBreakoutSignal,
  VolumeBreakoutOptions,
  VolumeAccumulationSignal,
  VolumeAccumulationOptions,
  VolumeMaCrossSignal,
  VolumeMaCrossOptions,
  VolumeAboveAverageSignal,
  VolumeAboveAverageOptions,
  // Pattern types
  PatternType,
  PatternKeyPoint,
  PatternNeckline,
  PatternSignal,
  DoublePatternOptions,
  HeadShouldersOptions,
  CupHandleOptions,
} from "./signals";

// Range-Bound backtest conditions
export {
  inRangeBound,
  rangeForming,
  rangeConfirmed,
  breakoutRiskUp,
  breakoutRiskDown,
  rangeBreakout,
  tightRange,
  rangeScoreAbove,
} from "./backtest";

export type { RangeBoundConditionOptions } from "./backtest";

// Advanced Volume conditions
export {
  volumeAnomalyCondition,
  volumeExtreme,
  volumeRatioAbove,
  nearPoc,
  inValueArea,
  breakoutVah,
  breakdownVal,
  priceAbovePoc,
  priceBelowPoc,
  volumeConfirmsTrend,
  volumeDivergence,
  bullishVolumeDivergence,
  bearishVolumeDivergence,
  volumeTrendConfidence,
  // CMF conditions
  cmfAbove,
  cmfBelow,
  // OBV conditions
  obvRising,
  obvFalling,
  obvCrossUp,
  obvCrossDown,
} from "./backtest";

// Multi-Timeframe (MTF) conditions
export {
  weeklyRsiAbove,
  weeklyRsiBelow,
  monthlyRsiAbove,
  monthlyRsiBelow,
  mtfRsiAbove,
  mtfRsiBelow,
  weeklyPriceAboveSma,
  weeklyPriceBelowSma,
  monthlyPriceAboveSma,
  monthlyPriceBelowSma,
  mtfPriceAboveSma,
  mtfPriceBelowSma,
  weeklyPriceAboveEma,
  mtfPriceAboveEma,
  weeklyTrendStrong,
  monthlyTrendStrong,
  mtfTrendStrong,
  weeklyUptrend,
  weeklyDowntrend,
  mtfUptrend,
  mtfDowntrend,
  mtfCondition,
} from "./backtest";

// Volatility Regime conditions
export {
  regimeIs,
  regimeNot,
  volatilityAbove,
  volatilityBelow,
  atrPercentileAbove,
  atrPercentileBelow,
  regimeConfidenceAbove,
  volatilityExpanding,
  volatilityContracting,
  // ATR% Filter conditions
  atrPercentAbove,
  atrPercentBelow,
} from "./backtest";

// Relative Strength (RS) conditions
export {
  rsAbove,
  rsBelow,
  rsRising,
  rsFalling,
  rsNewHigh,
  rsNewLow,
  rsRatingAbove,
  rsRatingBelow,
  mansfieldRSAbove,
  mansfieldRSBelow,
  outperformanceAbove,
  outperformanceBelow,
  setBenchmark,
  BENCHMARK_CACHE_KEY,
} from "./backtest";

export type { RSConditionOptions } from "./backtest";

// Price Pattern conditions
export {
  patternDetected,
  patternConfirmed,
  anyBullishPattern,
  anyBearishPattern,
  patternConfidenceAbove,
  anyPatternConfidenceAbove,
  patternWithinBars,
  doubleTopDetected,
  doubleBottomDetected,
  headShouldersDetected,
  inverseHeadShouldersDetected,
  cupHandleDetected,
} from "./backtest";

export type { PatternConditionOptions } from "./backtest";

// Volatility Regime indicator
export { volatilityRegime } from "./indicators";

// Position Sizing
export {
  // Risk-based sizing
  riskBasedSize,
  calculateStopDistance,
  riskPerShare,
  // ATR-based sizing
  atrBasedSize,
  calculateAtrStopDistance,
  recommendedAtrMultiplier,
  // Kelly criterion
  kellySize,
  calculateKellyPercent,
  // Fixed fractional
  fixedFractionalSize,
  maxPositions,
  fractionForPositionCount,
} from "./position-sizing";

export type {
  PositionSizeResult,
  PositionSizingMethod,
  PositionSizingBaseOptions,
  RiskBasedSizingOptions,
  AtrBasedSizingOptions,
  KellySizingOptions,
  FixedFractionalOptions,
  PositionSizingOptions,
  // Scoring types
  SignalEvaluator,
  SignalDefinition,
  ScoreResult,
  SignalContribution,
  ScoreBreakdown,
  ScoringConfig,
  ScoringPreset,
} from "./types";

// Signal Scoring
export {
  // Calculator
  calculateScore,
  calculateScoreBreakdown,
  calculateScoreSeries,
  isScoreAbove,
  isScoreBelow,
  // Builder
  ScoreBuilder,
  // Presets
  getPreset,
  listPresets,
  createMomentumPreset,
  createMeanReversionPreset,
  createTrendFollowingPreset,
  createBalancedPreset,
  createAggressivePreset,
  createConservativePreset,
  // Backtest conditions
  scoreAbove,
  scoreBelow,
  scoreStrength,
  minActiveSignals,
  scoreWithMinSignals,
  scoreIncreasing,
  // Signal evaluators
  createRsiOversoldEvaluator,
  createRsiOverboughtEvaluator,
  createMacdBullishEvaluator,
  createMacdBearishEvaluator,
  createPerfectOrderBullishEvaluator,
  createPOConfirmationEvaluator,
  createPullbackEntryEvaluator,
  createVolumeSpikeEvaluator,
  createVolumeAnomalyEvaluator,
  // Pre-built signals
  rsiOversold30,
  rsiOverbought70,
  macdBullish,
  macdBearish,
  perfectOrderBullish as poBullishSignal,
  perfectOrderBearish as poBearishSignal,
  poConfirmation,
  volumeSpike,
  volumeAnomaly2z,
} from "./scoring";

// Optimization
export {
  // Metrics
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateRecoveryFactor,
  annualizeReturn,
  calculateAllMetrics,
  // Grid Search
  gridSearch,
  generateParameterCombinations,
  countCombinations,
  param,
  constraint,
  getTopResults,
  summarizeGridSearch,
  // Walk-Forward Analysis
  walkForwardAnalysis,
  calculatePeriodCount,
  generatePeriodBoundaries,
  summarizeWalkForward,
  getOutOfSampleEquityCurve,
  // Combination Search
  combinationSearch,
  generateCombinations,
  countTotalCombinations,
  getTopCombinations,
  formatCombinationResult,
  summarizeCombinationSearch,
  createEntryConditionPool,
  createExitConditionPool,
  // Monte Carlo Simulation
  runMonteCarloSimulation,
  calculateStatistics,
  formatMonteCarloResult,
  summarizeMonteCarloResult,
  // Anchored Walk-Forward Analysis
  anchoredWalkForwardAnalysis,
  generateAWFBoundaries,
  calculateAWFPeriodCount,
  summarizeAWFResult,
  formatAWFResult,
  getAWFEquityCurve,
} from "./optimization";

export type {
  // Optimization types
  ParameterRange,
  OptimizationMetric,
  OptimizationConstraint,
  OptimizationResultEntry,
  GridSearchResult,
  GridSearchOptions,
  WalkForwardPeriod,
  WalkForwardResult,
  WalkForwardOptions,
  StrategyFactory,
  // Combination Search types
  ConditionDefinition,
  CombinationResultEntry,
  CombinationSearchResult,
  CombinationSearchOptions,
  // Monte Carlo types
  MonteCarloOptions,
  MonteCarloResult,
  MetricStatistics,
  // Anchored Walk-Forward types
  AnchoredWalkForwardOptions,
  AWFPeriod,
  AWFResult,
} from "./optimization";

// Screening (browser-compatible exports only - no fs dependency)
export {
  screenStock,
  createCriteriaFromNames,
  getAvailableConditions,
  CONDITION_PRESETS,
} from "./screening/screen-stock";

export { parseCsv } from "./screening/csv-parser";

export { formatTable, formatJson, formatCsv } from "./screening/formatters";
// Note: runScreening, loadCsvFile, getCsvFiles, loadCsvDirectory are Node.js-only
// Import from "trendcraft/screening" or "../src/screening" for CLI usage

export type {
  ScreeningCriteria,
  ScreeningResult,
  ScreeningOptions,
  ScreeningSessionResult,
  OutputFormat,
  CsvLoadResult,
  CsvLoadError,
} from "./screening";

// Trade Analysis
export {
  calculateTradeStats,
  analyzeByExitReason,
  analyzeByHoldingPeriod,
  analyzeByTime,
  analyzeMfeMae,
  analyzeStreaks,
  analyzeAllTrades,
} from "./analysis";

export type {
  TradeStats,
  ExitReasonAnalysis,
  HoldingPeriodAnalysis,
  TimeAnalysis,
  MfeMaeAnalysis,
  StreakAnalysis,
  TradeAnalysis,
} from "./analysis";
