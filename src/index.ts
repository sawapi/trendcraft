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
  // Trade Signal types
  TradeAction,
  TradeDirection,
  SignalReason,
  PriceLevels,
  TradeSignal,
  // Backtest types
  PositionDirection,
  Condition,
  DrawdownPeriod,
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

export { resample, parseTimeframe, getPeriodStart } from "./core/resample";

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
  vwma,
  kama,
  t3,
  hma,
  mcginleyDynamic,
  emaRibbon,
  dema,
  tema,
  zlema,
  frama,
  alma,
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
  trix,
  aroon,
  dpo,
  hurst,
  connorsRsi,
  imi,
  adxr,
  ultimateOscillator,
  awesomeOscillator,
  massIndex,
  kst,
  coppockCurve,
  tsi,
  ppo,
  cmo,
  balanceOfPower,
  qstick,
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
  choppinessIndex,
  ulcerIndex,
  historicalVolatility,
  garmanKlass,
  standardDeviation,
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
  adl,
  anchoredVwap,
  elderForceIndex,
  easeOfMovement,
  klinger,
  twap,
  weisWave,
  marketProfile,
  pvt,
  nvi,
  cvd,
  cvdWithSignal,
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
  // Price transforms
  medianPrice,
  typicalPrice,
  weightedClose,
  // S/R Zone Clustering
  srZones,
  srZonesSeries,
  // Trend
  ichimoku,
  supertrend,
  parabolicSar,
  vortex,
  schaffTrendCycle,
  linearRegression,
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
  // Fibonacci Retracement
  fibonacciRetracement,
  // Auto Trend Line / Channel / Fibonacci Extension / Pitchfork
  autoTrendLine,
  channelLine,
  fibonacciExtension,
  andrewsPitchfork,
  getAlternatingSwingPoints,
  // Fractals / Zigzag
  fractals,
  zigzag,
  // Gap / Opening Range
  openingRange,
  gapAnalysis,
  // Heikin-Ashi
  heikinAshi,
  // Session / Kill Zones
  defineSession,
  getIctSessions,
  detectSessions,
  sessionStats,
  killZones,
  getIctKillZones,
  sessionBreakout,
  // Filter (Ehlers)
  superSmoother,
  roofingFilter,
  // Adaptive Indicators
  adaptiveRsi,
  adaptiveBollinger,
  adaptiveMa,
  adaptiveStochastics,
  // HMM Regime Detection
  hmmRegimes,
  fitHmm,
  regimeTransitionMatrix,
  // Wyckoff (VSA + Phase Detection)
  vsa,
  wyckoffPhases,
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
  VwmaOptions,
  KamaOptions,
  T3Options,
  HmaOptions,
  McGinleyDynamicOptions,
  EmaRibbonOptions,
  EmaRibbonValue,
  DemaOptions,
  TemaOptions,
  ZlemaOptions,
  FramaOptions,
  AlmaOptions,
  VwapOptions,
  VwapValue,
  VwapBand,
  CciOptions,
  WilliamsROptions,
  RocOptions,
  TrixOptions,
  TrixValue,
  AroonOptions,
  AroonValue,
  DpoOptions,
  HurstOptions,
  ConnorsRsiOptions,
  ConnorsRsiValue,
  ImiOptions,
  AdxrOptions,
  UltimateOscillatorOptions,
  AwesomeOscillatorOptions,
  MassIndexOptions,
  KstOptions,
  KstValue,
  CoppockCurveOptions,
  TsiOptions,
  TsiValue,
  PpoOptions,
  PpoValue,
  CmoOptions,
  BalanceOfPowerOptions,
  QstickOptions,
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
  VortexOptions,
  VortexValue,
  SchaffTrendCycleOptions,
  LinearRegressionOptions,
  LinearRegressionValue,
  AtrFilterOptions,
  AtrFilterResult,
  ChoppinessIndexOptions,
  UlcerIndexOptions,
  HistoricalVolatilityOptions,
  GarmanKlassOptions,
  StandardDeviationOptions,
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
  // Fibonacci Retracement types
  FibonacciRetracementOptions,
  FibonacciRetracementValue,
  // Auto Trend Line / Channel / Fibonacci Extension / Pitchfork types
  AutoTrendLineOptions,
  AutoTrendLineValue,
  ChannelLineOptions,
  ChannelLineValue,
  FibonacciExtensionOptions,
  FibonacciExtensionValue,
  AndrewsPitchforkOptions,
  AndrewsPitchforkValue,
  AlternatingSwingPoint,
  HeikinAshiValue,
  FractalValue,
  FractalOptions,
  ZigzagValue,
  ZigzagOptions,
  OpeningRangeOptions,
  OpeningRangeValue,
  GapAnalysisOptions,
  GapValue,
  PriceLevelSource,
  SrZone,
  SrZonesOptions,
  SrZonesResult,
  AnchoredVwapOptions,
  AnchoredVwapValue,
  ElderForceIndexOptions,
  EaseOfMovementOptions,
  KlingerOptions,
  KlingerValue,
  TwapOptions,
  WeisWaveOptions,
  WeisWaveValue,
  MarketProfileOptions,
  MarketProfileValue,
  NviOptions,
  CvdWithSignalOptions,
  CvdWithSignalValue,
  SuperSmootherOptions,
  RoofingFilterOptions,
  // Session / Kill Zone types
  SessionDefinition,
  SessionInfo,
  SessionStatsOptions,
  SessionStatsValue,
  KillZoneDefinition,
  KillZoneValue,
  SessionBreakoutOptions,
  SessionBreakoutValue,
  // Adaptive Indicator types
  AdaptiveRsiOptions,
  AdaptiveRsiValue,
  AdaptiveBollingerOptions,
  AdaptiveBollingerValue,
  AdaptiveMaOptions,
  AdaptiveMaValue,
  AdaptiveStochasticsOptions,
  AdaptiveStochasticsValue,
  // HMM Regime Detection types
  HmmModel,
  HmmOptions,
  HmmRegimeOptions,
  HmmRegimeValue,
  RegimeTransitionInfo,
  HmmFeatureOptions,
  // Wyckoff types
  VsaBarType,
  VsaValue,
  VsaOptions,
  WyckoffPhase,
  WyckoffEvent,
  WyckoffValue,
  WyckoffPhaseOptions,
} from "./indicators";

// Indicator Plugins (namespace)
export * as plugins from "./indicators/plugins";

// Plugin system
export type { IndicatorPlugin } from "./types";
export { defineIndicator } from "./types";

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
  // Portfolio / Multi-Asset Backtest
  batchBacktest,
  portfolioBacktest,
} from "./backtest";

export type {
  ValidatedCrossOptions,
  PerfectOrderConditionOptions,
  PerfectOrderEnhancedConditionOptions,
  ScaledBacktestOptions,
} from "./backtest";

// Portfolio types
export type {
  SymbolData,
  SymbolBacktestResult,
  EquityPoint,
  BatchBacktestOptions,
  PortfolioMetrics,
  BatchBacktestResult,
  AllocationStrategy,
  RebalanceConfig,
  PortfolioBacktestOptions,
  PortfolioBacktestResult,
} from "./types";

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
  cvdDivergence,
  detectDivergence,
  bollingerSqueeze,
  perfectOrder,
  perfectOrderEnhanced,
  rangeBound,
  volumeBreakout,
  volumeAccumulation,
  volumeMaCross,
  volumeAboveAverage,
  // Trade Signal Converters
  fromCrossSignal,
  fromDivergenceSignal,
  fromSqueezeSignal,
  fromPatternSignal,
  fromScoreResult,
  fromPipelineResult,
  // Candlestick Patterns
  candlestickPatterns,
  // Price Patterns
  doubleTop,
  doubleBottom,
  headAndShoulders,
  inverseHeadAndShoulders,
  cupWithHandle,
  detectTriangle,
  detectWedge,
  detectChannel,
  detectFlag,
  filterPatterns,
  fitTrendline,
  fitTrendlinePair,
  classifyTrendlinePair,
  // Signal Lifecycle
  createSignalManager,
  processSignalsBatch,
} from "./signals";
export type {
  // Signal Lifecycle types
  SignalState,
  ManagedSignal,
  CooldownConfig,
  DebounceConfig,
  ExpiryConfig,
  SignalKeyFn,
  SignalManagerOptions,
  SignalManagerState,
  SignalManager,
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
  // Candlestick Pattern types
  CandlestickPattern,
  CandlestickPatternName,
  CandlestickPatternOptions,
  CandlestickPatternValue,
  // Pattern types
  PatternType,
  PatternKeyPoint,
  PatternNeckline,
  PatternSignal,
  DoublePatternOptions,
  HeadShouldersOptions,
  CupHandleOptions,
  TriangleOptions,
  WedgeOptions,
  ChannelOptions,
  FlagOptions,
  PatternFilterOptions,
  TrendlineFit,
  TrendlinePairType,
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
  triangleDetected,
  wedgeDetected,
  channelDetected,
  flagDetected,
  bullFlagDetected,
  bearFlagDetected,
} from "./backtest";

export type { PatternConditionOptions } from "./backtest";

// Smart Money Concepts (SMC) conditions
export {
  priceAtBullishOrderBlock,
  priceAtBearishOrderBlock,
  priceAtOrderBlock,
  orderBlockCreated,
  orderBlockMitigated,
  hasActiveOrderBlocks,
  liquiditySweepDetected,
  liquiditySweepRecovered,
  hasRecentSweeps,
  sweepDepthAbove,
} from "./backtest";

export type { OrderBlockConditionOptions, LiquiditySweepConditionOptions } from "./backtest";

// Perfect Order Pullback conditions
export {
  perfectOrderPullbackEntry,
  perfectOrderPullbackSellEntry,
} from "./backtest";

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

// Result types
export type { Ok, Err, Result, TrendCraftErrorCode, TrendCraftError } from "./types";
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
  toResult,
} from "./types";

// Safe indicator versions (Result-returning)
export * as safe from "./indicators/safe";

// Incremental Indicator API
export * as incremental from "./indicators/incremental";

// Indicator Cache
export { IndicatorCache, createCachedIndicators } from "./core/indicator-cache";

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
  gridSearchSafe,
  generateParameterCombinations,
  countCombinations,
  param,
  constraint,
  getTopResults,
  summarizeGridSearch,
  // Walk-Forward Analysis
  walkForwardAnalysis,
  walkForwardAnalysisSafe,
  calculatePeriodCount,
  generatePeriodBoundaries,
  summarizeWalkForward,
  getOutOfSampleEquityCurve,
  // Combination Search
  combinationSearch,
  combinationSearchSafe,
  generateCombinations,
  countTotalCombinations,
  getTopCombinations,
  formatCombinationResult,
  summarizeCombinationSearch,
  createEntryConditionPool,
  createExitConditionPool,
  // Monte Carlo Simulation
  runMonteCarloSimulation,
  runMonteCarloSimulationSafe,
  calculateStatistics,
  formatMonteCarloResult,
  summarizeMonteCarloResult,
  // Anchored Walk-Forward Analysis
  anchoredWalkForwardAnalysis,
  anchoredWalkForwardAnalysisSafe,
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
  screenStockSafe,
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
  detectMarketRegime,
  calculateRuntimeMetrics,
  analyzeDrawdowns,
  projectPatternOutcome,
  projectFromSeries,
  projectFromPatterns,
} from "./analysis";

export type {
  TradeStats,
  ExitReasonAnalysis,
  HoldingPeriodAnalysis,
  TimeAnalysis,
  MfeMaeAnalysis,
  StreakAnalysis,
  TradeAnalysis,
  MarketRegimeResult,
  MarketRegimeOptions,
  RuntimeMetrics,
  RuntimeMetricsOptions,
  DrawdownSummary,
  PatternProjectionOptions,
  HitRate,
  PatternProjection,
  EventExtractor,
} from "./analysis";

// Validation
export {
  validateCandles,
  detectGaps,
  detectDuplicates,
  removeDuplicates,
  detectOhlcErrors,
  detectPriceSpikes,
  detectVolumeAnomalies,
  detectStaleData,
  detectSplitHints,
} from "./validation";
export type {
  ValidationResult,
  ValidationFinding,
  ValidationOptions,
  ValidationSeverity,
  GapDetectionOptions,
  SpikeDetectionOptions,
  VolumeAnomalyOptions,
  StaleDetectionOptions,
} from "./validation";
export { normalizeAndValidate } from "./core/normalize";

// Streaming (real-time trading pipeline)
export * as streaming from "./streaming";

// Unified Conditions (define once, use in backtest & streaming)
export {
  defineUnifiedCondition,
  unifiedAnd,
  unifiedOr,
  unifiedNot,
} from "./conditions";

export type {
  IndicatorAccessor,
  UnifiedConditionDef,
  UnifiedCondition,
} from "./conditions";

// Backtest Scoring
export { scoreBacktestResult } from "./backtest";
export type { BacktestScore, ScoreBreakdownEntry, ScoreWeights, ScoreOptions } from "./backtest";

// Strategy Definition
export * as strategy from "./strategy";
export type { StrategyDefinition, SessionOverrides } from "./strategy";
export { createSessionFromStrategy } from "./strategy";

// Execution utilities (resilient order execution)
export * as execution from "./execution";

// Series Utilities
export {
  zipSeries,
  mapSeries,
  filterSeries,
  alignSeries,
  normalizeToPercent,
  alignAndNormalize,
} from "./utils/series";

// Composable Indicator Algebra
export {
  pipe,
  compose,
  applyIndicator,
  through,
  seriesToCandles,
  extractField,
  mapValues,
  combineSeries,
} from "./compose";
export type { IndicatorFn, SeriesTransformFn, SeriesToCandlesOptions } from "./types";

// Signal Explainability
export {
  explainSignal,
  explainCondition,
  traceCondition,
  generateNarrative,
} from "./explainability";
export type { ConditionTrace, SignalExplanation, ExplainOptions } from "./types";

// Alpha Decay Monitor
export {
  analyzeAlphaDecay,
  createObservationsFromTrades,
  createObservationsFromScores,
  spearmanCorrelation,
} from "./alpha-decay";
export type {
  DecayObservation,
  RollingICPoint,
  HitRatePoint,
  CusumBreak,
  DecayAssessment,
  AlphaDecayResult,
  AlphaDecayOptions,
} from "./types";

// Pairs Trading / Cointegration
export {
  analyzePair,
  adfTest,
  calculateSpread,
  analyzeMeanReversion,
  olsRegression,
} from "./pairs";
export type {
  CointegrationResult,
  SpreadPoint,
  MeanReversionResult,
  PairsSignal,
  PairsAnalysisOptions,
  PairsAnalysisResult,
} from "./types";

// Cross-Asset Correlation
export {
  analyzeCorrelation,
  rollingCorrelation,
  pearsonCorrelation,
  spearmanRankCorrelation,
  detectCorrelationRegimes,
  analyzeLeadLag,
  detectIntermarketDivergence,
} from "./correlation";
export type {
  CorrelationPoint,
  CorrelationRegime,
  CorrelationRegimePoint,
  LeadLagResult,
  DivergencePoint,
  CorrelationAnalysisResult,
  CorrelationAnalysisOptions,
} from "./types";

// Strategy Robustness Score
export { quickRobustnessScore, calculateRobustnessScore, scoreToGrade } from "./robustness";
export type {
  DimensionScore,
  RobustnessGrade,
  RobustnessResult,
  RobustnessOptions,
  QuickRobustnessOptions,
  QuickRobustnessResult,
} from "./types";

// Risk Analytics (VaR / CVaR / Risk Parity)
export {
  calculateVaR,
  rollingVaR,
  riskParityAllocation,
  correlationAdjustedSize,
} from "./risk";
export type {
  VarMethod,
  VarOptions,
  VarResult,
  RollingVarOptions,
  RollingVarValue,
  RiskParityOptions,
  RiskParityResult,
  CorrelationAdjustedSizeOptions,
  CorrelationAdjustedSizeResult,
} from "./risk";

// Meta-Strategy (Equity Curve Trading, Strategy Rotation)
export {
  applyEquityCurveFilter,
  equityCurveHealth,
  rotateStrategies,
} from "./meta-strategy";
export type {
  EquityCurveFilterType,
  EquityCurveFilterOptions,
  EquityCurveAnalysis,
  EquityCurveHealthResult,
  StrategyPerformanceMetric,
  StrategyRotationOptions,
  StrategyAllocation,
  StrategyRotationResult,
} from "./meta-strategy";

// CandleFormer - ML-based candlestick prediction
export {
  trainCandleFormer,
  candleFormer,
  candleFormerBullish,
  candleFormerBearish,
  quantizeCandle,
  tokenizeCandles,
  tokenizePatterns,
  classifyShape,
  SHAPE_NAMES,
  PATTERN_NAMES,
  VOCAB_SIZE,
  PAD_TOKEN,
  NUM_CLASSES,
  NUM_SHAPES,
  NUM_VOLUME_BINS,
  NUM_PATTERNS,
  PATTERN_VOCAB_SIZE,
  PATTERN_NONE,
  DEFAULT_CONFIG as CANDLE_FORMER_DEFAULT_CONFIG,
} from "./ml";
export type {
  CandleToken,
  CandleFormerConfig,
  CandleFormerWeights,
  CandleFormerTrainOptions,
  CandleFormerTrainResult,
  CandleFormerOptions,
  CandleFormerValue,
  PredictionDirection,
} from "./ml";
