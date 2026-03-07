/**
 * Anchored Walk-Forward Analysis - Utility Functions
 *
 * Helper and formatting functions for AWF analysis results.
 */

import type { AWFPeriod, AWFResult, OptimizationMetric } from "../types/optimization";

/**
 * Calculate aggregate metrics across all AWF periods
 */
export function calculateAggregateAWFMetrics(
  periods: AWFPeriod[],
  primaryMetric: OptimizationMetric,
): AWFResult["aggregateMetrics"] {
  const metricKeys: OptimizationMetric[] = [
    "sharpe",
    "calmar",
    "profitFactor",
    "recoveryFactor",
    "returns",
    "winRate",
    "tradeCount",
    "maxDrawdown",
  ];

  const avgInSample = {} as Record<OptimizationMetric, number>;
  const avgOutOfSample = {} as Record<OptimizationMetric, number>;

  for (const key of metricKeys) {
    avgInSample[key] =
      periods.reduce((sum, p) => {
        const val = p.inSampleMetrics[key];
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0) / periods.length;
    avgOutOfSample[key] =
      periods.reduce((sum, p) => {
        const val = p.outOfSampleMetrics[key];
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0) / periods.length;
  }

  // Stability ratio
  const avgIn = avgInSample[primaryMetric];
  const avgOut = avgOutOfSample[primaryMetric];
  let stabilityRatio: number;
  if (avgIn > 0 && avgOut > 0) {
    stabilityRatio = Math.min(avgOut / avgIn, 1);
  } else if (avgIn < 0 && avgOut < 0) {
    stabilityRatio = Math.min(avgOut / avgIn, 1);
  } else if (avgIn === 0) {
    stabilityRatio = avgOut >= 0 ? 1 : 0;
  } else {
    stabilityRatio = 0;
  }

  // OOS return standard deviation
  const oosReturns = periods.map((p) => p.outOfSampleMetrics.returns);
  const meanOOS = oosReturns.reduce((s, r) => s + r, 0) / oosReturns.length;
  const oosReturnStdDev = Math.sqrt(
    oosReturns.reduce((s, r) => s + (r - meanOOS) ** 2, 0) / oosReturns.length,
  );

  return { avgInSample, avgOutOfSample, stabilityRatio, oosReturnStdDev };
}

/**
 * Analyze condition stability across periods
 */
export function analyzeConditionStability(
  periods: AWFPeriod[],
  occurrences: Record<string, number>,
): AWFResult["stabilityAnalysis"] {
  const totalPeriods = periods.length;

  // Calculate frequency as percentage
  const conditionFrequency: Record<string, number> = {};
  for (const [key, count] of Object.entries(occurrences)) {
    conditionFrequency[key] = (count / totalPeriods) * 100;
  }

  // Find stable conditions (appear in > 50% of periods)
  const stableEntryConditions: string[] = [];
  const stableExitConditions: string[] = [];

  for (const [key, freq] of Object.entries(conditionFrequency)) {
    if (freq >= 50) {
      if (key.startsWith("entry:")) {
        stableEntryConditions.push(key.replace("entry:", ""));
      } else if (key.startsWith("exit:")) {
        stableExitConditions.push(key.replace("exit:", ""));
      }
    }
  }

  // Consistency score based on how stable conditions are
  const allFreqs = Object.values(conditionFrequency);
  const avgFreq = allFreqs.length > 0 ? allFreqs.reduce((s, f) => s + f, 0) / allFreqs.length : 0;
  const consistencyScore = Math.min(avgFreq, 100);

  return {
    conditionFrequency,
    stableEntryConditions,
    stableExitConditions,
    consistencyScore,
  };
}

/**
 * Generate AWF recommendation
 */
export function generateAWFRecommendation(
  periods: AWFPeriod[],
  aggregateMetrics: AWFResult["aggregateMetrics"],
  stabilityAnalysis: AWFResult["stabilityAnalysis"],
): AWFResult["recommendation"] {
  const { stabilityRatio } = aggregateMetrics;
  const { stableEntryConditions, stableExitConditions, consistencyScore } = stabilityAnalysis;

  // Count profitable OOS periods
  const profitablePeriods = periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;
  const profitableRatio = profitablePeriods / periods.length;

  // Use most frequent conditions from last period if no stable ones
  const lastPeriod = periods[periods.length - 1];
  const entryConditions =
    stableEntryConditions.length > 0 ? stableEntryConditions : lastPeriod.bestEntryConditions;
  const exitConditions =
    stableExitConditions.length > 0 ? stableExitConditions : lastPeriod.bestExitConditions;

  // Decision logic
  if (stabilityRatio >= 0.5 && profitableRatio >= 0.6 && consistencyScore >= 40) {
    return {
      useOptimized: true,
      entryConditions,
      exitConditions,
      reason: `Strong stability (ratio=${stabilityRatio.toFixed(2)}, ${(profitableRatio * 100).toFixed(0)}% profitable periods, ${consistencyScore.toFixed(0)}% consistency). Recommended conditions show robustness across expanding training periods.`,
    };
  }

  if (stabilityRatio >= 0.3 && profitableRatio >= 0.5) {
    return {
      useOptimized: true,
      entryConditions,
      exitConditions,
      reason: `Moderate stability (ratio=${stabilityRatio.toFixed(2)}). Consider using recommended conditions with reduced position sizing.`,
    };
  }

  return {
    useOptimized: false,
    entryConditions: [],
    exitConditions: [],
    reason: `Low stability (ratio=${stabilityRatio.toFixed(2)}, ${(profitableRatio * 100).toFixed(0)}% profitable). Optimization may be overfitting. Avoid using optimized conditions.`,
  };
}

/**
 * Summarize AWF result
 */
export function summarizeAWFResult(result: AWFResult): {
  periodCount: number;
  avgInSampleReturn: number;
  avgOutOfSampleReturn: number;
  stabilityRatio: number;
  profitablePeriods: number;
  consistencyScore: number;
  recommendedEntry: string[];
  recommendedExit: string[];
  useOptimized: boolean;
} {
  const profitablePeriods = result.periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;

  return {
    periodCount: result.periods.length,
    avgInSampleReturn: result.aggregateMetrics.avgInSample.returns,
    avgOutOfSampleReturn: result.aggregateMetrics.avgOutOfSample.returns,
    stabilityRatio: result.aggregateMetrics.stabilityRatio,
    profitablePeriods,
    consistencyScore: result.stabilityAnalysis.consistencyScore,
    recommendedEntry: result.recommendation.entryConditions,
    recommendedExit: result.recommendation.exitConditions,
    useOptimized: result.recommendation.useOptimized,
  };
}

/**
 * Format AWF result for display
 */
export function formatAWFResult(result: AWFResult): string {
  const profitablePeriods = result.periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;

  const lines = [
    "=== Anchored Walk-Forward Analysis Results ===",
    `Periods: ${result.periods.length}`,
    "",
    "Aggregate Performance:",
    `  IS Return:  ${result.aggregateMetrics.avgInSample.returns.toFixed(2)}%`,
    `  OOS Return: ${result.aggregateMetrics.avgOutOfSample.returns.toFixed(2)}%`,
    `  Stability:  ${(result.aggregateMetrics.stabilityRatio * 100).toFixed(1)}%`,
    `  OOS StdDev: ${result.aggregateMetrics.oosReturnStdDev.toFixed(2)}%`,
    "",
    "Condition Stability:",
    `  Consistency Score: ${result.stabilityAnalysis.consistencyScore.toFixed(1)}%`,
    `  Stable Entry: ${result.stabilityAnalysis.stableEntryConditions.join(", ") || "None"}`,
    `  Stable Exit:  ${result.stabilityAnalysis.stableExitConditions.join(", ") || "None"}`,
    "",
    `Profitable Periods: ${profitablePeriods}/${result.periods.length} (${((profitablePeriods / result.periods.length) * 100).toFixed(0)}%)`,
    "",
    "Recommendation:",
    `  ${result.recommendation.useOptimized ? "USE OPTIMIZED" : "DO NOT USE"}`,
    `  ${result.recommendation.reason}`,
  ];

  if (result.recommendation.useOptimized) {
    lines.push("");
    lines.push("Recommended Conditions:");
    lines.push(`  Entry: ${result.recommendation.entryConditions.join(" + ")}`);
    lines.push(`  Exit:  ${result.recommendation.exitConditions.join(" + ")}`);
  }

  // Period details
  lines.push("");
  lines.push("Period Details:");
  for (const period of result.periods) {
    const trainStart = new Date(period.trainStart).toISOString().slice(0, 10);
    const trainEnd = new Date(period.trainEnd).toISOString().slice(0, 10);
    const testStart = new Date(period.testStart).toISOString().slice(0, 10);
    const testEnd = new Date(period.testEnd).toISOString().slice(0, 10);
    lines.push(
      `  [${period.periodNumber}] Train: ${trainStart}~${trainEnd} | Test: ${testStart}~${testEnd}`,
    );
    lines.push(
      `      IS: ${period.inSampleMetrics.returns?.toFixed(1) ?? "N/A"}% | OOS: ${period.outOfSampleMetrics.returns.toFixed(1)}%`,
    );
    lines.push(
      `      Entry: ${period.bestEntryConditions.join("+")} | Exit: ${period.bestExitConditions.join("+")}`,
    );
  }

  return lines.join("\n");
}

/**
 * Get OOS equity curve across all periods
 */
export function getAWFEquityCurve(
  result: AWFResult,
  initialCapital = 1000000,
): Array<{ time: number; equity: number; periodNumber: number }> {
  const curve: Array<{ time: number; equity: number; periodNumber: number }> = [];
  let equity = initialCapital;

  for (const period of result.periods) {
    const returnPercent = period.outOfSampleMetrics.returns;
    equity *= 1 + returnPercent / 100;
    curve.push({
      time: period.testEnd,
      equity,
      periodNumber: period.periodNumber,
    });
  }

  return curve;
}
