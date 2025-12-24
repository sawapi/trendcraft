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
  BacktestOptions,
  BacktestResult,
  PartialTakeProfitConfig,
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
  // Trend
  ichimoku,
  supertrend,
  parabolicSar,
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
  IchimokuOptions,
  IchimokuValue,
  SupertrendOptions,
  SupertrendValue,
  ParabolicSarOptions,
  ParabolicSarValue,
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
  // Engine
  runBacktest,
} from "./backtest";

export type {
  ValidatedCrossOptions,
  PerfectOrderConditionOptions,
  PerfectOrderEnhancedConditionOptions,
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
