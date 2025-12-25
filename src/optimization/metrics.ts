/**
 * Optimization Metrics
 *
 * Functions for calculating advanced performance metrics for backtest optimization.
 */

import type { BacktestResult, NormalizedCandle } from "../types";
import type { OptimizationMetric } from "../types/optimization";

/**
 * Calculate Sharpe Ratio from returns series
 * @param returns Array of periodic returns (e.g., daily returns)
 * @param riskFreeRate Annual risk-free rate (default: 0)
 * @param periodsPerYear Number of periods per year (default: 252 for daily)
 * @returns Annualized Sharpe Ratio
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252,
): number {
  if (returns.length === 0) return 0;

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate standard deviation
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualize
  const annualizedReturn = meanReturn * periodsPerYear;
  const annualizedStdDev = stdDev * Math.sqrt(periodsPerYear);

  // Calculate Sharpe Ratio
  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

/**
 * Calculate Calmar Ratio (annualized return / max drawdown)
 * @param annualizedReturnPercent Annualized return in percent
 * @param maxDrawdownPercent Maximum drawdown in percent
 * @returns Calmar Ratio
 */
export function calculateCalmarRatio(
  annualizedReturnPercent: number,
  maxDrawdownPercent: number,
): number {
  if (maxDrawdownPercent === 0) {
    return annualizedReturnPercent > 0 ? Infinity : 0;
  }
  return annualizedReturnPercent / maxDrawdownPercent;
}

/**
 * Calculate Recovery Factor (net profit / max drawdown)
 * @param netProfit Total net profit
 * @param maxDrawdown Maximum drawdown in absolute terms
 * @returns Recovery Factor
 */
export function calculateRecoveryFactor(netProfit: number, maxDrawdown: number): number {
  if (maxDrawdown === 0) {
    return netProfit > 0 ? Infinity : 0;
  }
  return netProfit / maxDrawdown;
}

/**
 * Calculate MAR Ratio (Monthly Average Return / Max Drawdown)
 * Similar to Calmar but uses monthly returns instead of annualized
 * @param totalReturnPercent Total return in percent
 * @param tradingDays Number of trading days
 * @param maxDrawdownPercent Maximum drawdown in percent
 * @param tradingDaysPerMonth Trading days per month (default: 21)
 * @returns MAR Ratio
 */
export function calculateMAR(
  totalReturnPercent: number,
  tradingDays: number,
  maxDrawdownPercent: number,
  tradingDaysPerMonth: number = 21,
): number {
  if (maxDrawdownPercent === 0) {
    return totalReturnPercent > 0 ? Infinity : 0;
  }
  if (tradingDays <= 0) return 0;

  // Calculate monthly average return
  const months = tradingDays / tradingDaysPerMonth;
  const monthlyAvgReturn = totalReturnPercent / months;

  return monthlyAvgReturn / maxDrawdownPercent;
}

/**
 * Calculate annualized return from total return and time period
 * @param totalReturnPercent Total return in percent
 * @param tradingDays Number of trading days
 * @param tradingDaysPerYear Trading days per year (default: 252)
 * @returns Annualized return in percent
 */
export function annualizeReturn(
  totalReturnPercent: number,
  tradingDays: number,
  tradingDaysPerYear: number = 252,
): number {
  if (tradingDays <= 0) return 0;

  // Convert percent to decimal, compound, then convert back
  const totalReturn = totalReturnPercent / 100;
  const years = tradingDays / tradingDaysPerYear;

  // Handle negative returns (need to use different formula)
  if (totalReturn < -1) {
    // Total loss greater than 100% is not possible in most contexts
    return -100;
  }

  const annualizedDecimal = Math.pow(1 + totalReturn, 1 / years) - 1;
  return annualizedDecimal * 100;
}

/**
 * Calculate trade-by-trade returns from backtest result
 * @param result Backtest result
 * @returns Array of trade returns as decimals
 */
export function extractTradeReturns(result: BacktestResult): number[] {
  return result.trades.map((trade) => trade.returnPercent / 100);
}

/**
 * Calculate daily equity returns from trades and candles
 * @param result Backtest result
 * @param candles Candle data
 * @param initialCapital Initial capital
 * @returns Array of daily returns as decimals
 */
export function calculateDailyReturns(
  result: BacktestResult,
  candles: NormalizedCandle[],
  initialCapital: number,
): number[] {
  if (candles.length < 2) return [];
  if (result.trades.length === 0) return [];

  // Build equity curve
  const equity: number[] = new Array(candles.length).fill(initialCapital);
  let currentEquity = initialCapital;
  let positionValue = 0;
  let entryPrice = 0;
  let inPosition = false;
  let tradeIndex = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const time = candle.time;

    // Check for entry
    while (
      tradeIndex < result.trades.length &&
      result.trades[tradeIndex].entryTime === time &&
      !inPosition
    ) {
      const trade = result.trades[tradeIndex];
      entryPrice = trade.entryPrice;
      positionValue = currentEquity;
      inPosition = true;
      break;
    }

    // Check for exit
    if (inPosition) {
      while (tradeIndex < result.trades.length && result.trades[tradeIndex].exitTime === time) {
        const trade = result.trades[tradeIndex];
        currentEquity += trade.return;
        positionValue = 0;
        inPosition = false;
        tradeIndex++;
        break;
      }

      // Mark-to-market if still in position
      if (inPosition && entryPrice > 0) {
        const unrealizedReturn = (candle.close - entryPrice) / entryPrice;
        equity[i] = positionValue * (1 + unrealizedReturn);
      } else {
        equity[i] = currentEquity;
      }
    } else {
      equity[i] = currentEquity;
    }
  }

  // Calculate daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    if (equity[i - 1] > 0) {
      dailyReturns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    } else {
      dailyReturns.push(0);
    }
  }

  return dailyReturns;
}

/**
 * Calculate all optimization metrics from backtest result
 * @param result Backtest result
 * @param candles Candle data
 * @param options Calculation options
 * @returns Record of all metrics
 */
export function calculateAllMetrics(
  result: BacktestResult,
  candles: NormalizedCandle[],
  options: {
    initialCapital?: number;
    riskFreeRate?: number;
  } = {},
): Record<OptimizationMetric, number> {
  const { initialCapital = 100000, riskFreeRate = 0 } = options;

  // Basic metrics from result
  const winRate = result.winRate;
  const returns = result.totalReturnPercent;
  const profitFactor = result.profitFactor;

  // Calculate trading days
  const tradingDays = candles.length;
  const annualizedReturn = annualizeReturn(returns, tradingDays);

  // Calculate Sharpe from daily returns
  const dailyReturns = calculateDailyReturns(result, candles, initialCapital);
  const sharpe = calculateSharpeRatio(dailyReturns, riskFreeRate);

  // Calculate Calmar (annualized return / max DD)
  const calmar = calculateCalmarRatio(annualizedReturn, result.maxDrawdown);

  // Calculate MAR (monthly avg return / max DD)
  const mar = calculateMAR(returns, tradingDays, result.maxDrawdown);

  // Calculate Recovery Factor (total return / max DD)
  const recoveryFactor = calculateRecoveryFactor(result.totalReturn, result.maxDrawdown);

  return {
    sharpe,
    calmar,
    mar,
    profitFactor,
    recoveryFactor,
    returns,
    winRate,
    tradeCount: result.tradeCount,
    maxDrawdown: result.maxDrawdown,
  };
}

/**
 * Get a specific metric value
 * @param metrics All calculated metrics
 * @param metric Metric to retrieve
 * @returns Metric value
 */
export function getMetricValue(
  metrics: Record<OptimizationMetric, number>,
  metric: OptimizationMetric,
): number {
  return metrics[metric];
}

/**
 * Compare metric value against constraint
 * @param value Metric value
 * @param operator Comparison operator
 * @param threshold Threshold value
 * @returns Whether constraint is satisfied
 */
export function checkConstraint(
  value: number,
  operator: ">" | ">=" | "<" | "<=" | "==",
  threshold: number,
): boolean {
  switch (operator) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case "==":
      return Math.abs(value - threshold) < 0.0001;
    default:
      return false;
  }
}
