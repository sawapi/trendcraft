/**
 * Backtest and Multi-Timeframe (MTF) type definitions for TrendCraft
 */

import type { MarginConfig } from "../backtest/margin";
import type { OrderType, TimeInForce } from "../backtest/order-types";
import type { SlippageModel } from "../backtest/slippage-model";
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
  | "marginCall" // Margin call forced liquidation
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
 * Context passed to a custom position sizing callback (`sizing.method: "custom"`).
 *
 * Mirrors the conventions of the built-in methods: `equity` is the current
 * cash equity (compounding basis), `proposedShares` is what a full-capital
 * entry would buy, and `closedTrades` enables rolling statistics (win rate,
 * payoff ratio) for Kelly-style sizing from the backtest's own history.
 */
export type BacktestSizingContext = {
  /** Current cash equity before the entry (compounding basis) */
  equity: number;
  /** Slippage-adjusted entry price */
  entryPrice: number;
  /** Shares a full-capital entry would buy after commission (the engine's default policy) */
  proposedShares: number;
  /** Position direction for this backtest */
  direction: PositionDirection;
  /** ATR(14) value at the entry bar, or null during warmup */
  atr: number | null;
  /** Entry bar candle */
  candle: NormalizedCandle;
  /** Entry bar index */
  index: number;
  /**
   * Trades closed so far in this backtest run. A live view of the trade
   * log — read it synchronously inside the callback (it keeps growing as
   * the backtest proceeds).
   */
  closedTrades: readonly Trade[];
};

/**
 * Position sizing configuration for `runBacktest`.
 *
 * Mirrors the streaming `PositionSizingConfig` (createManagedSession) so a
 * strategy sizes identically in backtest and live contexts. All sized
 * methods compute on current cash equity (compounding) and the result is
 * clamped to available buying power; shares stay fractional, matching the
 * engine's share convention. Default (no `sizing`): `full-capital`.
 *
 * - `full-capital`: deploy all available capital per entry (legacy behavior)
 * - `fixed-fractional`: deploy a fixed percentage of current equity
 * - `risk-based`: risk `riskPercent` of equity against the configured stop
 *   (`stopLoss` percent, or `atrRisk.atrStopMultiplier` when set). Falls back
 *   to full-capital when no stop is configured, like the streaming manager.
 * - `atr-based`: risk `riskPercent` of equity against an ATR-derived stop
 *   distance (`atrValue × atrMultiplier`). Entries are skipped while ATR is
 *   still warming up.
 * - `kelly`: Kelly criterion with user-supplied statistics. Entries are
 *   skipped when the Kelly fraction is zero or negative (no edge).
 * - `custom`: per-entry callback returning the number of shares; return 0
 *   (or a non-finite value) to skip the entry.
 */
export type BacktestSizingConfig =
  | { method: "full-capital" }
  | { method: "fixed-fractional"; fractionPercent: number }
  | { method: "risk-based"; riskPercent: number }
  | {
      method: "atr-based";
      riskPercent: number;
      /** ATR multiplier for the implied stop distance (default: 2) */
      atrMultiplier?: number;
      /** ATR period used for sizing (default: 14) */
      atrPeriod?: number;
    }
  | {
      method: "kelly";
      /** Historical win rate (0-1) */
      winRate: number;
      /** Average win/loss ratio (avgWin / avgLoss) */
      winLossRatio: number;
      /** Kelly fraction to use (default: 0.5 = half-Kelly) */
      kellyFraction?: number;
      /** Maximum Kelly percentage allowed (default: 25) */
      maxKellyPercent?: number;
    }
  | { method: "custom"; calculate: (ctx: BacktestSizingContext) => number };

/**
 * JSON-serializable subset of {@link BacktestSizingConfig} (excludes the
 * `custom` callback variant). Used by the strategy JSON schema.
 */
export type BacktestSizingConfigJSON = Exclude<BacktestSizingConfig, { method: "custom" }>;

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
  /** Dynamic slippage model (overrides fixed `slippage` when provided) */
  slippageModel?: SlippageModel;
  /** Order type for entry execution (default: market) */
  orderType?: OrderType;
  /** Order TTL in bars — pending orders expire after this many bars (default: Infinity). Used with "gtc" TIF. */
  orderTTL?: number;
  /**
   * Time in Force — controls order duration and fill behavior (default: "gtc")
   * - "day": Valid for 1 bar only
   * - "gtc": Good Till Cancel (uses orderTTL, default Infinity)
   * - "ioc": Immediate or Cancel (1 bar, partial fill OK)
   * - "fok": Fill or Kill (1 bar, all-or-nothing — rejects if volume-constrained)
   * - "opg": At the Open (fills at next bar's open regardless of order type)
   * - "cls": At the Close (fills at next bar's close)
   */
  timeInForce?: TimeInForce;
  /** Volume constraint — limit position size to a fraction of bar volume */
  volumeConstraint?: VolumeConstraint;
  /** Margin/leverage configuration */
  margin?: MarginConfig;
  /** Position sizing per entry (default: full-capital, the legacy behavior) */
  sizing?: BacktestSizingConfig;
};

/**
 * Volume constraint for position sizing
 * Limits order size to a percentage of the bar's traded volume
 */
export type VolumeConstraint = {
  /** Maximum percentage of bar volume to consume (e.g., 10 = 10%) */
  maxVolumePercent: number;
  /** If true, partially fill when constrained; if false, cancel the order (default: true) */
  partialFill?: boolean;
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
  /**
   * Sizing config used, when a `sizing` option was provided. Recorded in
   * full so the run is reproducible from the settings snapshot; the custom
   * callback variant is recorded as `{ method: "custom" }` only, since
   * callbacks are not serializable.
   */
  sizing?: BacktestSizingConfigJSON | { method: "custom" };
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
  /**
   * Sortino ratio (annualized). Like Sharpe but divides by *downside*
   * deviation instead of total return std, so upside volatility no
   * longer penalizes the score. `0` when no negative returns exist.
   */
  sortinoRatio: number;
  /**
   * Calmar ratio: annualized return (CAGR) divided by max drawdown.
   * Standard "return per unit of pain" metric. `0` when `maxDrawdown`
   * is zero (no drawdown observed yet).
   */
  calmarRatio: number;
  /**
   * Compound annual growth rate percentage. Computed from the candle
   * span (first to last bar time), so a backtest covering 1.5 years
   * with +50% return reports CAGR ≈ +31%. `0` when fewer than 2
   * candles are passed in.
   */
  cagrPercent: number;
  /**
   * Per-trade expectancy percentage. Equivalent to the average of
   * `trade.returnPercent` across all trades. Positive expectancy = the
   * strategy is profitable per trade on average.
   */
  expectancyPercent: number;
  /**
   * Market exposure percentage: total holding time divided by the
   * candle span. A Sharpe of 2 with 10% exposure is very different
   * from a Sharpe of 2 with 100% exposure; this metric surfaces the
   * difference. `0` when no candle span is available.
   */
  exposurePercent: number;
  /** Average winning trade return percentage (positive value). `0` when no winning trades. */
  avgWinPercent: number;
  /** Average losing trade return percentage (positive value, sign-flipped for display). `0` when no losing trades. */
  avgLossPercent: number;
  /** Largest single-trade winning return percentage. `0` when no winning trades. */
  largestWinPercent: number;
  /** Largest single-trade losing return percentage (positive value, sign-flipped for display). `0` when no losing trades. */
  largestLossPercent: number;
  /**
   * Time of the first candle the backtest ran over (epoch ms). Stored
   * so derived analyses (equity-curve filter, slicing, post-hoc
   * annualization) can recompute time-based metrics like `cagrPercent`
   * and `exposurePercent` without re-supplying the candle window.
   * `0` when no candle span info was provided to `calculateStats`.
   */
  firstBarTime: number;
  /** Time of the last candle the backtest ran over (epoch ms). See `firstBarTime`. */
  lastBarTime: number;
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
