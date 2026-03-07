/**
 * Composite scoring for backtest results
 *
 * Combines multiple metrics into a single ranking score.
 */

import type { BacktestResult } from "trendcraft";

export type ScoreWeights = {
  sharpe: number;
  winRate: number;
  drawdown: number;
  profitFactor: number;
  returnPercent: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  sharpe: 0.30,
  winRate: 0.15,
  drawdown: 0.20,
  profitFactor: 0.20,
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
};

/**
 * Calculate composite score for a backtest result
 *
 * Each metric is normalized to a 0-100 scale, then weighted.
 */
export function scoreResult(
  strategyId: string,
  symbol: string,
  result: BacktestResult,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ScoredResult {
  // Normalize Sharpe: 0 = 0, 2+ = 100
  const sharpeNorm = Math.min(Math.max(result.sharpeRatio, 0) / 2, 1) * 100;

  // Win rate is already 0-100
  const winRateNorm = Math.min(result.winRate, 100);

  // Drawdown: 0% = 100, 50%+ = 0 (inverse scale)
  const drawdownNorm = Math.max(0, (1 - result.maxDrawdown / 50)) * 100;

  // Profit factor: 0 = 0, 3+ = 100
  const pfNorm =
    Math.min(
      Math.max(result.profitFactor === Infinity ? 3 : result.profitFactor, 0) /
        3,
      1,
    ) * 100;

  // Return percent: -50% = 0, +100%+ = 100
  const retNorm =
    Math.min(Math.max((result.totalReturnPercent + 50) / 150, 0), 1) * 100;

  const breakdown = {
    sharpe: sharpeNorm,
    winRate: winRateNorm,
    drawdown: drawdownNorm,
    profitFactor: pfNorm,
    returnPercent: retNorm,
  };

  const score =
    breakdown.sharpe * weights.sharpe +
    breakdown.winRate * weights.winRate +
    breakdown.drawdown * weights.drawdown +
    breakdown.profitFactor * weights.profitFactor +
    breakdown.returnPercent * weights.returnPercent;

  return { strategyId, symbol, score, result, breakdown };
}
