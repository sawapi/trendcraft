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
 * Input dataset for a single symbol in batch/portfolio backtests.
 *
 * A symbol may appear at most once in a dataset list — capital allocation and
 * the merged equity curve are keyed by it. `batchBacktest` and
 * `portfolioBacktest` throw on a repeated symbol.
 */
export type SymbolData = {
  /** Ticker symbol (e.g., "AAPL", "7203.T") — unique within a dataset list */
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
export type BatchBacktestOptions = Omit<BacktestOptions, "capital" | "warmupBars"> & {
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
   * const options: BatchBacktestOptions = {
   *   capital: 3_000_000,
   *   allocation: "custom",
   *   allocations: { AAPL: 0.4, MSFT: 0.3, GOOG: 0.3 },
   * };
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
  /**
   * Total final capital: every symbol's final capital, plus any capital
   * `maxSymbolExposure` kept out of the market and held as portfolio cash.
   */
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
  /** Portfolio-level profit factor (`Infinity` when no trade lost; see `BacktestResult.profitFactor`) */
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
 * Options for portfolio-level backtest with shared capital
 */
export type PortfolioBacktestOptions = {
  /** Total portfolio capital */
  capital: number;
  /** Allocation strategy */
  allocation: AllocationStrategy;
  /**
   * Maximum concurrent positions. Not supported yet: symbols are backtested
   * independently, so `portfolioBacktest` throws when this is set. Read
   * `peakConcurrentPositions` for the number actually held.
   */
  maxPositions?: number;
  /**
   * Maximum per-symbol exposure in percent of total capital (default: 100,
   * i.e. no cap). When this binds, the symbol is started with less capital
   * than its allocation weight asks for and the difference is held as
   * portfolio cash — it stays in the equity curve and in `finalCapital`.
   */
  maxSymbolExposure?: number;
  /**
   * Maximum portfolio drawdown in percent. Not supported yet: the backtest
   * always runs to completion, so `portfolioBacktest` throws when this is set.
   * Read `portfolio.maxDrawdown` instead. (The same-named option on the live
   * `PortfolioGuardOptions` is enforced — this one is the backtest's.)
   */
  maxPortfolioDrawdown?: number;
  /** Per-trade backtest options (SL, TP, trailing, commissions, sizing, etc.) */
  tradeOptions?: Omit<BacktestOptions, "capital" | "warmupBars">;
  /**
   * @deprecated Was never wired into the engine. Use `tradeOptions.sizing`
   * (a `BacktestSizingConfig`), which flows into every per-symbol backtest.
   */
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
  /**
   * Most positions held at once across all symbols. Fills on the same bar
   * are ordered by when in the bar they happen (open, during the bar, close).
   * Where two fill during the bar, the entry counts first, so the figure errs
   * high. A partially closed position still counts once.
   */
  peakConcurrentPositions: number;
};
