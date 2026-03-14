/**
 * Quick Robustness Score
 *
 * Computes a robustness score from a single BacktestResult without
 * re-running backtests. Uses Monte Carlo trade shuffling, trade
 * consistency analysis, and drawdown resilience.
 */

import { runMonteCarloSimulation } from "../optimization/monte-carlo";
import type { BacktestResult } from "../types";
import type {
  DimensionScore,
  QuickRobustnessOptions,
  QuickRobustnessResult,
} from "../types/robustness";
import { scoreToGrade } from "./grade";

/**
 * Quick robustness assessment from a single backtest result.
 * No re-running of backtests needed — uses Monte Carlo trade shuffling,
 * trade consistency analysis, and drawdown resilience.
 *
 * @param result Backtest result to evaluate
 * @param options Configuration options
 * @returns Quick robustness result with composite score, grade, and recommendations
 *
 * @example
 * ```ts
 * const result = runBacktest(candles, entry, exit, options);
 * const robustness = quickRobustnessScore(result);
 * console.log(`Grade: ${robustness.grade} (${robustness.compositeScore}/100)`);
 * ```
 */
export function quickRobustnessScore(
  result: BacktestResult,
  options: QuickRobustnessOptions = {},
): QuickRobustnessResult {
  const simulations = options.monteCarloSimulations ?? 300;

  // 1. Monte Carlo dimension
  const monteCarlo = scoreMonteCarlo(result, simulations, options.seed);

  // 2. Trade consistency dimension
  const tradeConsistency = scoreTradeConsistency(result);

  // 3. Drawdown resilience dimension
  const drawdownResilience = scoreDrawdownResilience(result);

  // Composite score (weighted average)
  const weights = { mc: 0.4, tc: 0.35, dd: 0.25 };
  const compositeScore =
    monteCarlo.score * weights.mc +
    tradeConsistency.score * weights.tc +
    drawdownResilience.score * weights.dd;

  const grade = scoreToGrade(compositeScore);

  const recommendations = generateRecommendations(monteCarlo, tradeConsistency, drawdownResilience);

  return {
    compositeScore: Math.round(compositeScore * 10) / 10,
    grade,
    dimensions: { monteCarlo, tradeConsistency, drawdownResilience },
    assessment: generateAssessment(grade, compositeScore),
    recommendations,
  };
}

function scoreMonteCarlo(
  result: BacktestResult,
  simulations: number,
  seed?: number,
): DimensionScore {
  if (result.trades.length < 5) {
    return {
      name: "Monte Carlo Survival",
      score: 0,
      weight: 0.4,
      detail: "Too few trades for Monte Carlo analysis",
    };
  }

  try {
    const mc = runMonteCarloSimulation(result, { simulations, seed });

    // Score based on:
    // - p-value of Sharpe (lower = better)
    // - consistency of returns distribution
    const pValueScore = Math.max(0, (1 - mc.pValue.sharpe) * 100);

    // Narrow confidence interval -> more consistent
    const ciWidth = mc.confidenceInterval.returns.upper - mc.confidenceInterval.returns.lower;
    const originalReturn = Math.abs(result.totalReturnPercent);
    const ciScore =
      originalReturn > 0
        ? Math.max(0, Math.min(100, (1 - ciWidth / (originalReturn * 2)) * 100))
        : 50;

    // Worst-case scenario: 5th percentile return
    const worstCaseScore =
      mc.statistics.totalReturnPercent.percentile5 > 0
        ? 100
        : mc.statistics.totalReturnPercent.percentile5 > -10
          ? 60
          : 20;

    const score = pValueScore * 0.4 + ciScore * 0.3 + worstCaseScore * 0.3;

    return {
      name: "Monte Carlo Survival",
      score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
      weight: 0.4,
      detail: `p-value: ${mc.pValue.sharpe.toFixed(3)}, 5th%ile return: ${mc.statistics.totalReturnPercent.percentile5.toFixed(1)}%`,
    };
  } catch {
    return {
      name: "Monte Carlo Survival",
      score: 30,
      weight: 0.4,
      detail: "Monte Carlo simulation failed",
    };
  }
}

function scoreTradeConsistency(result: BacktestResult): DimensionScore {
  const trades = result.trades;
  if (trades.length < 5) {
    return {
      name: "Trade Consistency",
      score: 0,
      weight: 0.35,
      detail: "Too few trades",
    };
  }

  // Win rate component (50% = 0, 65%+ = 100)
  const winRateScore = Math.max(0, Math.min(100, ((result.winRate - 50) / 15) * 100));

  // Profit factor component (1.0 = 0, 2.0+ = 100)
  const pfScore = Math.max(0, Math.min(100, (result.profitFactor - 1.0) * 100));

  // Return consistency (low std dev of trade returns)
  const returns = trades.map((t) => t.returnPercent);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length);
  const cv = mean !== 0 ? Math.abs(stdDev / mean) : 10;
  const consistencyScore = Math.max(0, Math.min(100, ((3 - cv) / 3) * 100));

  // Streak analysis (avoid long losing streaks)
  let maxLosStreak = 0;
  let curStreak = 0;
  for (const t of trades) {
    if (t.returnPercent < 0) {
      curStreak++;
      maxLosStreak = Math.max(maxLosStreak, curStreak);
    } else {
      curStreak = 0;
    }
  }
  const streakScore = Math.max(0, Math.min(100, ((10 - maxLosStreak) / 10) * 100));

  const score = winRateScore * 0.3 + pfScore * 0.3 + consistencyScore * 0.2 + streakScore * 0.2;

  return {
    name: "Trade Consistency",
    score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
    weight: 0.35,
    detail: `Win: ${result.winRate.toFixed(1)}%, PF: ${result.profitFactor.toFixed(2)}, MaxLosStreak: ${maxLosStreak}`,
  };
}

function scoreDrawdownResilience(result: BacktestResult): DimensionScore {
  // Max drawdown component (0% = 100, 30%+ = 0)
  const ddScore = Math.max(0, Math.min(100, ((30 - result.maxDrawdown) / 30) * 100));

  // Recovery factor (totalReturn / maxDrawdown)
  const recoveryFactor =
    result.maxDrawdown > 0
      ? result.totalReturnPercent / result.maxDrawdown
      : result.totalReturnPercent > 0
        ? 10
        : 0;
  const recoveryScore = Math.max(0, Math.min(100, recoveryFactor * 20));

  // Drawdown periods analysis
  const periods = result.drawdownPeriods ?? [];
  const recoveredCount = periods.filter((p) => p.recoveryTime !== undefined).length;
  const recoveryRate = periods.length > 0 ? recoveredCount / periods.length : 1;
  const recoveryRateScore = recoveryRate * 100;

  const score = ddScore * 0.4 + recoveryScore * 0.3 + recoveryRateScore * 0.3;

  return {
    name: "Drawdown Resilience",
    score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
    weight: 0.25,
    detail: `MaxDD: ${result.maxDrawdown.toFixed(1)}%, Recovery Factor: ${recoveryFactor.toFixed(2)}`,
  };
}

function generateAssessment(grade: string, score: number): string {
  if (score >= 80)
    return `Strategy shows strong robustness (${grade}). Results are likely repeatable in live trading.`;
  if (score >= 60)
    return `Strategy shows moderate robustness (${grade}). Consider additional validation before deployment.`;
  if (score >= 40)
    return `Strategy shows marginal robustness (${grade}). High risk of overfitting or curve-fitting.`;
  return `Strategy shows poor robustness (${grade}). Results are likely not repeatable. Re-optimization recommended.`;
}

function generateRecommendations(
  mc: DimensionScore,
  tc: DimensionScore,
  dd: DimensionScore,
): string[] {
  const recs: string[] = [];
  if (mc.score < 50)
    recs.push(
      "Monte Carlo survival is low — strategy may be dependent on trade sequence. Consider adding more filters.",
    );
  if (tc.score < 50)
    recs.push(
      "Trade consistency is poor — consider tightening entry conditions or adding confirmation signals.",
    );
  if (dd.score < 50)
    recs.push(
      "Drawdown resilience is weak — consider adding stop losses, reducing position size, or improving exit timing.",
    );
  if (recs.length === 0)
    recs.push(
      "Strategy passes all robustness checks. Consider walk-forward analysis for additional confidence.",
    );
  return recs;
}
