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

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
 * Span info used for time-based metrics (CAGR, exposure). Engines that
 * have access to the candle array pass `firstTime` / `lastTime` directly
 * to avoid the inaccuracy of inferring the backtest window from trade
 * timestamps (which would exclude pre-first-trade warmup time).
 */
export type BacktestSpanInfo = {
  firstTime: number;
  lastTime: number;
};

/**
 * Calculate backtest statistics
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
    return emptyResult(initialCapital, settings);
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

  // Sharpe ratio: annualized mean-return / stddev. Mirrors the daily
  // assumption Sortino uses below (sqrt(252) trading days per year).
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length,
  );
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  // Sortino ratio: like Sharpe but only penalizes downside deviation.
  // Standard convention is target return = 0; downside-only squared
  // deviation is computed over `min(0, r)` so upside doesn't inflate
  // the denominator. When no negative returns exist, Sortino is `0`
  // (signal that the metric isn't meaningful here) — mirrors how
  // Sharpe handles `stdReturn === 0`.
  const downsideSqSum = returns.reduce((sum, r) => sum + (r < 0 ? r * r : 0), 0);
  const downsideStd = Math.sqrt(downsideSqSum / returns.length);
  const sortinoRatio = downsideStd > 0 ? (avgReturn / downsideStd) * Math.sqrt(252) : 0;

  // Per-trade % stats. `returnPercent` is already in percent units
  // (e.g. 2.5 means +2.5%). Average loss / largest loss are reported
  // as positive numbers ("how much did the average / worst loser
  // lose") so they read naturally in UI side-by-side with wins.
  const avgWinPercent =
    winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + t.returnPercent, 0) / winningTrades.length
      : 0;
  const avgLossPercent =
    losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((s, t) => s + t.returnPercent, 0) / losingTrades.length)
      : 0;
  const largestWinPercent =
    winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.returnPercent)) : 0;
  const largestLossPercent =
    losingTrades.length > 0 ? Math.abs(Math.min(...losingTrades.map((t) => t.returnPercent))) : 0;

  // Expectancy: average `returnPercent` across all trades. Equivalent
  // to `(winRate × avgWin) − (lossRate × avgLoss)` — the win/loss form
  // is intuitive but the raw mean is the canonical definition.
  const expectancyPercent = trades.reduce((s, t) => s + t.returnPercent, 0) / trades.length;

  // Time-based metrics. `span` is optional so callers that don't have
  // candle access (none in core today, but external users wrapping
  // `calculateStats` may not) still get a valid result with these
  // metrics zeroed. Engines that have candles pass it and get
  // accurate CAGR / exposure.
  let cagrPercent = 0;
  let exposurePercent = 0;
  if (span && span.lastTime > span.firstTime) {
    const spanDays = (span.lastTime - span.firstTime) / MS_PER_DAY;
    if (spanDays > 0) {
      // Exposure: time in market vs total backtest span. `holdingDays`
      // is per-trade and additive (partial exits are recorded as
      // separate trades with their own holding window).
      const holdingDaysSum = trades.reduce((s, t) => s + t.holdingDays, 0);
      exposurePercent = Math.min(100, (holdingDaysSum / spanDays) * 100);
      // CAGR: only meaningful when there's a return and positive span.
      // `(final/initial)^(365.25/spanDays) − 1` annualizes the geometric
      // return; capped against negative or zero finalCapital.
      const years = spanDays / 365.25;
      if (years > 0 && finalCapital > 0 && initialCapital > 0) {
        cagrPercent = ((finalCapital / initialCapital) ** (1 / years) - 1) * 100;
      }
    }
  }

  // Calmar: CAGR / maxDrawdown. Industry-standard "return per unit of
  // pain". When max drawdown is zero (no drawdown observed) the ratio
  // is undefined; report `0` so the result stays JSON-serializable.
  const calmarRatio = maxDrawdown > 0 ? cagrPercent / maxDrawdown : 0;

  return {
    initialCapital,
    finalCapital: Math.round(finalCapital * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
    tradeCount: trades.length,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    cagrPercent: Math.round(cagrPercent * 100) / 100,
    expectancyPercent: Math.round(expectancyPercent * 100) / 100,
    exposurePercent: Math.round(exposurePercent * 100) / 100,
    avgWinPercent: Math.round(avgWinPercent * 100) / 100,
    avgLossPercent: Math.round(avgLossPercent * 100) / 100,
    largestWinPercent: Math.round(largestWinPercent * 100) / 100,
    largestLossPercent: Math.round(largestLossPercent * 100) / 100,
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
export function emptyResult(capital: number, settings: BacktestSettings): BacktestResult {
  return {
    initialCapital: capital,
    finalCapital: capital,
    totalReturn: 0,
    totalReturnPercent: 0,
    tradeCount: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    cagrPercent: 0,
    expectancyPercent: 0,
    exposurePercent: 0,
    avgWinPercent: 0,
    avgLossPercent: 0,
    largestWinPercent: 0,
    largestLossPercent: 0,
    profitFactor: 0,
    avgHoldingDays: 0,
    trades: [],
    settings,
    drawdownPeriods: [],
  };
}
