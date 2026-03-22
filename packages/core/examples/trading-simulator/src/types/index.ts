import type { NormalizedCandle } from "trendcraft";
import type { IndicatorData } from "../utils/indicators";

export type { NormalizedCandle };

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export type SimulatorPhase = "setup" | "running" | "finished";

// ===========================================
// Multi-symbol support
// ===========================================

/**
 * Per-symbol session data
 * Each symbol has its own candle data, positions, and trade history
 */
export type Currency = "JPY" | "USD";

export const CURRENCY_CONFIG: Record<
  Currency,
  {
    symbol: string;
    locale: string;
    fractionDigits: number;
    defaultLotPresets: number[];
  }
> = {
  JPY: { symbol: "¥", locale: "ja-JP", fractionDigits: 0, defaultLotPresets: [10, 50, 100, 500] },
  USD: { symbol: "$", locale: "en-US", fractionDigits: 2, defaultLotPresets: [1, 5, 10, 50] },
};

/** Format a price value with currency symbol */
export function formatPrice(value: number, currency: Currency = "JPY"): string {
  const cfg = CURRENCY_CONFIG[currency];
  return `${cfg.symbol}${value.toLocaleString(cfg.locale, { maximumFractionDigits: cfg.fractionDigits })}`;
}

export interface SymbolSession {
  id: string; // UUID
  fileName: string;
  allCandles: NormalizedCandle[];
  positions: Position[];
  tradeHistory: Trade[];
  indicatorData: IndicatorData | null;
  equityCurve: EquityPoint[];
  // Symbol-specific start index (position within common date range)
  startIndex: number;
  // Market context
  currency: Currency;
}

/**
 * Common date range across all symbols
 * When multiple CSVs are loaded, simulation runs only on common dates
 */
export interface CommonDateRange {
  startDate: number;
  endDate: number;
  dates: number[]; // Sorted array of common dates
}

/**
 * Portfolio statistics
 * Overall performance for multi-symbol trading
 */
export interface PortfolioStats {
  totalPnl: number;
  totalPnlPercent: number;
  symbolStats: SymbolStats[];
  aggregatedStats: AggregatedStats;
}

export interface SymbolStats {
  symbolId: string;
  fileName: string;
  pnl: number;
  pnlPercent: number;
  allocation: number; // Allocation ratio (%)
  tradeCount: number;
  winRate: number;
}

export interface AggregatedStats {
  totalTradeCount: number;
  overallWinRate: number;
  maxDrawdown: number;
  avgAlpha: number; // vs B&H average
}

export type PriceType = "nextOpen" | "high" | "low" | "close";

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  nextOpen: "Next Open",
  high: "High",
  low: "Low",
  close: "Close",
};

export type PositionDirection = "long" | "short";

export interface Position {
  id: string;
  direction: PositionDirection;
  entryPrice: number;
  entryDate: number;
  entryIndex: number;
  shares: number;
  // MFE/MAE tracking (based on High/Low)
  highestPrice: number;
  lowestPrice: number;
  highestDate: number;
  lowestDate: number;
  // Cost at purchase (including commission)
  commission: number;
  // Trailing stop price (tracked per position)
  trailingStopPrice?: number;
}

// Aggregated info for multiple positions
export interface PositionSummary {
  totalShares: number;
  avgEntryPrice: number;
  totalCost: number;
  direction: PositionDirection;
}

// Indicator snapshot at time of trade
export interface IndicatorSnapshot {
  sma5?: number | null;
  sma25?: number | null;
  sma75?: number | null;
  ema12?: number | null;
  ema26?: number | null;
  rsi?: number | null;
  macdLine?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  atr?: number | null;
  stochK?: number | null;
  stochD?: number | null;
  dmiPlusDi?: number | null;
  dmiMinusDi?: number | null;
  dmiAdx?: number | null;
}

// Chart pattern / market context
export interface MarketContext {
  // Trend state
  trend: "uptrend" | "downtrend" | "range";
  trendStrength: "strong" | "moderate" | "weak";

  // Machine-readable (for LLM analysis)
  regime: "TREND_UP" | "TREND_DOWN" | "RANGE";
  confidence: number; // 0-1 (ADX-based, or estimated from trendStrength)

  // MA relationship
  priceVsSma25: "above" | "below" | "at";
  priceVsSma75: "above" | "below" | "at";
  sma25VsSma75: "golden_cross" | "death_cross" | "above" | "below";

  // RSI state
  rsiZone?: "overbought" | "oversold" | "neutral";

  // MACD state
  macdSignal?: "bullish" | "bearish" | "neutral";

  // BB position
  bbPosition?: "upper" | "middle" | "lower";

  // Description text
  description: string;
}

// Exit reason
export type ExitReason =
  | "TAKE_PROFIT" // Take profit
  | "STOP_LOSS" // Stop loss
  | "SIGNAL_FLIP" // Signal flip
  | "TIMEOUT" // Holding period exceeded
  | "MANUAL"; // Manual decision

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  TAKE_PROFIT: "Take Profit",
  STOP_LOSS: "Stop Loss",
  SIGNAL_FLIP: "Signal Flip",
  TIMEOUT: "Timeout",
  MANUAL: "Manual",
};

// Exit trigger (detailed reason)
export type ExitTrigger =
  | "TARGET_REACHED" // Target price reached
  | "RSI_OVERBOUGHT" // RSI overbought
  | "RSI_OVERSOLD" // RSI oversold
  | "MACD_CROSS" // MACD cross
  | "MA_CROSS" // MA cross
  | "TRAILING_STOP" // Trailing stop
  | "TIME_LIMIT" // Time limit
  | "DISCRETIONARY"; // Discretionary

export const EXIT_TRIGGER_LABELS: Record<ExitTrigger, string> = {
  TARGET_REACHED: "Target Reached",
  RSI_OVERBOUGHT: "RSI Overbought",
  RSI_OVERSOLD: "RSI Oversold",
  MACD_CROSS: "MACD Cross",
  MA_CROSS: "MA Cross",
  TRAILING_STOP: "Trailing Stop",
  TIME_LIMIT: "Time Limit",
  DISCRETIONARY: "Discretionary",
};

export interface TradeJournalEntry {
  thesis: string;
  setup: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  coachingSignalsAtTime: string[]; // Signal type strings at trade time
}

export interface BracketOrder {
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
}

export interface Trade {
  id: string;
  type: "BUY" | "SELL" | "SHORT_SELL" | "BUY_TO_COVER";
  date: number;
  price: number;
  shares: number;
  memo: string;
  priceType: PriceType;
  journal?: TradeJournalEntry;
  bracket?: BracketOrder;
  pnl?: number;
  pnlPercent?: number;
  // Trade-time info (for LLM analysis)
  indicators?: IndicatorSnapshot;
  marketContext?: MarketContext;
  // Cost-related
  commission?: number; // Commission
  slippage?: number; // Slippage amount
  effectivePrice?: number; // Effective price (including slippage)
  // SELL only
  exitReason?: ExitReason; // Exit reason
  exitTrigger?: ExitTrigger; // Detailed trigger
  grossPnl?: number; // Gross P&L (before costs)
  netPnl?: number; // Net P&L (after costs)
  tax?: number; // Tax (only when profitable)
  afterTaxPnl?: number; // After-tax P&L
  // MFE/MAE (SELL only)
  mfe?: number; // Max favorable excursion (%)
  mae?: number; // Max adverse excursion (%)
  mfePrice?: number; // Price at MFE
  maePrice?: number; // Price at MAE
  mfeDate?: number; // MFE date
  maeDate?: number; // MAE date
  mfeUtilization?: number; // MFE utilization (%) - pnlPercent/mfe*100
}

export interface SimulationConfig {
  startDate: number;
  initialCandleCount: number;
  initialCapital: number;
  enabledIndicators: string[];
  indicatorParams: IndicatorParams;
  // Cost settings
  commissionRate: number; // Commission rate (%, default 0)
  slippageBps: number; // Slippage (bps, default 0)
  // Tax settings
  taxRate: number; // Capital gains tax rate (%, default 20.315)
  // Chart display settings
  stopLossPercent: number; // Stop loss line % (default 5)
  takeProfitPercent: number; // Take profit line % (default 10)
  // Trailing stop settings
  trailingStopEnabled: boolean; // Trailing stop enabled
  trailingStopPercent: number; // Trailing stop % (default 5)
}

// ===========================================
// Pending orders (next-open execution)
// ===========================================

export type OrderType = "BUY" | "SELL" | "SELL_ALL" | "SHORT_SELL" | "BUY_TO_COVER" | "COVER_ALL";

export interface PendingOrder {
  id: string;
  symbolId: string; // Target symbol
  orderType: OrderType;
  shares: number;
  memo: string;
  createdAt: number; // Order creation date (current chart date)
  // Limit price — if set, order only fills when price condition is met
  limitPrice?: number;
  // Stop-Limit: order becomes active when stopTrigger is hit, then fills at limitPrice
  stopTrigger?: number;
  stopTriggered?: boolean;
  // OCO group — when one order in a group fills, others are cancelled
  ocoGroupId?: string;
  // SELL only
  exitReason?: ExitReason;
  exitTrigger?: ExitTrigger;
}

// Alert type
export type AlertType =
  | "STOP_LOSS_WARNING"
  | "TAKE_PROFIT_REACHED"
  | "TRAILING_STOP_HIT"
  | "ORDER_EXECUTED"
  | "VOLUME_SPIKE_AVERAGE" // Volume exceeds Nx average
  | "VOLUME_SPIKE_BREAKOUT" // N-day highest volume breakout
  | "VOLUME_ACCUMULATION" // Volume accumulation phase (regression-based)
  | "VOLUME_ABOVE_AVERAGE" // Volume sustained above average
  | "VOLUME_MA_CROSS" // Volume MA cross
  | "CMF_ACCUMULATION" // CMF accumulation phase (CMF > 0)
  | "CMF_DISTRIBUTION" // CMF distribution phase (CMF < 0)
  | "OBV_RISING" // OBV rising trend
  | "OBV_FALLING"; // OBV falling trend

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  timestamp: number;
}

// ===========================================
// Volume spike settings
// ===========================================

export interface VolumeSpikeSettings {
  // Average volume detection
  averageVolumeEnabled: boolean;
  averageVolumePeriod: number; // N-day average (default: 20)
  averageVolumeMultiplier: number; // X multiplier (default: 2.0)
  // Breakout detection
  breakoutVolumeEnabled: boolean;
  breakoutVolumePeriod: number; // N-day high (default: 20)
  // Accumulation phase detection (rising volume - regression-based)
  accumulationEnabled: boolean;
  accumulationPeriod: number; // Slope calculation period (default: 10)
  accumulationMinSlope: number; // Min slope (default: 0.05 = 5%/day)
  accumulationMinDays: number; // Min consecutive days (default: 3)
  // Above-average sustained detection (average comparison-based)
  aboveAverageEnabled: boolean;
  aboveAveragePeriod: number; // Average calculation period (default: 20)
  aboveAverageMinRatio: number; // Min ratio (default: 1.0 = above average)
  aboveAverageMinDays: number; // Min consecutive days (default: 3)
  // MA cross detection
  maCrossEnabled: boolean;
  maCrossShortPeriod: number; // Short MA period (default: 5)
  maCrossLongPeriod: number; // Long MA period (default: 20)
  // CMF accumulation/distribution detection
  cmfEnabled: boolean;
  cmfPeriod: number; // CMF calculation period (default: 20)
  cmfThreshold: number; // Threshold (default: 0)
  // OBV trend detection
  obvEnabled: boolean;
  obvPeriod: number; // OBV comparison period (default: 10)
  // Display settings
  showRealtimeAlerts: boolean; // Show real-time alerts
  showChartMarkers: boolean; // Show chart markers
}

export const DEFAULT_VOLUME_SPIKE_SETTINGS: VolumeSpikeSettings = {
  averageVolumeEnabled: true,
  averageVolumePeriod: 20,
  averageVolumeMultiplier: 2.0,
  breakoutVolumeEnabled: true,
  breakoutVolumePeriod: 20,
  accumulationEnabled: true,
  accumulationPeriod: 10,
  accumulationMinSlope: 0.05,
  accumulationMinDays: 3,
  aboveAverageEnabled: false,
  aboveAveragePeriod: 20,
  aboveAverageMinRatio: 1.0,
  aboveAverageMinDays: 3,
  maCrossEnabled: true,
  maCrossShortPeriod: 5,
  maCrossLongPeriod: 20,
  cmfEnabled: true,
  cmfPeriod: 20,
  cmfThreshold: 0,
  obvEnabled: true,
  obvPeriod: 10,
  showRealtimeAlerts: false,
  showChartMarkers: true,
};

// Volume spike detection result
export interface DetectedVolumeSpike {
  time: number;
  volume: number;
  type: "average" | "breakout" | "accumulation" | "above_average" | "ma_cross";
  ratio: number; // vs average, vs previous high, normalized slope, or MA ratio
  consecutiveDays?: number; // Consecutive days for accumulation/above-average phases
}

export interface SimulatorStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  profitFactor: number;
}

export interface YearHighLow {
  yearHigh: number;
  yearHighDate: number;
  yearLow: number;
  yearLowDate: number;
  currentPrice: number;
  fromHigh: number; // % from year high
  fromLow: number; // % from year low
}

// Equity curve data point
export interface EquityPoint {
  time: number;
  equity: number; // Current equity
  buyHoldEquity: number; // B&H comparison
  drawdown: number; // Drawdown from peak (%)
  tradeType?: "BUY" | "SELL" | "SHORT_SELL" | "BUY_TO_COVER"; // Trade marker
}

// ===========================================
// Drawing tools
// ===========================================

export type DrawingType = "horizontal" | "trendline";

export interface Drawing {
  id: string;
  type: DrawingType;
  color: string;
  label?: string;
  // Horizontal line
  price?: number;
  // Trendline (two points)
  startDate?: number;
  startPrice?: number;
  endDate?: number;
  endPrice?: number;
}

// ===========================================
// Strategy comparison
// ===========================================

export interface SavedSession {
  id: string;
  name: string;
  savedAt: number;
  equityCurve: EquityPoint[];
  stats: {
    totalPnl: number;
    totalPnlPercent: number;
    winRate: number;
    maxDrawdown: number;
    tradeCount: number;
  };
}

// Legacy - kept for backward compatibility
export const AVAILABLE_INDICATORS = [
  { key: "sma5", label: "SMA 5" },
  { key: "sma25", label: "SMA 25" },
  { key: "sma75", label: "SMA 75" },
  { key: "ema12", label: "EMA 12" },
  { key: "ema26", label: "EMA 26" },
  { key: "bb", label: "Bollinger Bands" },
  { key: "rsi", label: "RSI 14" },
  { key: "macd", label: "MACD" },
  { key: "volume", label: "Volume" },
] as const;

export type IndicatorKey = (typeof AVAILABLE_INDICATORS)[number]["key"];

// Indicator definitions by category
export type IndicatorCategory =
  | "trend"
  | "volatility"
  | "momentum"
  | "volume"
  | "smc"
  | "patterns"
  | "price"
  | "filter";
export type ChartType = "overlay" | "subchart";

// Indicator parameter type definitions
export interface IndicatorParams {
  // SMA
  sma5Period?: number;
  sma25Period?: number;
  sma75Period?: number;
  // EMA
  ema12Period?: number;
  ema26Period?: number;
  // RSI
  rsiPeriod?: number;
  // MACD
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;
  // Bollinger Bands
  bbPeriod?: number;
  bbStdDev?: number;
  // ATR
  atrPeriod?: number;
  // Stochastics
  stochKPeriod?: number;
  stochDPeriod?: number;
  // Stochastic RSI
  stochRsiRsiPeriod?: number;
  stochRsiStochPeriod?: number;
  stochRsiKPeriod?: number;
  stochRsiDPeriod?: number;
  // DMI
  dmiPeriod?: number;
  // CCI
  cciPeriod?: number;
  // MFI
  mfiPeriod?: number;
  // Supertrend
  supertrendPeriod?: number;
  supertrendMultiplier?: number;
  // Keltner
  keltnerEmaPeriod?: number;
  keltnerAtrPeriod?: number;
  keltnerMultiplier?: number;
  // Donchian
  donchianPeriod?: number;
  // SMC Order Block
  obSwingPeriod?: number;
  obMinVolumeRatio?: number;
  obMaxActiveOBs?: number;
  // SMC Liquidity Sweep
  lsSwingPeriod?: number;
  lsMaxRecoveryBars?: number;
  lsMinSweepDepth?: number;
  // Double Top/Bottom
  dtTolerance?: number;
  dtMinDistance?: number;
  dtMaxDistance?: number;
  dtMinMiddleDepth?: number;
  dtSwingLookback?: number;
  dtMaxBreakoutDistance?: number;
  dtValidateNecklineViolation?: boolean;
  dtNecklineViolationTolerance?: number;
  dtStrictMode?: boolean;
  // Head & Shoulders
  hsShoulderTolerance?: number;
  hsMaxNecklineSlope?: number;
  // Cup with Handle
  chMinCupDepth?: number;
  chMaxCupDepth?: number;
  chMinCupLength?: number;
  // WMA
  wmaPeriod?: number;
  // VWMA
  vwmaPeriod?: number;
  // KAMA
  kamaPeriod?: number;
  // T3
  t3Period?: number;
  t3VFactor?: number;
  // HMA
  hmaPeriod?: number;
  // McGinley Dynamic
  mcginleyPeriod?: number;
  // EMA Ribbon
  emaRibbonPeriods?: string; // comma-separated, e.g. "8,13,21,34,55,89"
  // Williams %R
  williamsPeriod?: number;
  // ROC
  rocPeriod?: number;
  // Connors RSI
  connorsRsiPeriod?: number;
  connorsStreakPeriod?: number;
  connorsRocPeriod?: number;
  // CMO
  cmoPeriod?: number;
  // IMI
  imiPeriod?: number;
  // TRIX
  trixPeriod?: number;
  trixSignalPeriod?: number;
  // Aroon
  aroonPeriod?: number;
  // DPO
  dpoPeriod?: number;
  // Hurst
  hurstMinWindow?: number;
  hurstMaxWindow?: number;
  // ADXR
  adxrPeriod?: number;
  // Vortex
  vortexPeriod?: number;
  // Chandelier Exit
  chandelierPeriod?: number;
  chandelierMultiplier?: number;
  // VWAP
  vwapPeriod?: number;
  // ATR Stops
  atrStopsPeriod?: number;
  atrStopsMultiplier?: number;
  // Super Smoother
  superSmootherPeriod?: number;
  // CMF
  cmfPeriod?: number;
  // Klinger
  klingerShortPeriod?: number;
  klingerLongPeriod?: number;
  klingerSignalPeriod?: number;
  // Elder Force Index
  elderForcePeriod?: number;
  // Volume Anomaly
  volumeAnomalyPeriod?: number;
  volumeAnomalyThreshold?: number;
  // Volume Profile
  volumeProfileLevels?: number;
  volumeProfilePeriod?: number;
  // Volume Trend
  volumeTrendPricePeriod?: number;
  volumeTrendVolumePeriod?: number;
  // Roofing Filter
  roofingHighPassPeriod?: number;
  roofingLowPassPeriod?: number;
  // Choppiness Index
  choppinessPeriod?: number;
  // HMM Regime
  hmmNumStates?: number;
  // Swing Points
  swingLeftBars?: number;
  swingRightBars?: number;
  // Pivot Points
  pivotMethod?: string; // "standard" | "fibonacci" | "woodie" | "camarilla" | "demark"
  // Highest/Lowest
  highestLowestPeriod?: number;
  // Zigzag
  zigzagDeviation?: number;
  // Fractals
  fractalPeriod?: number;
  // FVG
  fvgMinGapPercent?: number;
  // BOS/CHoCH
  bosSwingPeriod?: number;
}

export const DEFAULT_INDICATOR_PARAMS: IndicatorParams = {
  sma5Period: 5,
  sma25Period: 25,
  sma75Period: 75,
  ema12Period: 12,
  ema26Period: 26,
  rsiPeriod: 14,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  bbPeriod: 20,
  bbStdDev: 2,
  atrPeriod: 14,
  stochKPeriod: 14,
  stochDPeriod: 3,
  stochRsiRsiPeriod: 14,
  stochRsiStochPeriod: 14,
  stochRsiKPeriod: 3,
  stochRsiDPeriod: 3,
  dmiPeriod: 14,
  cciPeriod: 20,
  mfiPeriod: 14,
  supertrendPeriod: 10,
  supertrendMultiplier: 3,
  keltnerEmaPeriod: 20,
  keltnerAtrPeriod: 10,
  keltnerMultiplier: 2,
  donchianPeriod: 20,
  // SMC Order Block
  obSwingPeriod: 5,
  obMinVolumeRatio: 1.0,
  obMaxActiveOBs: 10,
  // SMC Liquidity Sweep
  lsSwingPeriod: 5,
  lsMaxRecoveryBars: 3,
  lsMinSweepDepth: 0,
  // Double Top/Bottom
  dtTolerance: 0.02,
  dtMinDistance: 15,
  dtMaxDistance: 60, // Balanced: not too strict (40) or too loose (100)
  dtMinMiddleDepth: 0.07,
  dtSwingLookback: 5,
  dtMaxBreakoutDistance: 20,
  dtValidateNecklineViolation: true,
  dtNecklineViolationTolerance: 0, // 0: do not allow bars beyond the neckline
  dtStrictMode: false, // false = loose mode (default), true = strict mode
  // Head & Shoulders
  hsShoulderTolerance: 0.05,
  hsMaxNecklineSlope: 0.1,
  // Cup with Handle
  chMinCupDepth: 0.12,
  chMaxCupDepth: 0.35,
  chMinCupLength: 30,
  // New MA
  wmaPeriod: 20,
  vwmaPeriod: 20,
  kamaPeriod: 10,
  t3Period: 5,
  t3VFactor: 0.7,
  hmaPeriod: 9,
  mcginleyPeriod: 14,
  emaRibbonPeriods: "8,13,21,34,55,89",
  // New Momentum
  williamsPeriod: 14,
  rocPeriod: 12,
  connorsRsiPeriod: 3,
  connorsStreakPeriod: 2,
  connorsRocPeriod: 100,
  cmoPeriod: 14,
  imiPeriod: 14,
  trixPeriod: 15,
  trixSignalPeriod: 9,
  aroonPeriod: 25,
  dpoPeriod: 20,
  hurstMinWindow: 10,
  hurstMaxWindow: 100,
  // New Trend
  adxrPeriod: 14,
  vortexPeriod: 14,
  // Chandelier Exit
  chandelierPeriod: 22,
  chandelierMultiplier: 3,
  // VWAP
  vwapPeriod: 0,
  // ATR Stops
  atrStopsPeriod: 14,
  atrStopsMultiplier: 2,
  // Super Smoother
  superSmootherPeriod: 10,
  // New Volume
  cmfPeriod: 20,
  klingerShortPeriod: 34,
  klingerLongPeriod: 55,
  klingerSignalPeriod: 13,
  elderForcePeriod: 13,
  volumeAnomalyPeriod: 20,
  volumeAnomalyThreshold: 2,
  volumeProfileLevels: 24,
  volumeProfilePeriod: 50,
  volumeTrendPricePeriod: 14,
  volumeTrendVolumePeriod: 14,
  // Filter
  roofingHighPassPeriod: 48,
  roofingLowPassPeriod: 10,
  // Volatility
  choppinessPeriod: 14,
  hmmNumStates: 3,
  // Price
  swingLeftBars: 5,
  swingRightBars: 5,
  pivotMethod: "standard",
  highestLowestPeriod: 20,
  zigzagDeviation: 5,
  fractalPeriod: 2,
  // SMC
  fvgMinGapPercent: 0.1,
  bosSwingPeriod: 5,
};

// Configurable indicator parameter definitions
export interface ParamConfig {
  key: keyof IndicatorParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const INDICATOR_PARAM_CONFIGS: Record<string, ParamConfig[]> = {
  sma5: [{ key: "sma5Period", label: "Period", min: 2, max: 200, step: 1 }],
  sma25: [{ key: "sma25Period", label: "Period", min: 2, max: 200, step: 1 }],
  sma75: [{ key: "sma75Period", label: "Period", min: 2, max: 200, step: 1 }],
  ema12: [{ key: "ema12Period", label: "Period", min: 2, max: 200, step: 1 }],
  ema26: [{ key: "ema26Period", label: "Period", min: 2, max: 200, step: 1 }],
  rsi: [{ key: "rsiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  macd: [
    { key: "macdFastPeriod", label: "Fast", min: 2, max: 50, step: 1 },
    { key: "macdSlowPeriod", label: "Slow", min: 2, max: 100, step: 1 },
    { key: "macdSignalPeriod", label: "Signal", min: 2, max: 50, step: 1 },
  ],
  bb: [
    { key: "bbPeriod", label: "Period", min: 2, max: 100, step: 1 },
    { key: "bbStdDev", label: "Std Dev", min: 0.5, max: 4, step: 0.5 },
  ],
  atr: [{ key: "atrPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  stochastics: [
    { key: "stochKPeriod", label: "K Period", min: 2, max: 50, step: 1 },
    { key: "stochDPeriod", label: "D Period", min: 2, max: 20, step: 1 },
  ],
  stochRsi: [
    { key: "stochRsiRsiPeriod", label: "RSI Period", min: 2, max: 50, step: 1 },
    { key: "stochRsiStochPeriod", label: "Stoch Period", min: 2, max: 50, step: 1 },
    { key: "stochRsiKPeriod", label: "K", min: 2, max: 20, step: 1 },
    { key: "stochRsiDPeriod", label: "D", min: 2, max: 20, step: 1 },
  ],
  dmi: [{ key: "dmiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  cci: [{ key: "cciPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  mfi: [{ key: "mfiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  supertrend: [
    { key: "supertrendPeriod", label: "Period", min: 2, max: 50, step: 1 },
    { key: "supertrendMultiplier", label: "Multiplier", min: 1, max: 10, step: 0.5 },
  ],
  keltner: [
    { key: "keltnerEmaPeriod", label: "EMA Period", min: 2, max: 100, step: 1 },
    { key: "keltnerAtrPeriod", label: "ATR Period", min: 2, max: 50, step: 1 },
    { key: "keltnerMultiplier", label: "Multiplier", min: 0.5, max: 5, step: 0.5 },
  ],
  donchian: [{ key: "donchianPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  // SMC
  orderBlock: [
    { key: "obSwingPeriod", label: "Swing Period", min: 2, max: 20, step: 1 },
    { key: "obMinVolumeRatio", label: "Min Vol Ratio", min: 0.5, max: 3, step: 0.1 },
    { key: "obMaxActiveOBs", label: "Max OBs", min: 3, max: 20, step: 1 },
  ],
  liquiditySweep: [
    { key: "lsSwingPeriod", label: "Swing Period", min: 2, max: 20, step: 1 },
    { key: "lsMaxRecoveryBars", label: "Max Recovery Bars", min: 1, max: 10, step: 1 },
    { key: "lsMinSweepDepth", label: "Min Depth %", min: 0, max: 5, step: 0.1 },
  ],
  // Patterns
  doubleTopBottom: [
    { key: "dtTolerance", label: "Price Tolerance", min: 0.01, max: 0.05, step: 0.005 },
    { key: "dtMinDistance", label: "Min Distance", min: 10, max: 40, step: 1 },
    { key: "dtMaxDistance", label: "Max Distance", min: 40, max: 150, step: 5 },
    { key: "dtMinMiddleDepth", label: "Middle Depth %", min: 0.03, max: 0.15, step: 0.01 },
    { key: "dtSwingLookback", label: "Swing Confirm", min: 3, max: 10, step: 1 },
    { key: "dtMaxBreakoutDistance", label: "Max Breakout Dist", min: 10, max: 50, step: 5 },
    {
      key: "dtNecklineViolationTolerance",
      label: "Neckline Tol %",
      min: 0,
      max: 0.02,
      step: 0.001,
    },
    { key: "dtStrictMode", label: "Strict Mode (0/1)", min: 0, max: 1, step: 1 },
  ],
  headShoulders: [
    { key: "hsShoulderTolerance", label: "Shoulder Tolerance", min: 0.01, max: 0.15, step: 0.01 },
    { key: "hsMaxNecklineSlope", label: "Max Slope", min: 0.01, max: 0.3, step: 0.01 },
  ],
  cupHandle: [
    { key: "chMinCupDepth", label: "Min Depth", min: 0.05, max: 0.25, step: 0.01 },
    { key: "chMaxCupDepth", label: "Max Depth", min: 0.2, max: 0.5, step: 0.01 },
    { key: "chMinCupLength", label: "Min Length", min: 15, max: 60, step: 5 },
  ],
  // New MAs
  wma: [{ key: "wmaPeriod", label: "Period", min: 2, max: 200, step: 1 }],
  vwma: [{ key: "vwmaPeriod", label: "Period", min: 2, max: 200, step: 1 }],
  kama: [{ key: "kamaPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  t3: [
    { key: "t3Period", label: "Period", min: 2, max: 50, step: 1 },
    { key: "t3VFactor", label: "V Factor", min: 0, max: 1, step: 0.1 },
  ],
  hma: [{ key: "hmaPeriod", label: "Period", min: 2, max: 200, step: 1 }],
  mcginley: [{ key: "mcginleyPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  // New Momentum
  williams: [{ key: "williamsPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  roc: [{ key: "rocPeriod", label: "Period", min: 1, max: 100, step: 1 }],
  connorsRsi: [
    { key: "connorsRsiPeriod", label: "RSI Period", min: 2, max: 20, step: 1 },
    { key: "connorsStreakPeriod", label: "Streak Period", min: 2, max: 10, step: 1 },
    { key: "connorsRocPeriod", label: "ROC Period", min: 10, max: 200, step: 10 },
  ],
  cmo: [{ key: "cmoPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  imi: [{ key: "imiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  trix: [
    { key: "trixPeriod", label: "Period", min: 2, max: 50, step: 1 },
    { key: "trixSignalPeriod", label: "Signal", min: 2, max: 30, step: 1 },
  ],
  aroon: [{ key: "aroonPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  dpo: [{ key: "dpoPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  hurst: [
    { key: "hurstMinWindow", label: "Min Window", min: 5, max: 50, step: 5 },
    { key: "hurstMaxWindow", label: "Max Window", min: 50, max: 500, step: 10 },
  ],
  // New Trend
  adxr: [{ key: "adxrPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  vortex: [{ key: "vortexPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  // Chandelier Exit
  chandelierExit: [
    { key: "chandelierPeriod", label: "Period", min: 2, max: 50, step: 1 },
    { key: "chandelierMultiplier", label: "Multiplier", min: 1, max: 5, step: 0.5 },
  ],
  // VWAP
  vwap: [{ key: "vwapPeriod", label: "Period (0=full)", min: 0, max: 200, step: 1 }],
  // ATR Stops
  atrStops: [
    { key: "atrStopsPeriod", label: "Period", min: 2, max: 50, step: 1 },
    { key: "atrStopsMultiplier", label: "Multiplier", min: 0.5, max: 5, step: 0.5 },
  ],
  // Super Smoother
  superSmoother: [{ key: "superSmootherPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  // New Volume
  cmf: [{ key: "cmfPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  klinger: [
    { key: "klingerShortPeriod", label: "Short", min: 2, max: 100, step: 1 },
    { key: "klingerLongPeriod", label: "Long", min: 2, max: 200, step: 1 },
    { key: "klingerSignalPeriod", label: "Signal", min: 2, max: 50, step: 1 },
  ],
  elderForce: [{ key: "elderForcePeriod", label: "Period", min: 2, max: 50, step: 1 }],
  volumeAnomaly: [
    { key: "volumeAnomalyPeriod", label: "Period", min: 5, max: 50, step: 1 },
    { key: "volumeAnomalyThreshold", label: "Threshold", min: 1, max: 5, step: 0.5 },
  ],
  volumeProfile: [
    { key: "volumeProfileLevels", label: "Levels", min: 10, max: 50, step: 1 },
    { key: "volumeProfilePeriod", label: "Period", min: 10, max: 200, step: 10 },
  ],
  volumeTrend: [
    { key: "volumeTrendPricePeriod", label: "Price Period", min: 5, max: 50, step: 1 },
    { key: "volumeTrendVolumePeriod", label: "Vol Period", min: 5, max: 50, step: 1 },
  ],
  // Filter
  roofingFilter: [
    { key: "roofingHighPassPeriod", label: "HP Period", min: 10, max: 100, step: 1 },
    { key: "roofingLowPassPeriod", label: "LP Period", min: 2, max: 50, step: 1 },
  ],
  // Volatility
  choppiness: [{ key: "choppinessPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  volatilityRegime: [{ key: "hmmNumStates", label: "States", min: 2, max: 5, step: 1 }],
  // Price
  swingPoints: [
    { key: "swingLeftBars", label: "Left Bars", min: 1, max: 20, step: 1 },
    { key: "swingRightBars", label: "Right Bars", min: 1, max: 20, step: 1 },
  ],
  highestLowest: [{ key: "highestLowestPeriod", label: "Period", min: 5, max: 200, step: 1 }],
  zigzag: [{ key: "zigzagDeviation", label: "Deviation %", min: 1, max: 20, step: 0.5 }],
  fractals: [{ key: "fractalPeriod", label: "Period", min: 2, max: 10, step: 1 }],
  // SMC
  fvg: [{ key: "fvgMinGapPercent", label: "Min Gap %", min: 0, max: 1, step: 0.05 }],
  bos: [{ key: "bosSwingPeriod", label: "Swing Period", min: 2, max: 20, step: 1 }],
  choch: [{ key: "bosSwingPeriod", label: "Swing Period", min: 2, max: 20, step: 1 }],
};

export interface IndicatorDefinition {
  key: string;
  label: string;
  category: IndicatorCategory;
  chartType: ChartType;
}

export const INDICATOR_DEFINITIONS: IndicatorDefinition[] = [
  // Trend (overlay)
  { key: "sma5", label: "SMA 5", category: "trend", chartType: "overlay" },
  { key: "sma25", label: "SMA 25", category: "trend", chartType: "overlay" },
  { key: "sma75", label: "SMA 75", category: "trend", chartType: "overlay" },
  { key: "ema12", label: "EMA 12", category: "trend", chartType: "overlay" },
  { key: "ema26", label: "EMA 26", category: "trend", chartType: "overlay" },
  { key: "wma", label: "WMA", category: "trend", chartType: "overlay" },
  { key: "vwma", label: "VWMA", category: "trend", chartType: "overlay" },
  { key: "kama", label: "KAMA", category: "trend", chartType: "overlay" },
  { key: "t3", label: "T3", category: "trend", chartType: "overlay" },
  { key: "hma", label: "HMA", category: "trend", chartType: "overlay" },
  { key: "mcginley", label: "McGinley Dynamic", category: "trend", chartType: "overlay" },
  { key: "emaRibbon", label: "EMA Ribbon", category: "trend", chartType: "overlay" },
  { key: "ichimoku", label: "Ichimoku", category: "trend", chartType: "overlay" },
  { key: "supertrend", label: "Supertrend", category: "trend", chartType: "overlay" },
  { key: "parabolicSar", label: "Parabolic SAR", category: "trend", chartType: "overlay" },

  // Volatility
  { key: "bb", label: "Bollinger Bands", category: "volatility", chartType: "overlay" },
  { key: "keltner", label: "Keltner Channel", category: "volatility", chartType: "overlay" },
  { key: "donchian", label: "Donchian Channel", category: "volatility", chartType: "overlay" },
  { key: "chandelierExit", label: "Chandelier Exit", category: "volatility", chartType: "overlay" },
  { key: "vwap", label: "VWAP", category: "volatility", chartType: "overlay" },
  { key: "atrStops", label: "ATR Stops", category: "volatility", chartType: "overlay" },
  { key: "superSmoother", label: "Super Smoother", category: "volatility", chartType: "overlay" },
  { key: "atr", label: "ATR", category: "volatility", chartType: "subchart" },
  { key: "choppiness", label: "Choppiness Index", category: "volatility", chartType: "subchart" },
  {
    key: "volatilityRegime",
    label: "Vol Regime (HMM)",
    category: "volatility",
    chartType: "subchart",
  },

  // Momentum (subchart)
  { key: "rsi", label: "RSI", category: "momentum", chartType: "subchart" },
  { key: "macd", label: "MACD", category: "momentum", chartType: "subchart" },
  { key: "stochastics", label: "Stochastics", category: "momentum", chartType: "subchart" },
  { key: "stochRsi", label: "Stochastic RSI", category: "momentum", chartType: "subchart" },
  { key: "dmi", label: "DMI/ADX", category: "momentum", chartType: "subchart" },
  { key: "cci", label: "CCI", category: "momentum", chartType: "subchart" },
  { key: "williams", label: "Williams %R", category: "momentum", chartType: "subchart" },
  { key: "roc", label: "ROC", category: "momentum", chartType: "subchart" },
  { key: "connorsRsi", label: "Connors RSI", category: "momentum", chartType: "subchart" },
  { key: "cmo", label: "CMO", category: "momentum", chartType: "subchart" },
  { key: "imi", label: "IMI", category: "momentum", chartType: "subchart" },
  { key: "trix", label: "TRIX", category: "momentum", chartType: "subchart" },
  { key: "aroon", label: "Aroon", category: "momentum", chartType: "subchart" },
  { key: "dpo", label: "DPO", category: "momentum", chartType: "subchart" },
  { key: "hurst", label: "Hurst Exponent", category: "momentum", chartType: "subchart" },
  { key: "adxr", label: "ADXR", category: "momentum", chartType: "subchart" },
  { key: "vortex", label: "Vortex", category: "momentum", chartType: "subchart" },

  // Filter
  { key: "roofingFilter", label: "Roofing Filter", category: "filter", chartType: "subchart" },

  // Volume (subchart)
  { key: "volume", label: "Volume", category: "volume", chartType: "subchart" },
  { key: "obv", label: "OBV", category: "volume", chartType: "subchart" },
  { key: "mfi", label: "MFI", category: "volume", chartType: "subchart" },
  { key: "cmf", label: "CMF", category: "volume", chartType: "subchart" },
  { key: "adl", label: "ADL", category: "volume", chartType: "subchart" },
  { key: "klinger", label: "Klinger", category: "volume", chartType: "subchart" },
  { key: "elderForce", label: "Elder Force", category: "volume", chartType: "subchart" },
  { key: "volumeAnomaly", label: "Vol Anomaly", category: "volume", chartType: "subchart" },
  { key: "volumeProfile", label: "Vol Profile", category: "volume", chartType: "subchart" },
  { key: "volumeTrend", label: "Vol Trend", category: "volume", chartType: "subchart" },

  // Price (overlay)
  { key: "swingPoints", label: "Swing Points", category: "price", chartType: "overlay" },
  { key: "pivotPoints", label: "Pivot Points", category: "price", chartType: "overlay" },
  { key: "fibonacci", label: "Fibonacci", category: "price", chartType: "overlay" },
  { key: "fibExtension", label: "Fib Extension", category: "price", chartType: "overlay" },
  { key: "highestLowest", label: "Highest/Lowest", category: "price", chartType: "overlay" },
  { key: "autoTrendLine", label: "Auto Trend Line", category: "price", chartType: "overlay" },
  { key: "channelLine", label: "Channel Line", category: "price", chartType: "overlay" },
  { key: "andrewsPitchfork", label: "Andrews Pitchfork", category: "price", chartType: "overlay" },
  { key: "heikinAshi", label: "Heikin-Ashi", category: "price", chartType: "overlay" },

  // SMC (overlay)
  { key: "orderBlock", label: "Order Block", category: "smc", chartType: "overlay" },
  { key: "liquiditySweep", label: "Liquidity Sweep", category: "smc", chartType: "overlay" },
  { key: "fvg", label: "Fair Value Gap", category: "smc", chartType: "overlay" },
  { key: "bos", label: "Break of Structure", category: "smc", chartType: "overlay" },
  { key: "choch", label: "Change of Character", category: "smc", chartType: "overlay" },

  // Pattern recognition (overlay)
  {
    key: "doubleTopBottom",
    label: "Double Top/Bottom",
    category: "patterns",
    chartType: "overlay",
  },
  {
    key: "headShoulders",
    label: "Head & Shoulders",
    category: "patterns",
    chartType: "overlay",
  },
  { key: "cupHandle", label: "Cup with Handle", category: "patterns", chartType: "overlay" },
  { key: "fractals", label: "Fractals", category: "patterns", chartType: "overlay" },
  { key: "zigzag", label: "Zigzag", category: "patterns", chartType: "overlay" },
];

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  trend: "Trend",
  volatility: "Volatility",
  momentum: "Momentum",
  volume: "Volume",
  price: "Price",
  filter: "Filter",
  smc: "SMC",
  patterns: "Patterns",
};

// Category order
export const CATEGORY_ORDER: IndicatorCategory[] = [
  "trend",
  "volatility",
  "momentum",
  "volume",
  "price",
  "filter",
  "smc",
  "patterns",
];

// Helper functions
export function getIndicatorsByCategory(category: IndicatorCategory): IndicatorDefinition[] {
  return INDICATOR_DEFINITIONS.filter((ind) => ind.category === category);
}

export function getIndicatorDefinition(key: string): IndicatorDefinition | undefined {
  return INDICATOR_DEFINITIONS.find((ind) => ind.key === key);
}
