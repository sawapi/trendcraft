/**
 * Optimization Metrics
 *
 * Functions for calculating advanced performance metrics for backtest optimization.
 */

import type { BacktestResult, NormalizedCandle, PositionDirection } from "../types";
import type { OptimizationMetric } from "../types/optimization";

/**
 * Calculate Sharpe Ratio from returns series
 * @param returns Array of periodic returns (e.g., daily returns)
 * @param riskFreeRate Annual risk-free rate (default: 0)
 * @param periodsPerYear Number of periods per year (default: 252 for daily)
 * @returns Annualized Sharpe Ratio
 * @example
 * ```ts
 * import { calculateSharpeRatio } from "trendcraft";
 *
 * const dailyReturns = [0.01, -0.005, 0.008, 0.003, -0.002];
 * const sharpe = calculateSharpeRatio(dailyReturns, 0.02); // risk-free = 2%
 * console.log(sharpe); // e.g. 1.52
 * ```
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate = 0,
  periodsPerYear = 252,
): number {
  if (returns.length === 0) return 0;

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
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
 *
 * Returns `NaN` when `maxDrawdownPercent <= 0` (i.e. there is no
 * meaningful denominator). Matches the empyrical / pyfolio convention
 * — a flat strategy with no observed drawdown does not have a defined
 * Calmar ratio. Downstream consumers (gridSearch, walkforward) filter
 * `Number.isFinite` to keep NaN strategies out of ranking.
 *
 * @param annualizedReturnPercent Annualized return in percent
 * @param maxDrawdownPercent Maximum drawdown in percent (positive number)
 * @returns Calmar Ratio, or `NaN` when undefined
 */
export function calculateCalmarRatio(
  annualizedReturnPercent: number,
  maxDrawdownPercent: number,
): number {
  if (!(maxDrawdownPercent > 0)) return Number.NaN;
  return annualizedReturnPercent / maxDrawdownPercent;
}

/**
 * Calculate Recovery Factor (net profit / max drawdown)
 *
 * Returns `NaN` when `maxDrawdown <= 0`. See `calculateCalmarRatio`
 * for rationale.
 *
 * @param netProfit Total net profit
 * @param maxDrawdown Maximum drawdown in absolute terms (positive number)
 * @returns Recovery Factor, or `NaN` when undefined
 */
export function calculateRecoveryFactor(netProfit: number, maxDrawdown: number): number {
  if (!(maxDrawdown > 0)) return Number.NaN;
  return netProfit / maxDrawdown;
}

/**
 * Calculate MAR Ratio (annualized return / max drawdown).
 *
 * This used to divide the arithmetic average *monthly* return by max
 * drawdown, which is roughly a twelfth of the ratio the name denotes — a
 * strategy screened against the usual "MAR above 0.5" kind of threshold was
 * being judged on a number an order of magnitude too small, and because the
 * monthly form is not a monotone rescaling of the annualized one, it could
 * also rank two strategies in the opposite order.
 *
 * Returns `NaN` when the ratio is undefined (no drawdown or no
 * trading days). See `calculateCalmarRatio` for rationale.
 *
 * @param totalReturnPercent Total return in percent
 * @param tradingDays Number of trading days
 * @param maxDrawdownPercent Maximum drawdown in percent (positive number)
 * @param tradingDaysPerYear Trading days per year (default: 252)
 * @returns MAR Ratio, or `NaN` when undefined
 */
export function calculateMAR(
  totalReturnPercent: number,
  tradingDays: number,
  maxDrawdownPercent: number,
  tradingDaysPerYear = 252,
): number {
  if (!(maxDrawdownPercent > 0)) return Number.NaN;
  if (tradingDays <= 0) return Number.NaN;

  return calculateCalmarRatio(
    annualizeReturn(totalReturnPercent, tradingDays, tradingDaysPerYear),
    maxDrawdownPercent,
  );
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
  tradingDaysPerYear = 252,
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

  const annualizedDecimal = (1 + totalReturn) ** (1 / years) - 1;
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

  // Prefer the engine's faithful mark-to-market equity curve when present: it
  // already accounts for trade direction, partial exits and margin, none of
  // which the from-trades reconstruction below can recover. Fall back to that
  // reconstruction only for hand-built results that omit the curve.
  const curve = result.equityCurve;
  if (curve && curve.length === candles.length) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      dailyReturns.push(curve[i - 1] > 0 ? (curve[i] - curve[i - 1]) / curve[i - 1] : 0);
    }
    return dailyReturns;
  }

  if (result.trades.length === 0) return [];

  // Build equity curve
  const equity: number[] = new Array(candles.length).fill(initialCapital);
  let currentEquity = initialCapital;
  let positionValue = 0;
  let entryPrice = 0;
  let positionDirection: PositionDirection = "long";
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
      positionDirection = trade.direction ?? "long";
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

      // Mark-to-market if still in position. A short position gains as price
      // falls, so the unrealized return is the price move signed by direction.
      if (inPosition && entryPrice > 0) {
        const priceReturn = (candle.close - entryPrice) / entryPrice;
        const unrealizedReturn = positionDirection === "short" ? -priceReturn : priceReturn;
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
 * @example
 * ```ts
 * import { runBacktest, calculateAllMetrics, goldenCrossCondition, deadCrossCondition } from "trendcraft";
 *
 * const result = runBacktest(candles, goldenCrossCondition(), deadCrossCondition(), {
 *   capital: 1_000_000,
 * });
 * const metrics = calculateAllMetrics(result, candles, { initialCapital: 1_000_000 });
 * console.log(metrics.sharpe, metrics.calmar, metrics.profitFactor);
 * ```
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

  // Calculate MAR (annualized return / max DD — same ratio as calmar when,
  // as here, both are taken over the full result window)
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
