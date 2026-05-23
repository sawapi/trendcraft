/**
 * Scaled Entry Backtest - Utility Functions
 *
 * Helper functions for the scaled entry backtest engine:
 * statistics calculation, slippage, and standard backtest delegation.
 */

import type {
  BacktestOptions,
  BacktestResult,
  BacktestSettings,
  Condition,
  DrawdownPeriod,
  NormalizedCandle,
  Trade,
} from "../types";
import type { ExtendedCondition } from "./conditions";
import { runBacktest } from "./engine";
import {
  type BacktestSpanInfo,
  computeExtendedMetrics,
  MS_PER_DAY as ENGINE_MS_PER_DAY,
  ZERO_EXTENDED_METRICS,
} from "./engine-utils";

/**
 * Re-export of `engine-utils`'s `MS_PER_DAY` so existing consumers
 * importing from this module still resolve the same constant.
 */
export const MS_PER_DAY = ENGINE_MS_PER_DAY;

/**
 * Standard (non-scaled) backtest - delegates to main engine
 */
export function runStandardBacktest(
  candles: NormalizedCandle[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: BacktestOptions,
): BacktestResult {
  return runBacktest(candles, entryCondition, exitCondition, options);
}

/**
 * Apply slippage to price
 */
export function applySlippage(price: number, slippage: number, direction: "buy" | "sell"): number {
  const slippageMultiplier = slippage / 100;
  if (direction === "buy") {
    return price * (1 + slippageMultiplier);
  }
  return price * (1 - slippageMultiplier);
}

/**
 * Re-export of `BacktestSpanInfo` from `engine-utils`. Some host code
 * imported it from this module before the helper was consolidated;
 * keeping the re-export avoids a breaking import-path change.
 */
export type { BacktestSpanInfo };

/**
 * Calculate backtest statistics.
 *
 * Delegates the new extended metrics (Sortino / Calmar / CAGR /
 * Expectancy / Exposure / per-trade aggregates) to
 * `computeExtendedMetrics` in `engine-utils` so every backtest path
 * shares a single implementation.
 */
export function calculateStats(
  trades: Trade[],
  returns: number[],
  initialCapital: number,
  finalCapital: number,
  maxDrawdown: number,
  settings: BacktestSettings,
  drawdownPeriods: DrawdownPeriod[] = [],
  span?: BacktestSpanInfo,
): BacktestResult {
  if (trades.length === 0) {
    return emptyResult(initialCapital, settings, span);
  }

  const totalReturn = finalCapital - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

  const winningTrades = trades.filter((t) => t.return > 0);
  const losingTrades = trades.filter((t) => t.return <= 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  const totalProfit = winningTrades.reduce((sum, t) => sum + t.return, 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.return, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999.99 : 0;

  const avgHoldingDays = trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length;

  // Sharpe ratio: annualized mean-return / stddev.
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length,
  );
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  const extended = computeExtendedMetrics(
    trades,
    returns,
    initialCapital,
    finalCapital,
    maxDrawdown,
    span,
  );

  return {
    initialCapital,
    finalCapital: Math.round(finalCapital * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
    tradeCount: trades.length,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    ...extended,
    firstBarTime: span?.firstTime ?? 0,
    lastBarTime: span?.lastTime ?? 0,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
    trades,
    settings,
    drawdownPeriods,
  };
}

/**
 * Return empty result for edge cases
 */
export function emptyResult(
  capital: number,
  settings: BacktestSettings,
  span?: BacktestSpanInfo,
): BacktestResult {
  return {
    initialCapital: capital,
    finalCapital: capital,
    totalReturn: 0,
    totalReturnPercent: 0,
    tradeCount: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    ...ZERO_EXTENDED_METRICS,
    firstBarTime: span?.firstTime ?? 0,
    lastBarTime: span?.lastTime ?? 0,
    profitFactor: 0,
    avgHoldingDays: 0,
    trades: [],
    settings,
    drawdownPeriods: [],
  };
}
