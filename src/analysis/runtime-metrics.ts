/**
 * Runtime Performance Metrics
 *
 * Calculates comprehensive performance metrics from trade history,
 * including Sharpe, Sortino, Calmar ratios, drawdown analysis,
 * and equity curve statistics. Suitable for both backtest results
 * and live trading performance monitoring.
 *
 * @example
 * ```ts
 * import { calculateRuntimeMetrics } from "trendcraft";
 *
 * const metrics = calculateRuntimeMetrics(trades, {
 *   initialCapital: 1_000_000,
 *   riskFreeRate: 0.02,
 *   annualizationFactor: 252,
 * });
 * console.log(metrics.sharpeRatio, metrics.sortinoRatio, metrics.maxDrawdownPercent);
 * ```
 */

import type { Trade } from "../types";
import { calculateTradeStats } from "./edge-analysis";
import type { TradeStats } from "./edge-analysis-types";

/**
 * Comprehensive runtime performance metrics
 */
export type RuntimeMetrics = TradeStats & {
  /** Annualized Sharpe ratio (excess return / volatility) */
  sharpeRatio: number;
  /** Annualized Sortino ratio (excess return / downside volatility) */
  sortinoRatio: number;
  /** Calmar ratio (annualized return / max drawdown) */
  calmarRatio: number;
  /** Maximum drawdown in absolute value */
  maxDrawdown: number;
  /** Maximum drawdown as percentage from peak */
  maxDrawdownPercent: number;
  /** Total return in absolute value */
  totalReturn: number;
  /** Total return as percentage */
  totalReturnPercent: number;
  /** Average holding period in days */
  avgHoldingDays: number;
  /** Annualized return percentage */
  annualizedReturnPercent: number;
  /** Recovery factor (total return / max drawdown) */
  recoveryFactor: number;
};

/**
 * Options for runtime metrics calculation
 */
export type RuntimeMetricsOptions = {
  /** Initial capital for equity curve calculation */
  initialCapital?: number;
  /** Annual risk-free rate (default: 0) */
  riskFreeRate?: number;
  /** Number of trading periods per year (default: 252 for daily) */
  annualizationFactor?: number;
};

/**
 * Calculate comprehensive runtime performance metrics from trade history.
 *
 * Combines basic TradeStats with advanced risk-adjusted metrics
 * (Sharpe, Sortino, Calmar) and equity curve analysis (drawdown, returns).
 *
 * @param trades - Array of closed trades
 * @param options - Calculation options
 * @returns Complete runtime metrics
 *
 * @example
 * ```ts
 * import { calculateRuntimeMetrics } from "trendcraft";
 *
 * const metrics = calculateRuntimeMetrics(result.trades, {
 *   initialCapital: 1_000_000,
 * });
 * console.log(`Sharpe: ${metrics.sharpeRatio.toFixed(2)}`);
 * console.log(`Sortino: ${metrics.sortinoRatio.toFixed(2)}`);
 * console.log(`Max DD: ${metrics.maxDrawdownPercent.toFixed(1)}%`);
 * ```
 */
export function calculateRuntimeMetrics(
  trades: Trade[],
  options: RuntimeMetricsOptions = {},
): RuntimeMetrics {
  const { initialCapital = 100_000, riskFreeRate = 0, annualizationFactor = 252 } = options;

  const stats = calculateTradeStats(trades);

  if (trades.length === 0) {
    return {
      ...stats,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      avgHoldingDays: 0,
      annualizedReturnPercent: 0,
      recoveryFactor: 0,
    };
  }

  // Build equity curve from trades
  const tradeReturns = trades.map((t) => t.returnPercent / 100);
  let equity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const t of trades) {
    equity += t.return;
    if (equity > peakEquity) {
      peakEquity = equity;
    }
    const dd = peakEquity - equity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPercent = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
    }
  }

  const totalReturn = equity - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

  // Average holding days
  const totalHoldingDays = trades.reduce((sum, t) => sum + t.holdingDays, 0);
  const avgHoldingDays = totalHoldingDays / trades.length;

  // Estimate trading periods for annualization
  const totalDays =
    trades.length > 1
      ? (trades[trades.length - 1].exitTime - trades[0].entryTime) / (1000 * 60 * 60 * 24)
      : avgHoldingDays * trades.length;
  const years = totalDays > 0 ? totalDays / 365 : 1;

  // Annualized return
  const annualizedReturnPercent =
    years > 0 && totalReturnPercent > -100
      ? ((1 + totalReturnPercent / 100) ** (1 / years) - 1) * 100
      : totalReturnPercent;

  // Sharpe ratio (from trade returns)
  const sharpeRatio = calculateSharpe(tradeReturns, riskFreeRate, annualizationFactor);

  // Sortino ratio (from trade returns)
  const sortinoRatio = calculateSortino(tradeReturns, riskFreeRate, annualizationFactor);

  // Calmar ratio
  const calmarRatio =
    maxDrawdownPercent > 0
      ? annualizedReturnPercent / maxDrawdownPercent
      : annualizedReturnPercent > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  // Recovery factor
  const recoveryFactor =
    maxDrawdown > 0 ? totalReturn / maxDrawdown : totalReturn > 0 ? Number.POSITIVE_INFINITY : 0;

  return {
    ...stats,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown,
    maxDrawdownPercent,
    totalReturn,
    totalReturnPercent,
    avgHoldingDays,
    annualizedReturnPercent,
    recoveryFactor,
  };
}

function calculateSharpe(
  returns: number[],
  riskFreeRate: number,
  annualizationFactor: number,
): number {
  if (returns.length === 0) return 0;

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const annualizedReturn = meanReturn * annualizationFactor;
  const annualizedStdDev = stdDev * Math.sqrt(annualizationFactor);

  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

function calculateSortino(
  returns: number[],
  riskFreeRate: number,
  annualizationFactor: number,
): number {
  if (returns.length === 0) return 0;

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Downside deviation: only negative returns
  const periodicRiskFree = riskFreeRate / annualizationFactor;
  const downsideReturns = returns.filter((r) => r < periodicRiskFree);
  if (downsideReturns.length === 0) {
    return meanReturn > 0 ? Number.POSITIVE_INFINITY : 0;
  }

  const downsideVariance =
    downsideReturns.reduce((sum, r) => sum + (r - periodicRiskFree) ** 2, 0) / returns.length;
  const downsideDev = Math.sqrt(downsideVariance);

  if (downsideDev === 0) return 0;

  const annualizedReturn = meanReturn * annualizationFactor;
  const annualizedDownsideDev = downsideDev * Math.sqrt(annualizationFactor);

  return (annualizedReturn - riskFreeRate) / annualizedDownsideDev;
}
