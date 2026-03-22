/**
 * Backtest Scoring
 *
 * Scores backtest results using a weighted composite of key performance metrics.
 * Produces a normalized 0-100 score with per-metric breakdown, enabling
 * comparison across strategies and parameter sets.
 *
 * @example
 * ```ts
 * import { scoreBacktestResult } from "trendcraft";
 *
 * const score = scoreBacktestResult(backtestResult);
 * console.log(`Score: ${score.score}/100`);
 * console.log(`Sharpe contribution: ${score.breakdown.sharpe.normalized}`);
 * ```
 */

import { calculateDailyReturns, calculateSharpeRatio } from "../optimization/metrics";
import type { BacktestResult, NormalizedCandle } from "../types";

/**
 * Per-metric breakdown in a backtest score
 */
export type ScoreBreakdownEntry = {
  /** Raw metric value */
  raw: number;
  /** Normalized value (0-100 scale) */
  normalized: number;
  /** Weight applied to this metric */
  weight: number;
  /** Weighted contribution to final score */
  contribution: number;
};

/**
 * Complete backtest score result
 */
export type BacktestScore = {
  /** Composite score (0-100) */
  score: number;
  /** Per-metric breakdown */
  breakdown: {
    sharpe: ScoreBreakdownEntry;
    winRate: ScoreBreakdownEntry;
    maxDrawdown: ScoreBreakdownEntry;
    profitFactor: ScoreBreakdownEntry;
    totalReturn: ScoreBreakdownEntry;
  };
};

/**
 * Weight configuration for scoring metrics
 */
export type ScoreWeights = {
  /** Sharpe ratio weight (default: 0.30) */
  sharpe?: number;
  /** Win rate weight (default: 0.20) */
  winRate?: number;
  /** Max drawdown weight (default: 0.20) */
  maxDrawdown?: number;
  /** Profit factor weight (default: 0.15) */
  profitFactor?: number;
  /** Total return weight (default: 0.15) */
  totalReturn?: number;
};

/**
 * Options for scoring configuration
 */
export type ScoreOptions = {
  /** Metric weights (auto-normalized to sum to 1) */
  weights?: ScoreWeights;
  /** Candle data for Sharpe calculation (if not provided, uses trade-based Sharpe) */
  candles?: NormalizedCandle[];
  /** Initial capital for Sharpe calculation (default: from BacktestResult) */
  initialCapital?: number;
};

const DEFAULT_WEIGHTS: Required<ScoreWeights> = {
  sharpe: 0.3,
  winRate: 0.2,
  maxDrawdown: 0.2,
  profitFactor: 0.15,
  totalReturn: 0.15,
};

/**
 * Normalize Sharpe ratio to 0-100 scale.
 * 0 -> 0, 1 -> 50, 2 -> 75, 3+ -> ~100
 */
function normalizeSharpe(sharpe: number): number {
  if (sharpe <= 0) return 0;
  // Asymptotic normalization: approaches 100 as sharpe -> infinity
  return Math.min(100, 100 * (1 - 1 / (1 + sharpe)));
}

/**
 * Normalize win rate (0-100%) to 0-100 score.
 * 30% -> low, 50% -> mid, 70%+ -> high
 */
function normalizeWinRate(winRate: number): number {
  if (winRate <= 0) return 0;
  return Math.min(100, winRate);
}

/**
 * Normalize max drawdown to 0-100 score (lower DD = higher score).
 * 0% DD -> 100, 10% -> 70, 30% -> 30, 50%+ -> 0
 */
function normalizeDrawdown(maxDrawdown: number): number {
  if (maxDrawdown <= 0) return 100;
  if (maxDrawdown >= 50) return 0;
  return Math.max(0, 100 - maxDrawdown * 2);
}

/**
 * Normalize profit factor to 0-100 score.
 * 0 -> 0, 1 -> 30, 2 -> 60, 3+ -> ~90-100
 */
function normalizeProfitFactor(pf: number): number {
  if (pf <= 0) return 0;
  if (pf < 1) return pf * 30;
  // Above 1: diminishing returns
  return Math.min(100, 30 + 70 * (1 - 1 / pf));
}

/**
 * Normalize total return percentage to 0-100 score.
 * Negative -> 0, 0% -> 0, 20% -> 40, 50% -> 67, 100%+ -> ~90-100
 */
function normalizeTotalReturn(returnPercent: number): number {
  if (returnPercent <= 0) return 0;
  // Asymptotic: approaches 100
  return Math.min(100, 100 * (1 - 1 / (1 + returnPercent / 50)));
}

function normalizeWeights(weights: ScoreWeights): Required<ScoreWeights> {
  const merged = { ...DEFAULT_WEIGHTS, ...weights };
  const total =
    merged.sharpe + merged.winRate + merged.maxDrawdown + merged.profitFactor + merged.totalReturn;
  if (total === 0) return DEFAULT_WEIGHTS;
  return {
    sharpe: merged.sharpe / total,
    winRate: merged.winRate / total,
    maxDrawdown: merged.maxDrawdown / total,
    profitFactor: merged.profitFactor / total,
    totalReturn: merged.totalReturn / total,
  };
}

/**
 * Score a backtest result using weighted composite metrics.
 *
 * Produces a 0-100 composite score with per-metric breakdown.
 * Each metric is normalized to a 0-100 scale before weighting.
 *
 * @param result - Backtest result to score
 * @param options - Scoring configuration
 * @returns Composite score with breakdown
 *
 * @example
 * ```ts
 * import { runBacktest, scoreBacktestResult, goldenCrossCondition, deadCrossCondition } from "trendcraft";
 *
 * const result = runBacktest(candles, goldenCrossCondition(), deadCrossCondition(), {
 *   capital: 1_000_000,
 * });
 *
 * const score = scoreBacktestResult(result, {
 *   candles,
 *   weights: { sharpe: 0.4, maxDrawdown: 0.3, profitFactor: 0.15, winRate: 0.1, totalReturn: 0.05 },
 * });
 * console.log(`Score: ${score.score.toFixed(1)}/100`);
 * ```
 */
export function scoreBacktestResult(
  result: BacktestResult,
  options: ScoreOptions = {},
): BacktestScore {
  const weights = normalizeWeights(options.weights ?? {});

  // Calculate Sharpe
  let sharpeRaw = result.sharpeRatio;
  if (options.candles && options.candles.length > 0) {
    const initialCapital = options.initialCapital ?? result.initialCapital;
    const dailyReturns = calculateDailyReturns(result, options.candles, initialCapital);
    sharpeRaw = calculateSharpeRatio(dailyReturns);
  }

  const sharpeNorm = normalizeSharpe(sharpeRaw);
  const winRateNorm = normalizeWinRate(result.winRate);
  const ddNorm = normalizeDrawdown(result.maxDrawdown);
  const pfNorm = normalizeProfitFactor(result.profitFactor);
  const retNorm = normalizeTotalReturn(result.totalReturnPercent);

  const breakdown = {
    sharpe: {
      raw: sharpeRaw,
      normalized: sharpeNorm,
      weight: weights.sharpe,
      contribution: sharpeNorm * weights.sharpe,
    },
    winRate: {
      raw: result.winRate,
      normalized: winRateNorm,
      weight: weights.winRate,
      contribution: winRateNorm * weights.winRate,
    },
    maxDrawdown: {
      raw: result.maxDrawdown,
      normalized: ddNorm,
      weight: weights.maxDrawdown,
      contribution: ddNorm * weights.maxDrawdown,
    },
    profitFactor: {
      raw: result.profitFactor,
      normalized: pfNorm,
      weight: weights.profitFactor,
      contribution: pfNorm * weights.profitFactor,
    },
    totalReturn: {
      raw: result.totalReturnPercent,
      normalized: retNorm,
      weight: weights.totalReturn,
      contribution: retNorm * weights.totalReturn,
    },
  };

  const score =
    breakdown.sharpe.contribution +
    breakdown.winRate.contribution +
    breakdown.maxDrawdown.contribution +
    breakdown.profitFactor.contribution +
    breakdown.totalReturn.contribution;

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown,
  };
}
