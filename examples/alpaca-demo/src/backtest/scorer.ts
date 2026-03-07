/**
 * Composite scoring for backtest results
 *
 * Combines multiple metrics into a single ranking score.
 * Includes optional Monte Carlo penalty for statistical robustness.
 */

import type { BacktestResult } from "trendcraft";
import type { MonteCarloSummary } from "./runner.js";

export type ScoreWeights = {
  sharpe: number;
  winRate: number;
  drawdown: number;
  profitFactor: number;
  returnPercent: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  sharpe: 0.3,
  winRate: 0.15,
  drawdown: 0.2,
  profitFactor: 0.2,
  returnPercent: 0.15,
};

export type ScoredResult = {
  strategyId: string;
  symbol: string;
  score: number;
  result: BacktestResult;
  breakdown: {
    sharpe: number;
    winRate: number;
    drawdown: number;
    profitFactor: number;
    returnPercent: number;
  };
  monteCarlo?: MonteCarloSummary;
};

/**
 * Calculate composite score for a backtest result
 *
 * Each metric is normalized to a 0-100 scale, then weighted.
 * Optional Monte Carlo penalty reduces score if 5th percentile return is negative.
 */
export function scoreResult(
  strategyId: string,
  symbol: string,
  result: BacktestResult,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  monteCarlo?: MonteCarloSummary,
): ScoredResult {
  // Normalize Sharpe: 0 = 0, 2+ = 100
  const sharpeNorm = Math.min(Math.max(result.sharpeRatio, 0) / 2, 1) * 100;

  // Win rate is already 0-100
  const winRateNorm = Math.min(result.winRate, 100);

  // Drawdown: 0% = 100, 50%+ = 0 (inverse scale)
  const drawdownNorm = Math.max(0, 1 - result.maxDrawdown / 50) * 100;

  // Profit factor: 0 = 0, 3+ = 100
  const pfNorm =
    Math.min(
      Math.max(result.profitFactor === Number.POSITIVE_INFINITY ? 3 : result.profitFactor, 0) / 3,
      1,
    ) * 100;

  // Return percent: -50% = 0, +100%+ = 100
  const retNorm = Math.min(Math.max((result.totalReturnPercent + 50) / 150, 0), 1) * 100;

  const breakdown = {
    sharpe: sharpeNorm,
    winRate: winRateNorm,
    drawdown: drawdownNorm,
    profitFactor: pfNorm,
    returnPercent: retNorm,
  };

  let score =
    breakdown.sharpe * weights.sharpe +
    breakdown.winRate * weights.winRate +
    breakdown.drawdown * weights.drawdown +
    breakdown.profitFactor * weights.profitFactor +
    breakdown.returnPercent * weights.returnPercent;

  // Monte Carlo penalty: if 5th percentile return is negative, reduce score
  if (monteCarlo && monteCarlo.percentile5Return < 0) {
    const penalty = Math.min(Math.abs(monteCarlo.percentile5Return) / 10, 0.3);
    score *= 1 - penalty;
  }

  return { strategyId, symbol, score, result, breakdown, monteCarlo };
}
