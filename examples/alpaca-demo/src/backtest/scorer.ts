/**
 * Composite scoring for backtest results
 *
 * Wraps trendcraft's scoreBacktestResult with app-specific weight mapping
 * and Monte Carlo penalty.
 */

import { type BacktestResult, type BacktestScore, scoreBacktestResult } from "trendcraft";
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
  breakdown: BacktestScore["breakdown"];
  monteCarlo?: MonteCarloSummary;
};

/**
 * Calculate composite score for a backtest result
 *
 * Delegates to trendcraft's scoreBacktestResult, then applies
 * app-specific Monte Carlo penalty.
 */
export function scoreResult(
  strategyId: string,
  symbol: string,
  result: BacktestResult,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  monteCarlo?: MonteCarloSummary,
): ScoredResult {
  const btScore = scoreBacktestResult(result, {
    weights: {
      sharpe: weights.sharpe,
      winRate: weights.winRate,
      maxDrawdown: weights.drawdown,
      profitFactor: weights.profitFactor,
      totalReturn: weights.returnPercent,
    },
  });

  let score = btScore.score;

  // Monte Carlo penalty: if 5th percentile return is negative, reduce score
  if (monteCarlo && monteCarlo.percentile5Return < 0) {
    const penalty = Math.min(Math.abs(monteCarlo.percentile5Return) / 10, 0.3);
    score *= 1 - penalty;
  }

  return { strategyId, symbol, score, result, breakdown: btScore.breakdown, monteCarlo };
}
