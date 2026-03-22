/**
 * Full Strategy Robustness Analysis
 *
 * Comprehensive robustness scoring that evaluates Monte Carlo survival,
 * parameter sensitivity, walk-forward efficiency, and regime consistency.
 * Requires candles, strategy definition, and parameter ranges.
 */

import { gridSearch } from "../optimization/grid-search";
import { runMonteCarloSimulation } from "../optimization/monte-carlo";
import { walkForwardAnalysis } from "../optimization/walkforward";
import type { BacktestOptions, BacktestResult, NormalizedCandle } from "../types";
import type { Condition } from "../types/backtest";
import type { ParameterRange } from "../types/optimization";
import type { DimensionScore, RobustnessOptions, RobustnessResult } from "../types/robustness";
import { scoreToGrade } from "./grade";

function isIntegerRange(range: ParameterRange): boolean {
  return Number.isInteger(range.min) && Number.isInteger(range.max) && Number.isInteger(range.step);
}

function clampToRange(value: number, range: ParameterRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}

/**
 * Full strategy robustness analysis.
 * Requires candles, strategy definition, and parameter ranges for complete analysis.
 *
 * @param candles Normalized candle data
 * @param originalResult Backtest result from the original strategy run
 * @param createStrategy Factory that builds entry/exit conditions from parameters
 * @param parameterRanges Parameter ranges to explore for sensitivity and walk-forward
 * @param options Configuration options
 * @returns Full robustness result with composite score, grade, and per-dimension breakdown
 *
 * @example
 * ```ts
 * const robustness = calculateRobustnessScore(
 *   candles,
 *   result,
 *   (params) => ({
 *     entry: and(rsiBelow(params.rsiThreshold), goldenCrossCondition(params.shortMA, params.longMA)),
 *     exit: rsiAbove(70),
 *     options: { capital: 1_000_000 },
 *   }),
 *   [
 *     { name: "rsiThreshold", min: 20, max: 40, step: 5 },
 *     { name: "shortMA", min: 3, max: 10, step: 1 },
 *     { name: "longMA", min: 20, max: 40, step: 5 },
 *   ],
 * );
 * console.log(`Grade: ${robustness.grade}`);
 * ```
 */
export function calculateRobustnessScore(
  candles: NormalizedCandle[],
  originalResult: BacktestResult,
  createStrategy: (params: Record<string, number>) => {
    entry: Condition;
    exit: Condition;
    options?: BacktestOptions;
  },
  parameterRanges: ParameterRange[],
  options: RobustnessOptions = {},
): RobustnessResult {
  const mcSims = options.monteCarloSimulations ?? 500;
  const wfWindowSize = options.walkForwardWindowSize ?? 252;
  const wfStepSize = options.walkForwardStepSize ?? 63;
  const wfTestSize = options.walkForwardTestSize ?? 63;
  const weights = {
    mc: options.weights?.monteCarlo ?? 0.25,
    ps: options.weights?.parameterSensitivity ?? 0.25,
    wf: options.weights?.walkForward ?? 0.25,
    rc: options.weights?.regimeConsistency ?? 0.25,
  };

  // Normalize weights
  const totalWeight = weights.mc + weights.ps + weights.wf + weights.rc;
  if (totalWeight <= 0) {
    weights.mc = 0.25;
    weights.ps = 0.25;
    weights.wf = 0.25;
    weights.rc = 0.25;
  } else {
    weights.mc /= totalWeight;
    weights.ps /= totalWeight;
    weights.wf /= totalWeight;
    weights.rc /= totalWeight;
  }

  const progress = options.progressCallback;

  // 1. Monte Carlo
  progress?.("Monte Carlo", 0);
  const monteCarlo = scoreMonteCarloDimension(originalResult, mcSims, options.seed);
  progress?.("Monte Carlo", 100);

  // 2. Parameter Sensitivity
  progress?.("Parameter Sensitivity", 0);
  const parameterSensitivity = scoreParameterSensitivity(
    candles,
    createStrategy,
    parameterRanges,
    options,
  );
  progress?.("Parameter Sensitivity", 100);

  // 3. Walk-Forward
  progress?.("Walk-Forward", 0);
  const walkForward = scoreWalkForward(
    candles,
    createStrategy,
    parameterRanges,
    wfWindowSize,
    wfStepSize,
    wfTestSize,
  );
  progress?.("Walk-Forward", 100);

  // 4. Regime Consistency
  progress?.("Regime Consistency", 0);
  const regimeConsistency = scoreRegimeConsistency(originalResult);
  progress?.("Regime Consistency", 100);

  // Composite
  const compositeScore =
    monteCarlo.score * weights.mc +
    parameterSensitivity.score * weights.ps +
    walkForward.score * weights.wf +
    regimeConsistency.score * weights.rc;

  const grade = scoreToGrade(compositeScore);
  const recommendations = generateFullRecommendations(
    monteCarlo,
    parameterSensitivity,
    walkForward,
    regimeConsistency,
  );

  return {
    compositeScore: Math.round(compositeScore * 10) / 10,
    grade,
    dimensions: { monteCarlo, parameterSensitivity, walkForward, regimeConsistency },
    assessment: generateFullAssessment(grade, compositeScore),
    recommendations,
  };
}

function scoreMonteCarloDimension(
  result: BacktestResult,
  sims: number,
  seed?: number,
): DimensionScore {
  if (result.trades.length < 5) {
    return {
      name: "Monte Carlo Survival",
      score: 0,
      weight: 0.25,
      detail: "Too few trades",
    };
  }
  try {
    const mc = runMonteCarloSimulation(result, { simulations: sims, seed });
    const pScore = Math.max(0, (1 - mc.pValue.sharpe) * 100);
    const worstCase =
      mc.statistics.totalReturnPercent.percentile5 > 0
        ? 100
        : mc.statistics.totalReturnPercent.percentile5 > -10
          ? 60
          : 20;
    const score = pScore * 0.6 + worstCase * 0.4;
    return {
      name: "Monte Carlo Survival",
      score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
      weight: 0.25,
      detail: `p=${mc.pValue.sharpe.toFixed(3)}, 5th%ile=${mc.statistics.totalReturnPercent.percentile5.toFixed(1)}%`,
    };
  } catch {
    return {
      name: "Monte Carlo Survival",
      score: 30,
      weight: 0.25,
      detail: "Simulation failed",
    };
  }
}

function scoreParameterSensitivity(
  candles: NormalizedCandle[],
  createStrategy: (params: Record<string, number>) => {
    entry: Condition;
    exit: Condition;
    options?: BacktestOptions;
  },
  ranges: ParameterRange[],
  options: RobustnessOptions,
): DimensionScore {
  try {
    // Create narrow ranges around the midpoint for perturbation analysis
    const perturbPct = (options.perturbationPercent ?? 20) / 100;

    const narrowRanges = ranges.map((r) => {
      const mid = (r.min + r.max) / 2;
      const range = (r.max - r.min) * perturbPct;
      const min = Math.max(r.min, mid - range / 2);
      const max = Math.min(r.max, mid + range / 2);

      if (isIntegerRange(r)) {
        return {
          name: r.name,
          min: clampToRange(Math.round(min), r),
          max: clampToRange(Math.round(max), r),
          step: r.step,
        };
      }

      return {
        name: r.name,
        min,
        max,
        step: r.step,
      };
    });

    const gs = gridSearch(candles, createStrategy, narrowRanges, {
      metric: "sharpe",
    });

    if (gs.results.length < 3) {
      return {
        name: "Parameter Sensitivity",
        score: 50,
        weight: 0.25,
        detail: "Insufficient parameter combinations",
      };
    }

    // Calculate coefficient of variation of Sharpe ratios
    const sharpes = gs.results.map((r) => r.backtest.sharpeRatio);
    const mean = sharpes.reduce((a, b) => a + b, 0) / sharpes.length;
    const stdDev = Math.sqrt(sharpes.reduce((a, v) => a + (v - mean) ** 2, 0) / sharpes.length);
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 10;

    // Low CV = stable parameters = good
    // CV < 0.2 = very stable (100), CV > 1.0 = very sensitive (0)
    const cvScore = Math.max(0, Math.min(100, ((1.0 - cv) / 0.8) * 100));

    // Also check what fraction of parameter combos are profitable
    const profitableCount = gs.results.filter((r) => r.backtest.totalReturnPercent > 0).length;
    const profitableRate = profitableCount / gs.results.length;
    const profitableScore = profitableRate * 100;

    const finalScore = cvScore * 0.6 + profitableScore * 0.4;

    return {
      name: "Parameter Sensitivity",
      score: Math.round(Math.max(0, Math.min(100, finalScore)) * 10) / 10,
      weight: 0.25,
      detail: `CV: ${cv.toFixed(3)}, ${(profitableRate * 100).toFixed(0)}% profitable in neighborhood`,
    };
  } catch {
    return {
      name: "Parameter Sensitivity",
      score: 50,
      weight: 0.25,
      detail: "Analysis failed",
    };
  }
}

function scoreWalkForward(
  candles: NormalizedCandle[],
  createStrategy: (params: Record<string, number>) => {
    entry: Condition;
    exit: Condition;
    options?: BacktestOptions;
  },
  ranges: ParameterRange[],
  windowSize: number,
  stepSize: number,
  testSize: number,
): DimensionScore {
  try {
    const wf = walkForwardAnalysis(candles, createStrategy, ranges, {
      windowSize,
      stepSize,
      testSize,
      metric: "sharpe",
    });

    if (wf.periods.length === 0) {
      return {
        name: "Walk-Forward Efficiency",
        score: 50,
        weight: 0.25,
        detail: "Insufficient data for walk-forward periods",
      };
    }

    // WF Efficiency = OOS performance / IS performance
    const isReturn = wf.aggregateMetrics.avgInSample.returns;
    const oosReturn = wf.aggregateMetrics.avgOutOfSample.returns;
    const efficiency = isReturn > 0 ? oosReturn / isReturn : 0;

    // efficiency > 0.5 is good, > 0.8 is excellent
    const efficiencyScore = Math.max(0, Math.min(100, efficiency * 125));

    // OOS profitability
    const oosProfitable = wf.periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;
    const oosProfitRate = oosProfitable / wf.periods.length;
    const profitScore = oosProfitRate * 100;

    const score = efficiencyScore * 0.6 + profitScore * 0.4;

    return {
      name: "Walk-Forward Efficiency",
      score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
      weight: 0.25,
      detail: `WF Efficiency: ${(efficiency * 100).toFixed(0)}%, OOS Profitable: ${oosProfitable}/${wf.periods.length}`,
    };
  } catch {
    return {
      name: "Walk-Forward Efficiency",
      score: 50,
      weight: 0.25,
      detail: "Analysis failed",
    };
  }
}

function scoreRegimeConsistency(result: BacktestResult): DimensionScore {
  const trades = result.trades;
  if (trades.length < 10) {
    return {
      name: "Regime Consistency",
      score: 50,
      weight: 0.25,
      detail: "Too few trades for regime analysis",
    };
  }

  // Split trades into halves and compare
  const half = Math.floor(trades.length / 2);
  const firstHalf = trades.slice(0, half);
  const secondHalf = trades.slice(half);

  const firstWinRate = firstHalf.filter((t) => t.returnPercent > 0).length / firstHalf.length;
  const secondWinRate = secondHalf.filter((t) => t.returnPercent > 0).length / secondHalf.length;
  const winRateDiff = Math.abs(firstWinRate - secondWinRate);
  const winRateScore = Math.max(0, Math.min(100, ((0.2 - winRateDiff) / 0.2) * 100));

  const firstAvgReturn = firstHalf.reduce((s, t) => s + t.returnPercent, 0) / firstHalf.length;
  const secondAvgReturn = secondHalf.reduce((s, t) => s + t.returnPercent, 0) / secondHalf.length;
  const avgReturnDiff = Math.abs(firstAvgReturn - secondAvgReturn);
  const avgReturn = (Math.abs(firstAvgReturn) + Math.abs(secondAvgReturn)) / 2;
  const returnConsistency =
    avgReturn > 0 ? Math.max(0, Math.min(100, (1 - avgReturnDiff / avgReturn) * 100)) : 50;

  // Both halves profitable?
  const bothProfitable = firstAvgReturn > 0 && secondAvgReturn > 0;
  const profitScore = bothProfitable ? 100 : 30;

  const score = winRateScore * 0.3 + returnConsistency * 0.3 + profitScore * 0.4;

  return {
    name: "Regime Consistency",
    score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
    weight: 0.25,
    detail: `WinRate: ${(firstWinRate * 100).toFixed(0)}%->${(secondWinRate * 100).toFixed(0)}%, AvgRet: ${firstAvgReturn.toFixed(2)}%->${secondAvgReturn.toFixed(2)}%`,
  };
}

function generateFullAssessment(grade: string, score: number): string {
  if (score >= 80)
    return `Strategy demonstrates excellent robustness (${grade}). High confidence in out-of-sample performance.`;
  if (score >= 60)
    return `Strategy shows good robustness (${grade}). Results are moderately reliable.`;
  if (score >= 40)
    return `Strategy has marginal robustness (${grade}). Significant risk of overfitting.`;
  return `Strategy lacks robustness (${grade}). Very high likelihood of curve-fitting. Major redesign recommended.`;
}

function generateFullRecommendations(
  mc: DimensionScore,
  ps: DimensionScore,
  wf: DimensionScore,
  rc: DimensionScore,
): string[] {
  const recs: string[] = [];
  if (mc.score < 50) recs.push("Monte Carlo survival is low — performance is sequence-dependent.");
  if (ps.score < 50)
    recs.push(
      "High parameter sensitivity — strategy is likely over-optimized. Use wider stops or simpler conditions.",
    );
  if (wf.score < 50)
    recs.push(
      "Poor walk-forward efficiency — in-sample over-fitting is likely. Reduce parameters or increase training window.",
    );
  if (rc.score < 50)
    recs.push(
      "Inconsistent across time periods — strategy may only work in specific market regimes.",
    );
  if (recs.length === 0)
    recs.push("All dimensions pass. Strategy appears robust for live deployment.");
  return recs;
}
