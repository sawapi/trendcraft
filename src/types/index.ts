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

// ============================================
// Backtest Types
// ============================================

/**
 * Condition function signature for custom entry/exit logic
 */
export type ConditionFn = (
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[]
) => boolean;

/**
 * Preset condition type
 */
export type PresetCondition = {
  type: "preset";
  name: string;
  evaluate: ConditionFn;
};

/**
 * Combined condition type (and/or/not)
 */
export type CombinedCondition = {
  type: "and" | "or" | "not";
  conditions: Condition[];
};

/**
 * Condition can be preset, combined, or custom function
 */
export type Condition = PresetCondition | CombinedCondition | ConditionFn;

/**
 * Single trade record
 */
export type Trade = {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  return: number;
  returnPercent: number;
  holdingDays: number;
};

/**
 * Backtest options
 */
export type BacktestOptions = {
  /** Initial capital */
  capital: number;
  /** Commission per trade in currency (default: 0) */
  commission?: number;
  /** Commission rate in percent per trade (default: 0, e.g., 0.1 = 0.1%) */
  commissionRate?: number;
  /** Slippage in percent (default: 0) */
  slippage?: number;
  /** Stop loss in percent (e.g., 5 = exit when -5% loss) */
  stopLoss?: number;
  /** Take profit in percent (e.g., 10 = exit when +10% gain) */
  takeProfit?: number;
  /** Trailing stop in percent (e.g., 5 = exit if price drops 5% from peak) */
  trailingStop?: number;
  /** Tax rate on profits in percent (default: 0, e.g., 20.315 for Japan) */
  taxRate?: number;
};

/**
 * Backtest result
 */
export type BacktestResult = {
  /** Total return amount */
  totalReturn: number;
  /** Total return percentage */
  totalReturnPercent: number;
  /** Number of trades */
  tradeCount: number;
  /** Win rate percentage */
  winRate: number;
  /** Maximum drawdown percentage */
  maxDrawdown: number;
  /** Sharpe ratio (annualized) */
  sharpeRatio: number;
  /** Profit factor */
  profitFactor: number;
  /** Average holding days */
  avgHoldingDays: number;
  /** Individual trade records */
  trades: Trade[];
};
