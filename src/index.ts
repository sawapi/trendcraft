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
} from "./types";

// Core utilities
export { normalizeTime, normalizeCandle, normalizeCandles, getPrice, getPriceSeries } from "./core/normalize";

export { resample, parseTimeframe } from "./core/resample";

// Indicators
export {
  // Moving Averages
  sma,
  ema,
  // Momentum
  rsi,
  macd,
  // Volatility
  bollingerBands,
  atr,
  // Volume
  volumeMa,
  // Price
  highestLowest,
  highest,
  lowest,
  returns,
  cumulativeReturns,
} from "./indicators";

export type { VolumeMaOptions, HighestLowestValue } from "./indicators";

// Fluent API
export { TrendCraft } from "./core/trendcraft";
export type { AnalysisResult } from "./core/trendcraft";

// Signals
export { crossOver, crossUnder, goldenCross, deadCross, validateCrossSignals } from "./signals";
export type { CrossValidationOptions, CrossSignalQuality } from "./signals";
