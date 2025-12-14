/**
 * Core type definitions for TrendCraft
 */

// ============================================
// Candle Types
// ============================================

/**
 * Raw candle data input format
 * Accepts both epoch milliseconds and ISO string for time
 */
export type Candle = {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Normalized candle with time always as epoch milliseconds
 */
export type NormalizedCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ============================================
// Indicator Types
// ============================================

/**
 * Single indicator data point with timestamp
 */
export type IndicatorValue<T> = {
  time: number;
  value: T;
};

/**
 * Time series of indicator values
 */
export type Series<T> = IndicatorValue<T>[];

/**
 * Price source for indicator calculations
 */
export type PriceSource = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "volume";

// ============================================
// Timeframe Types
// ============================================

/**
 * Supported timeframe units for resampling
 */
export type TimeframeUnit = "minute" | "hour" | "day" | "week" | "month";

/**
 * Timeframe specification
 * Examples: { value: 1, unit: 'day' }, { value: 4, unit: 'hour' }
 */
export type Timeframe = {
  value: number;
  unit: TimeframeUnit;
};

/**
 * Shorthand timeframe strings
 */
export type TimeframeShorthand =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "1w"
  | "1M"
  | "daily"
  | "weekly"
  | "monthly";

// ============================================
// Indicator Result Types
// ============================================

/**
 * MACD indicator result
 */
export type MacdValue = {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

/**
 * Bollinger Bands indicator result
 */
export type BollingerBandsValue = {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  percentB: number | null;
  bandwidth: number | null;
};

// ============================================
// Signal Types
// ============================================

/**
 * Signal type for trading decisions
 */
export type SignalType = "buy" | "sell" | "hold";

/**
 * Signal output from condition evaluation
 */
export type Signal = {
  time: number;
  type: SignalType;
  name: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

// ============================================
// Utility Types
// ============================================

/**
 * Options for SMA calculation
 */
export type SmaOptions = {
  period: number;
  source?: PriceSource;
};

/**
 * Options for EMA calculation
 */
export type EmaOptions = {
  period: number;
  source?: PriceSource;
};

/**
 * Options for RSI calculation (Wilder's method)
 */
export type RsiOptions = {
  period?: number;
};

/**
 * Options for MACD calculation
 */
export type MacdOptions = {
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
};

/**
 * Options for Bollinger Bands calculation
 */
export type BollingerBandsOptions = {
  period?: number;
  stdDev?: number;
  source?: PriceSource;
};

/**
 * Options for ATR calculation (Wilder's method)
 */
export type AtrOptions = {
  period?: number;
};

/**
 * Options for Highest/Lowest calculation
 */
export type HighestLowestOptions = {
  period: number;
  source?: "high" | "low" | "close";
};

/**
 * Options for Returns calculation
 */
export type ReturnsOptions = {
  period?: number;
  type?: "simple" | "log";
};

/**
 * Options for Golden Cross / Dead Cross detection
 */
export type CrossOptions = {
  /** Short-term period (default: 5) */
  short?: number;
  /** Long-term period (default: 25, Japanese stock standard) */
  long?: number;
};
