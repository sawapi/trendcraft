/**
 * Backtest and Multi-Timeframe (MTF) type definitions for TrendCraft
 */

import type { NormalizedCandle, TimeframeShorthand } from "./candle";

/**
 * Position direction for long/short trading
 */
export type PositionDirection = "long" | "short";

// ============================================
// Backtest Types
// ============================================

/**
 * Exit reason for trade analysis
 * Tracks why each trade was closed for performance analysis
 */
export type ExitReason =
  | "signal" // Exit signal condition triggered
  | "stopLoss" // Stop loss (fixed or ATR-based)
  | "takeProfit" // Take profit (fixed or ATR-based)
  | "trailing" // Trailing stop (fixed or ATR-based)
  | "breakeven" // Breakeven stop triggered
  | "scaleOut" // Scale-out partial exit
  | "partialTakeProfit" // Partial take profit exit
  | "timeExit" // Time-based exit (maxHoldDays)
  | "endOfData"; // Position closed at end of backtest data

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
  /** Position direction (default: "long") */
  direction?: PositionDirection;
  /** Whether this is a partial exit (true) or full exit (false/undefined) */
  isPartial?: boolean;
  /** Percentage of original position sold in this trade */
  exitPercent?: number;
  /** Reason why the trade was closed */
  exitReason?: ExitReason;
  /** Maximum Favorable Excursion - highest unrealized profit % during trade */
  mfe?: number;
  /** Maximum Adverse Excursion - largest unrealized loss % during trade */
  mae?: number;
  /** MFE Utilization - actual return / MFE (how much of max profit was captured) */
  mfeUtilization?: number;
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
 * Breakeven stop configuration
 *
 * Moves stop loss to entry price (or slightly above) once position reaches a profit threshold.
 * This "locks in" a no-loss trade after initial profit is achieved.
 *
 * @example
 * ```ts
 * // Move stop to breakeven after +3% gain
 * breakevenStop: { threshold: 3 }
 *
 * // Move stop to +0.5% above entry after +3% gain
 * breakevenStop: { threshold: 3, buffer: 0.5 }
 * ```
 */
export type BreakevenStopConfig = {
  /** Profit threshold in percent to activate breakeven (e.g., 3 = +3%) */
  threshold: number;
  /** Buffer above entry price in percent (default: 0, e.g., 0.5 = stop at +0.5%) */
  buffer?: number;
};

/**
 * Scale-out configuration for partial position exits at multiple profit levels
 *
 * @example
 * ```ts
 * scaleOut: {
 *   levels: [
 *     { threshold: 5, sellPercent: 33 },   // Sell 33% at +5%
 *     { threshold: 10, sellPercent: 50 },  // Sell 50% of remaining at +10%
 *     { threshold: 20, sellPercent: 100 }, // Sell rest at +20%
 *   ]
 * }
 * ```
 */
export type ScaleOutLevel = {
  /** Profit threshold in percent to trigger this level (e.g., 5 = +5%) */
  threshold: number;
  /** Percentage of remaining position to sell (e.g., 33 = sell 33%) */
  sellPercent: number;
};

export type ScaleOutConfig = {
  /** Array of scale-out levels (should be ordered by threshold ascending) */
  levels: ScaleOutLevel[];
};

/**
 * Time-based exit configuration
 *
 * Exits position after holding for a specified number of days.
 * Useful for swing traders who want to avoid being stuck in non-moving positions.
 *
 * @example
 * ```ts
 * // Exit after 20 days regardless of P&L
 * timeExit: { maxHoldDays: 20 }
 *
 * // Exit after 20 days only if P&L is within ±2%
 * timeExit: { maxHoldDays: 20, onlyIfFlat: { threshold: 2 } }
 * ```
 */
export type TimeExitConfig = {
  /** Maximum holding period in days */
  maxHoldDays: number;
  /** Only exit if position is within this P&L range (e.g., threshold: 2 = ±2%) */
  onlyIfFlat?: { threshold: number };
};

/**
 * ATR-based trailing stop configuration
 *
 * Tracks the highest price since entry and exits when price drops
 * by (ATR × multiplier) from that high.
 */
export type AtrTrailingStopConfig = {
  /** ATR multiplier (e.g., 2.0 = exit when price drops 2×ATR from high) */
  multiplier: number;
  /** ATR calculation period (default: 14) */
  period?: number;
};

/**
 * Fill mode for order execution timing
 * - "same-bar-close": Execute at signal bar's close (default, legacy behavior - has look-ahead bias)
 * - "next-bar-open": Execute at next bar's open (realistic, no look-ahead bias)
 */
export type FillMode = "same-bar-close" | "next-bar-open";

/**
 * Stop loss / Take profit evaluation mode
 * - "intraday": Check against high/low within the bar (has look-ahead bias)
 * - "close-only": Check only against close price (no look-ahead bias, default)
 */
export type SlTpMode = "intraday" | "close-only";

/**
 * Backtest options
 */
export type BacktestOptions = {
  /** Initial capital */
  capital: number;
  /** Position direction: "long" (default) or "short" */
  direction?: PositionDirection;
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
  /** ATR-based trailing stop (exits when price drops ATR×multiplier from high since entry) */
  atrTrailingStop?: AtrTrailingStopConfig;
  /** Partial take profit config (sell portion of position at threshold) */
  partialTakeProfit?: PartialTakeProfitConfig;
  /** Tax rate on profits in percent (default: 0, e.g., 20.315 for Japan) */
  taxRate?: number;
  /**
   * Order fill timing mode (default: "next-bar-open")
   * - "same-bar-close": Fill at signal bar's close (legacy, has look-ahead bias)
   * - "next-bar-open": Fill at next bar's open (realistic, recommended)
   */
  fillMode?: FillMode;
  /**
   * Stop loss / Take profit evaluation mode (default: "close-only")
   * - "intraday": Check high/low within bar (has look-ahead bias)
   * - "close-only": Check only close price (conservative, recommended)
   */
  slTpMode?: SlTpMode;
  /** Breakeven stop config (move stop to entry price after reaching profit threshold) */
  breakevenStop?: BreakevenStopConfig;
  /** Scale-out config (staged position reduction at multiple profit levels) */
  scaleOut?: ScaleOutConfig;
  /** Time-based exit config (exit after N days) */
  timeExit?: TimeExitConfig;
};

/**
 * Backtest settings snapshot for reproducibility
 */
export type BacktestSettings = {
  /** Order fill timing mode */
  fillMode: FillMode;
  /** Stop loss / Take profit evaluation mode */
  slTpMode: SlTpMode;
  /** Position direction */
  direction?: PositionDirection;
  /** Stop loss in percent */
  stopLoss?: number;
  /** Take profit in percent */
  takeProfit?: number;
  /** Trailing stop in percent */
  trailingStop?: number;
  /** Slippage in percent */
  slippage: number;
  /** Fixed commission per trade */
  commission: number;
  /** Commission rate in percent */
  commissionRate: number;
  /** Tax rate on profits in percent */
  taxRate: number;
};

/**
 * Backtest result
 */
export type BacktestResult = {
  /** Initial capital */
  initialCapital: number;
  /** Final capital */
  finalCapital: number;
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
  /** Settings used for this backtest (for reproducibility) */
  settings: BacktestSettings;
  /** Individual drawdown periods with peak-trough-recovery tracking */
  drawdownPeriods: DrawdownPeriod[];
};

// ============================================
// Drawdown Period Types
// ============================================

/**
 * A single drawdown period tracking peak-to-trough-to-recovery
 */
export type DrawdownPeriod = {
  /** Timestamp when drawdown started (peak equity) */
  startTime: number;
  /** Peak equity value at start of drawdown */
  peakEquity: number;
  /** Timestamp of maximum drawdown depth */
  troughTime: number;
  /** Equity at maximum drawdown depth */
  troughEquity: number;
  /** Timestamp when equity recovered to peak (undefined if not recovered) */
  recoveryTime?: number;
  /** Maximum drawdown depth in percent */
  maxDepthPercent: number;
  /** Duration of drawdown in bars (from start to recovery or end) */
  durationBars: number;
  /** Bars from trough to recovery (undefined if not recovered) */
  recoveryBars?: number;
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
