/**
 * Portfolio / Multi-Asset Backtest type definitions
 */

import type { BacktestOptions, BacktestResult, Trade } from "./backtest";
import type { NormalizedCandle } from "./candle";
import type { PositionSizingMethod } from "./volume-risk";

// ============================================
// Batch Backtest Types (Phase 1: Independent per-symbol)
// ============================================

/**
 * Input dataset for a single symbol in batch/portfolio backtests
 */
export type SymbolData = {
  /** Ticker symbol (e.g., "AAPL", "7203.T") */
  symbol: string;
  /** Normalized candle data */
  candles: NormalizedCandle[];
};

/**
 * Per-symbol result in a batch backtest
 */
export type SymbolBacktestResult = {
  /** Ticker symbol */
  symbol: string;
  /** Individual backtest result */
  result: BacktestResult;
};

/**
 * Equity curve data point (time → portfolio equity)
 */
export type EquityPoint = {
  /** Timestamp (epoch ms) */
  time: number;
  /** Portfolio equity value */
  equity: number;
};

/**
 * Options for batch backtest
 */
export type BatchBacktestOptions = Omit<BacktestOptions, "capital"> & {
  /** Total capital to distribute equally across symbols (default: equal split) */
  capital: number;
  /**
   * Capital allocation mode
   * - "equal": Split capital equally across all symbols (default)
   * - "custom": Use `allocations` map for per-symbol weights
   */
  allocation?: "equal" | "custom";
  /**
   * Per-symbol allocation weights (0-1, must sum to 1.0).
   * Only used when `allocation` is "custom".
   *
   * @example
   * ```ts
   * allocations: { AAPL: 0.4, MSFT: 0.3, GOOG: 0.3 }
   * ```
   */
  allocations?: Record<string, number>;
};

/**
 * Aggregated portfolio metrics across all symbols
 */
export type PortfolioMetrics = {
  /** Total initial capital */
  initialCapital: number;
  /** Total final capital (sum of all symbol finals) */
  finalCapital: number;
  /** Portfolio total return amount */
  totalReturn: number;
  /** Portfolio total return percentage */
  totalReturnPercent: number;
  /** Total number of trades across all symbols */
  tradeCount: number;
  /** Portfolio-level win rate */
  winRate: number;
  /** Portfolio-level maximum drawdown (from merged equity curve) */
  maxDrawdown: number;
  /** Portfolio-level Sharpe ratio */
  sharpeRatio: number;
  /** Portfolio-level profit factor */
  profitFactor: number;
  /** Average holding days across all trades */
  avgHoldingDays: number;
};

/**
 * Result of a batch backtest (independent per-symbol backtests merged)
 */
export type BatchBacktestResult = {
  /** Per-symbol results */
  symbols: SymbolBacktestResult[];
  /** Aggregated portfolio metrics */
  portfolio: PortfolioMetrics;
  /** Merged equity curve (time-ordered) */
  equityCurve: EquityPoint[];
  /** All trades across all symbols, sorted by entry time */
  allTrades: (Trade & { symbol: string })[];
};

// ============================================
// Portfolio Backtest Types (Phase 2: Shared capital)
// ============================================

/**
 * Allocation strategy for portfolio-level backtesting
 */
export type AllocationStrategy =
  | { type: "equal" }
  | { type: "fixed"; weights: Record<string, number> }
  | { type: "riskParity"; riskBudget?: number };

/**
 * Rebalance configuration
 */
export type RebalanceConfig = {
  /**
   * Rebalance frequency
   * - "monthly": Rebalance on first trading day of each month
   * - "quarterly": Rebalance every 3 months
   * - "threshold": Rebalance when drift exceeds threshold
   */
  frequency: "monthly" | "quarterly" | "threshold";
  /** Drift threshold in percent to trigger rebalance (only for "threshold" mode) */
  driftThreshold?: number;
};

/**
 * Options for portfolio-level backtest with shared capital
 */
export type PortfolioBacktestOptions = {
  /** Total portfolio capital */
  capital: number;
  /** Allocation strategy */
  allocation: AllocationStrategy;
  /** Maximum concurrent positions (default: number of symbols) */
  maxPositions?: number;
  /** Maximum per-symbol exposure in percent (default: 100 / numSymbols) */
  maxSymbolExposure?: number;
  /** Maximum portfolio drawdown before halting (in percent) */
  maxPortfolioDrawdown?: number;
  /** Rebalance configuration (optional) */
  rebalance?: RebalanceConfig;
  /** Per-trade backtest options (SL, TP, trailing, commissions, etc.) */
  tradeOptions?: Omit<BacktestOptions, "capital">;
  /** Position sizing method to use */
  positionSizing?: PositionSizingMethod;
};

/**
 * Result of a portfolio-level backtest with shared capital
 */
export type PortfolioBacktestResult = {
  /** Per-symbol results */
  symbols: SymbolBacktestResult[];
  /** Aggregated portfolio metrics */
  portfolio: PortfolioMetrics;
  /** Merged equity curve (time-ordered) */
  equityCurve: EquityPoint[];
  /** All trades across all symbols, sorted by entry time */
  allTrades: (Trade & { symbol: string })[];
  /** Number of times rebalance occurred */
  rebalanceCount: number;
  /** Peak concurrent positions held */
  peakConcurrentPositions: number;
};
