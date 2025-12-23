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
} from "./types";

// Core utilities
export { normalizeTime, normalizeCandle, normalizeCandles, getPrice, getPriceSeries } from "./core/normalize";

export { resample, parseTimeframe } from "./core/resample";

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
  // Volume
  volumeMa,
  obv,
  mfi,
  vwap,
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
  MfiOptions,
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
} from "./indicators";

// Fluent API
export { TrendCraft, StrategyBuilder } from "./core/trendcraft";
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

export type { ValidatedCrossOptions, PerfectOrderConditionOptions, PerfectOrderEnhancedConditionOptions } from "./backtest";

// Signals
export { crossOver, crossUnder, goldenCross, deadCross, validateCrossSignals, obvDivergence, rsiDivergence, macdDivergence, detectDivergence, bollingerSqueeze, perfectOrder, perfectOrderEnhanced, rangeBound } from "./signals";
export type { CrossValidationOptions, CrossSignalQuality, DivergenceSignal, DivergenceOptions, SqueezeSignal, SqueezeOptions, PerfectOrderType, PerfectOrderValue, PerfectOrderOptions, SlopeDirection, PerfectOrderState, PerfectOrderValueEnhanced, PerfectOrderOptionsEnhanced, TrendReason, RangeBoundState, RangeBoundValue, RangeBoundOptions } from "./signals";

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
