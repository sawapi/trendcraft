/**
 * Position Manager Type Definitions
 *
 * Types for managed position tracking, P&L calculation,
 * account state management, and position sizing configuration.
 */

import type { ExitReason, NormalizedCandle, PositionDirection, Trade } from "../../types";
import type { IndicatorSnapshot, SessionEvent } from "../types";

// ============================================
// Position & Account State
// ============================================

/**
 * A managed open position with SL/TP/trailing metadata
 *
 * @example
 * ```ts
 * const pos: ManagedPosition = {
 *   id: 'pos-1',
 *   entryTime: Date.now(),
 *   entryPrice: 100,
 *   shares: 50,
 *   originalShares: 50,
 *   stopLossPrice: 98,
 *   takeProfitPrice: 106,
 *   peakPrice: 100,
 *   maxProfitPercent: 0,
 *   maxLossPercent: 0,
 * };
 * ```
 */
export type ManagedPosition = {
  /** Unique position identifier */
  id: string;
  /** Entry time (epoch ms) */
  entryTime: number;
  /** Entry price (after slippage) */
  entryPrice: number;
  /** Current shares held */
  shares: number;
  /** Original shares at entry */
  originalShares: number;
  /** Position direction (default: "long") */
  direction: PositionDirection;
  /** Stop loss price level (null if not set) */
  stopLossPrice: number | null;
  /** Take profit price level (null if not set) */
  takeProfitPrice: number | null;
  /** Peak price since entry (for trailing stop) */
  peakPrice: number;
  /** Trough price since entry (for short trailing stop) */
  troughPrice: number;
  /** Maximum favorable excursion in percent */
  maxProfitPercent: number;
  /** Maximum adverse excursion in percent */
  maxLossPercent: number;
};

/**
 * Account state tracking capital, equity, and drawdown
 *
 * @example
 * ```ts
 * const account: AccountState = {
 *   initialCapital: 1_000_000,
 *   currentCapital: 990_000,
 *   unrealizedPnl: 5000,
 *   equity: 995_000,
 *   peakEquity: 1_000_000,
 *   maxDrawdownPercent: 0.5,
 *   totalRealizedPnl: -10_000,
 * };
 * ```
 */
export type AccountState = {
  /** Starting capital */
  initialCapital: number;
  /** Available capital (not in positions) */
  currentCapital: number;
  /** Unrealized P&L of open position */
  unrealizedPnl: number;
  /** Total equity (currentCapital + unrealizedPnl) */
  equity: number;
  /** Peak equity for drawdown tracking */
  peakEquity: number;
  /** Maximum drawdown percentage from peak */
  maxDrawdownPercent: number;
  /** Total realized P&L across all closed trades */
  totalRealizedPnl: number;
};

/**
 * Record of an order fill (entry or exit)
 */
export type FillRecord = {
  /** Fill time (epoch ms) */
  time: number;
  /** Fill price (after slippage) */
  price: number;
  /** Number of shares filled */
  shares: number;
  /** Order side */
  side: "buy" | "sell";
  /** Reason for the fill */
  reason:
    | "entry"
    | "exit-signal"
    | "stop-loss"
    | "take-profit"
    | "trailing-stop"
    | "force-close"
    | "manual";
};

// ============================================
// Position Sizing Configuration
// ============================================

/**
 * Position sizing configuration for ManagedSession
 *
 * @example
 * ```ts
 * // Risk 1% of account per trade
 * const sizing: PositionSizingConfig = {
 *   method: 'risk-based',
 *   riskPercent: 1,
 * };
 *
 * // ATR-based with 2x multiplier
 * const sizing: PositionSizingConfig = {
 *   method: 'atr-based',
 *   riskPercent: 1,
 *   atrKey: 'atr14',
 *   atrMultiplier: 2,
 * };
 * ```
 */
export type PositionSizingConfig =
  | { method: "fixed-fractional"; fractionPercent: number }
  | { method: "risk-based"; riskPercent: number }
  | { method: "atr-based"; riskPercent: number; atrKey: string; atrMultiplier?: number }
  | { method: "full-capital" };

// ============================================
// Position Manager Options
// ============================================

/**
 * Options for creating a ManagedSession
 *
 * @example
 * ```ts
 * const options: PositionManagerOptions = {
 *   capital: 1_000_000,
 *   sizing: { method: 'risk-based', riskPercent: 1 },
 *   stopLoss: 2,
 *   takeProfit: 6,
 *   trailingStop: 3,
 *   commissionRate: 0.1,
 *   slippage: 0.05,
 * };
 * ```
 */
export type PositionManagerOptions = {
  /** Initial capital */
  capital: number;
  /** Position direction: "long" (default) or "short" */
  direction?: PositionDirection;
  /** Position sizing method (default: full-capital) */
  sizing?: PositionSizingConfig;
  /** Stop loss in percent (e.g., 2 = exit at -2%) */
  stopLoss?: number;
  /** Take profit in percent (e.g., 6 = exit at +6%) */
  takeProfit?: number;
  /** Trailing stop in percent (e.g., 3 = exit if price drops 3% from peak) */
  trailingStop?: number;
  /** Fixed commission per trade in currency (default: 0) */
  commission?: number;
  /** Commission rate in percent (default: 0, e.g., 0.1 = 0.1%) */
  commissionRate?: number;
  /** Tax rate on profits in percent (default: 0) */
  taxRate?: number;
  /** Slippage in percent (default: 0) */
  slippage?: number;
  /** Maximum number of closed trades to keep in memory (default: 1000) */
  maxTradeHistory?: number;
};

// ============================================
// Position Tracker Types
// ============================================

/**
 * Options passed to openPosition
 */
export type OpenPositionOptions = {
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
};

/**
 * Result of updatePrice when SL/TP/trailing is triggered
 */
export type UpdatePriceResult = {
  position: ManagedPosition;
  triggered: FillRecord | null;
};

/**
 * Result of closing a position
 */
export type ClosedTradeResult = {
  trade: Trade;
  fill: FillRecord;
};

/**
 * Serializable state for PositionTracker
 */
export type PositionTrackerState = {
  position: ManagedPosition | null;
  account: AccountState;
  trades: Trade[];
  positionCounter: number;
};

/**
 * Stateful position tracker with SL/TP/trailing management
 */
export type PositionTracker = {
  /** Open a new position */
  openPosition(
    price: number,
    shares: number,
    time: number,
    opts?: OpenPositionOptions,
  ): ManagedPosition;
  /** Update price and check SL/TP/trailing triggers */
  updatePrice(candle: NormalizedCandle): UpdatePriceResult;
  /** Close the current position */
  closePosition(price: number, time: number, reason: FillRecord["reason"]): ClosedTradeResult;
  /** Get the current open position (null if none) */
  getPosition(): ManagedPosition | null;
  /** Get current account state */
  getAccount(): AccountState;
  /** Get all closed trade records */
  getTrades(): Trade[];
  /** Update stop loss price for the current position */
  updateStopLoss(price: number): void;
  /** Update take profit price for the current position */
  updateTakeProfit(price: number): void;
  /** Serialize internal state for persistence */
  getState(): PositionTrackerState;
};

/**
 * Options for creating a PositionTracker
 */
export type PositionTrackerOptions = {
  /** Initial capital */
  capital: number;
  /** Position direction: "long" (default) or "short" */
  direction?: PositionDirection;
  /** Stop loss in percent */
  stopLoss?: number;
  /** Take profit in percent */
  takeProfit?: number;
  /** Trailing stop in percent */
  trailingStop?: number;
  /** Fixed commission per trade */
  commission?: number;
  /** Commission rate in percent */
  commissionRate?: number;
  /** Tax rate on profits in percent */
  taxRate?: number;
  /** Slippage in percent */
  slippage?: number;
  /** Maximum trade history to keep */
  maxTradeHistory?: number;
};

// ============================================
// Managed Session Events
// ============================================

/**
 * Events specific to position management
 */
export type PositionEvent =
  | {
      type: "position-opened";
      position: ManagedPosition;
      fill: FillRecord;
      candle: NormalizedCandle;
    }
  | {
      type: "position-closed";
      trade: Trade;
      fill: FillRecord;
      account: AccountState;
      candle: NormalizedCandle;
    }
  | {
      type: "position-update";
      unrealizedPnl: number;
      equity: number;
      candle: NormalizedCandle;
    };

/**
 * Union of session events and position events
 */
export type ManagedEvent = SessionEvent | PositionEvent;

// ============================================
// Managed Session State
// ============================================

/**
 * Serializable state for ManagedSession
 */
export type ManagedSessionState = {
  guardedState: import("../guards/types").GuardedSessionState;
  trackerState: PositionTrackerState;
};

/**
 * A managed trading session with integrated position tracking
 */
export type ManagedSession = {
  /** Process a trade tick and return events */
  onTrade(trade: import("../types").Trade): ManagedEvent[];
  /** Close session (flushes candle + closes position if open) */
  close(): ManagedEvent[];
  /** Get the current open position (null if none) */
  getPosition(): ManagedPosition | null;
  /** Get current account state */
  getAccount(): AccountState;
  /** Get all closed trade records */
  getTrades(): Trade[];
  /** Manually close the current position */
  closePosition(time: number, price: number): ManagedEvent[];
  /** Update the stop loss price for the current position */
  updateStopLoss(price: number): void;
  /** Update the take profit price for the current position */
  updateTakeProfit(price: number): void;
  /** RiskGuard instance (null if not configured) */
  riskGuard: import("../guards/types").RiskGuard | null;
  /** TimeGuard instance (null if not configured) */
  timeGuard: import("../guards/types").TimeGuard | null;
  /** Serialize full managed session state */
  getState(): ManagedSessionState;
};
