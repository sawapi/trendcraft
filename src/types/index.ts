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
  candles: NormalizedCandle[],
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
 * Condition can be preset, combined, MTF preset, or custom function
 */
export type Condition = PresetCondition | CombinedCondition | MtfPresetCondition | ConditionFn;

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
  /** Whether this is a partial exit (true) or full exit (false/undefined) */
  isPartial?: boolean;
  /** Percentage of original position sold in this trade */
  exitPercent?: number;
};

/**
 * Partial take profit configuration
 */
export type PartialTakeProfitConfig = {
  /** Profit threshold in percent to trigger partial exit (e.g., 5 = +5%) */
  threshold: number;
  /** Percentage of position to sell (e.g., 50 = sell 50% of position) */
  sellPercent: number;
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
  /** Partial take profit config (sell portion of position at threshold) */
  partialTakeProfit?: PartialTakeProfitConfig;
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

// ============================================
// Multi-Timeframe (MTF) Types
// ============================================

/**
 * Dataset for a single timeframe
 */
export type MtfDataset = {
  /** Timeframe identifier */
  timeframe: TimeframeShorthand;
  /** Candle data for this timeframe */
  candles: NormalizedCandle[];
  /** Cached indicators for this timeframe */
  indicators: Record<string, unknown>;
};

/**
 * MTF context for condition evaluation
 * Provides access to multiple timeframe data during backtest
 */
export type MtfContext = {
  /** Available timeframe datasets */
  datasets: Map<TimeframeShorthand, MtfDataset>;
  /** Current index for each timeframe (maps base timeframe index to higher TF index) */
  indices: Map<TimeframeShorthand, number>;
  /** Current timestamp (from base timeframe) */
  currentTime: number;
};

/**
 * MTF condition function signature
 */
export type MtfConditionFn = (
  mtf: MtfContext,
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[],
) => boolean;

/**
 * MTF preset condition type
 */
export type MtfPresetCondition = {
  type: "mtf-preset";
  name: string;
  /** Required timeframes for this condition */
  requiredTimeframes: TimeframeShorthand[];
  evaluate: MtfConditionFn;
};

// ============================================
// Volume Analysis Types
// ============================================

/**
 * Volume anomaly detection result
 */
export type VolumeAnomalyValue = {
  /** Current volume */
  volume: number;
  /** Average volume over period */
  avgVolume: number;
  /** Volume ratio (volume / avgVolume) */
  ratio: number;
  /** Whether this is considered anomalous */
  isAnomaly: boolean;
  /** Anomaly level */
  level: "normal" | "high" | "extreme" | null;
  /** Z-score (standard deviations from mean) */
  zScore: number | null;
};

/**
 * Single price level in Volume Profile
 */
export type VolumePriceLevel = {
  /** Price level lower bound */
  priceLow: number;
  /** Price level upper bound */
  priceHigh: number;
  /** Price level midpoint */
  priceMid: number;
  /** Total volume at this price level */
  volume: number;
  /** Percentage of total volume */
  volumePercent: number;
};

/**
 * Volume Profile result
 */
export type VolumeProfileValue = {
  /** Volume distribution by price level */
  levels: VolumePriceLevel[];
  /** Point of Control - price level with highest volume */
  poc: number;
  /** Value Area High - upper bound of 70% volume concentration */
  vah: number;
  /** Value Area Low - lower bound of 70% volume concentration */
  val: number;
  /** Highest price in the profile period */
  periodHigh: number;
  /** Lowest price in the profile period */
  periodLow: number;
};

/**
 * Volume trend confirmation result
 */
export type VolumeTrendValue = {
  /** Price trend direction */
  priceTrend: "up" | "down" | "neutral";
  /** Volume trend direction */
  volumeTrend: "up" | "down" | "neutral";
  /** True if volume confirms price trend (up+up or down+down) */
  isConfirmed: boolean;
  /** True if volume diverges from price (potential reversal signal) */
  hasDivergence: boolean;
  /** Confidence score (0-100) */
  confidence: number;
};

// ============================================
// ATR Risk Management Types
// ============================================

/**
 * ATR-based risk management options for backtesting
 */
export type AtrRiskOptions = {
  /** ATR period for calculations (default: 14) */
  atrPeriod?: number;
  /** ATR multiplier for stop loss (e.g., 2.5 = 2.5 * ATR below entry) */
  atrStopMultiplier?: number;
  /** ATR multiplier for take profit (e.g., 3.0 = 3.0 * ATR above entry) */
  atrTakeProfitMultiplier?: number;
  /** ATR multiplier for trailing stop (e.g., 2.0 = 2.0 * ATR from peak) */
  atrTrailingMultiplier?: number;
  /** Use ATR from entry time (true) or recalculate each bar (false, default) */
  useEntryAtr?: boolean;
};

/**
 * Chandelier Exit indicator options
 */
export type ChandelierExitOptions = {
  /** ATR period (default: 22, classic Chandelier uses 22) */
  period?: number;
  /** ATR multiplier (default: 3.0) */
  multiplier?: number;
  /** Lookback period for highest high / lowest low (default: same as ATR period) */
  lookback?: number;
};

/**
 * Chandelier Exit indicator result
 */
export type ChandelierExitValue = {
  /** Long exit level (for long positions) - highest high minus ATR * multiplier */
  longExit: number | null;
  /** Short exit level (for short positions) - lowest low plus ATR * multiplier */
  shortExit: number | null;
  /** Current trend direction: 1 = bullish, -1 = bearish, 0 = undefined */
  direction: 1 | -1 | 0;
  /** Whether price crossed the exit level (potential exit signal) */
  isCrossover: boolean;
  /** Highest high over lookback period */
  highestHigh: number | null;
  /** Lowest low over lookback period */
  lowestLow: number | null;
  /** Current ATR value */
  atr: number | null;
};

/**
 * ATR Stop Levels indicator options
 */
export type AtrStopsOptions = {
  /** ATR period (default: 14) */
  period?: number;
  /** Stop loss multiplier (default: 2.0) */
  stopMultiplier?: number;
  /** Take profit multiplier (default: 3.0) */
  takeProfitMultiplier?: number;
};

/**
 * ATR Stop Levels indicator result
 * Provides ATR-based price levels for risk management
 */
export type AtrStopsValue = {
  /** Stop loss level for long position (current close - ATR * multiplier) */
  longStopLevel: number | null;
  /** Stop loss level for short position (current close + ATR * multiplier) */
  shortStopLevel: number | null;
  /** Take profit level for long position (current close + ATR * multiplier) */
  longTakeProfitLevel: number | null;
  /** Take profit level for short position (current close - ATR * multiplier) */
  shortTakeProfitLevel: number | null;
  /** Current ATR value */
  atr: number | null;
  /** Stop distance in price units */
  stopDistance: number | null;
  /** Take profit distance in price units */
  takeProfitDistance: number | null;
};

// ============================================
// Position Sizing Types
// ============================================

/**
 * Position size calculation result
 */
export type PositionSizeResult = {
  /** Number of shares/units to trade */
  shares: number;
  /** Dollar amount to invest */
  positionValue: number;
  /** Risk amount in dollars */
  riskAmount: number;
  /** Percentage of capital being risked */
  riskPercent: number;
  /** Stop loss price (if applicable) */
  stopPrice: number | null;
  /** Calculation method used */
  method: PositionSizingMethod;
};

/**
 * Position sizing method type
 */
export type PositionSizingMethod = "risk-based" | "atr-based" | "kelly" | "fixed-fractional";

/**
 * Base options for all position sizing methods
 */
export type PositionSizingBaseOptions = {
  /** Account/portfolio size */
  accountSize: number;
  /** Entry price of the security */
  entryPrice: number;
  /** Minimum share size (e.g., 1 for stocks, 0.001 for crypto) */
  minShares?: number;
  /** Maximum position as percentage of account (default: 100) */
  maxPositionPercent?: number;
  /** Round shares to nearest integer (default: true) */
  roundShares?: boolean;
};

/**
 * Options for risk-based position sizing
 */
export type RiskBasedSizingOptions = PositionSizingBaseOptions & {
  /** Risk percentage per trade (e.g., 1 = 1% of account) */
  riskPercent: number;
  /** Stop loss price */
  stopLossPrice: number;
  /** Position direction: long (stop below entry) or short (stop above entry) */
  direction?: "long" | "short";
};

/**
 * Options for ATR-based position sizing
 */
export type AtrBasedSizingOptions = PositionSizingBaseOptions & {
  /** Risk percentage per trade (e.g., 1 = 1% of account) */
  riskPercent: number;
  /** Current ATR value */
  atrValue: number;
  /** ATR multiplier for stop distance (default: 2) */
  atrMultiplier?: number;
  /** Position direction: long (stop below entry) or short (stop above entry) */
  direction?: "long" | "short";
};

/**
 * Options for Kelly Criterion position sizing
 */
export type KellySizingOptions = PositionSizingBaseOptions & {
  /** Historical win rate (0-1) */
  winRate: number;
  /** Average win/loss ratio (avgWin / avgLoss) */
  winLossRatio: number;
  /** Kelly fraction to use (default: 0.5 = half-Kelly) */
  kellyFraction?: number;
  /** Maximum Kelly percentage allowed (default: 25) */
  maxKellyPercent?: number;
};

/**
 * Options for fixed fractional position sizing
 */
export type FixedFractionalOptions = PositionSizingBaseOptions & {
  /** Fixed percentage of account per trade */
  fractionPercent: number;
};

/**
 * Combined position sizing options (union type)
 */
export type PositionSizingOptions =
  | ({ method: "risk-based" } & RiskBasedSizingOptions)
  | ({ method: "atr-based" } & AtrBasedSizingOptions)
  | ({ method: "kelly" } & KellySizingOptions)
  | ({ method: "fixed-fractional" } & FixedFractionalOptions);

// ============================================================================
// Signal Scoring Types
// ============================================================================

/**
 * Individual signal evaluator function
 * Returns a score between 0 and 1 indicating signal strength
 */
export type SignalEvaluator = (
  candles: NormalizedCandle[],
  index: number,
  context?: MtfContext,
) => number;

/**
 * Signal definition with name and weight
 */
export type SignalDefinition = {
  /** Unique identifier for the signal */
  name: string;
  /** Display name for reporting */
  displayName: string;
  /** Weight for scoring (higher = more important) */
  weight: number;
  /** Signal evaluator function */
  evaluate: SignalEvaluator;
  /** Optional category for grouping */
  category?: "momentum" | "trend" | "volume" | "volatility" | "mtf";
};

/**
 * Result of scoring all signals
 */
export type ScoreResult = {
  /** Raw weighted sum of all signals */
  rawScore: number;
  /** Normalized score (0-100) */
  normalizedScore: number;
  /** Maximum possible score */
  maxScore: number;
  /** Signal strength classification */
  strength: "strong" | "moderate" | "weak" | "none";
  /** Number of active signals */
  activeSignals: number;
  /** Total number of signals */
  totalSignals: number;
};

/**
 * Detailed breakdown of individual signal contributions
 */
export type SignalContribution = {
  /** Signal name */
  name: string;
  /** Display name */
  displayName: string;
  /** Raw score from evaluator (0-1) */
  rawValue: number;
  /** Weighted score contribution */
  score: number;
  /** Weight used */
  weight: number;
  /** Whether signal is active (rawValue > 0) */
  isActive: boolean;
  /** Category of the signal */
  category?: string;
};

/**
 * Full score breakdown with all signal contributions
 */
export type ScoreBreakdown = ScoreResult & {
  /** Individual signal contributions */
  contributions: SignalContribution[];
};

/**
 * Configuration for the scoring system
 */
export type ScoringConfig = {
  /** Array of signal definitions */
  signals: SignalDefinition[];
  /** Threshold for "strong" strength (default: 70) */
  strongThreshold?: number;
  /** Threshold for "moderate" strength (default: 50) */
  moderateThreshold?: number;
  /** Threshold for "weak" strength (default: 30) */
  weakThreshold?: number;
};

/**
 * Preset strategy names
 */
export type ScoringPreset = "momentum" | "meanReversion" | "trendFollowing" | "balanced";
