/**
 * Walk-Forward Analysis
 *
 * Rolling window optimization to validate parameter robustness
 * and prevent overfitting.
 */

import { runBacktest } from "../backtest";
import type { BacktestOptions, Condition, NormalizedCandle } from "../types";
import type {
  OptimizationConstraint,
  OptimizationMetric,
  ParameterRange,
  WalkForwardOptions,
  WalkForwardPeriod,
  WalkForwardResult,
} from "../types/optimization";
import { type StrategyFactory, gridSearch } from "./grid-search";
import { calculateAllMetrics, getMetricValue } from "./metrics";

/**
 * Default options for walk-forward analysis
 */
const DEFAULT_OPTIONS: Required<Omit<WalkForwardOptions, "constraints" | "progressCallback">> = {
  windowSize: 252, // ~1 year of daily data
  stepSize: 63, // ~1 quarter
  testSize: 63, // ~1 quarter
  metric: "sharpe",
};

/**
 * Calculate the number of walk-forward periods possible
 * @param totalCandles Total number of candles
 * @param windowSize Training window size
 * @param stepSize Step size between periods
 * @param testSize Test period size
 * @returns Number of periods
 */
export function calculatePeriodCount(
  totalCandles: number,
  windowSize: number,
  stepSize: number,
  testSize: number,
): number {
  const minDataNeeded = windowSize + testSize;
  if (totalCandles < minDataNeeded) return 0;

  return Math.floor((totalCandles - windowSize - testSize) / stepSize) + 1;
}

/**
 * Generate walk-forward period boundaries
 * @param candles Candle data
 * @param options Walk-forward options
 * @returns Array of period boundaries
 */
export function generatePeriodBoundaries(
  candles: NormalizedCandle[],
  options: WalkForwardOptions = {},
): Array<{
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
}> {
  const { windowSize, stepSize, testSize } = { ...DEFAULT_OPTIONS, ...options };

  const boundaries: Array<{
    trainStart: number;
    trainEnd: number;
    testStart: number;
    testEnd: number;
  }> = [];

  let trainStart = 0;

  while (trainStart + windowSize + testSize <= candles.length) {
    const trainEnd = trainStart + windowSize - 1;
    const testStart = trainEnd + 1;
    const testEnd = testStart + testSize - 1;

    boundaries.push({
      trainStart,
      trainEnd,
      testStart,
      testEnd,
    });

    trainStart += stepSize;
  }

  return boundaries;
}

/**
 * Run walk-forward analysis
 * @param candles Candle data
 * @param createStrategy Strategy factory function
 * @param parameterRanges Parameter ranges to optimize
 * @param options Walk-forward options
 * @returns Walk-forward analysis result
 */
export function walkForwardAnalysis(
  candles: NormalizedCandle[],
  createStrategy: StrategyFactory,
  parameterRanges: ParameterRange[],
  options: WalkForwardOptions = {},
): WalkForwardResult {
  const { windowSize, stepSize, testSize, metric, constraints, progressCallback } = {
    ...DEFAULT_OPTIONS,
    constraints: [] as OptimizationConstraint[],
    ...options,
  };

  // Generate period boundaries
  const boundaries = generatePeriodBoundaries(candles, {
    windowSize,
    stepSize,
    testSize,
  });

  if (boundaries.length === 0) {
    throw new Error(
      `Insufficient data for walk-forward analysis. ` +
        `Need at least ${windowSize + testSize} candles, got ${candles.length}.`,
    );
  }

  const periods: WalkForwardPeriod[] = [];
  const allInSampleMetrics: Record<OptimizationMetric, number>[] = [];
  const allOutOfSampleMetrics: Record<OptimizationMetric, number>[] = [];

  // Process each period
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];

    // Report progress
    if (progressCallback) {
      progressCallback(i + 1, boundaries.length);
    }

    // Extract train and test data
    const trainCandles = candles.slice(boundary.trainStart, boundary.trainEnd + 1);
    const testCandles = candles.slice(boundary.testStart, boundary.testEnd + 1);

    // Optimize on training data
    const gridResult = gridSearch(trainCandles, createStrategy, parameterRanges, {
      metric,
      constraints,
      maxCombinations: 10000,
    });

    // Use best parameters or fallback to first valid result
    const bestParams =
      gridResult.validCombinations > 0
        ? gridResult.bestParams
        : parameterRanges.reduce(
            (acc, r) => {
              acc[r.name] = r.min;
              return acc;
            },
            {} as Record<string, number>,
          );

    // Run backtest on training data with best params
    const trainStrategy = createStrategy(bestParams);
    const trainBacktest = runBacktest(trainCandles, trainStrategy.entry, trainStrategy.exit, {
      capital: 100000,
      ...trainStrategy.options,
    });
    const inSampleMetrics = calculateAllMetrics(trainBacktest, trainCandles);

    // Run backtest on test data with same params
    const testStrategy = createStrategy(bestParams);
    const testBacktest = runBacktest(testCandles, testStrategy.entry, testStrategy.exit, {
      capital: 100000,
      ...testStrategy.options,
    });
    const outOfSampleMetrics = calculateAllMetrics(testBacktest, testCandles);

    // Record period result
    periods.push({
      trainStart: candles[boundary.trainStart].time,
      trainEnd: candles[boundary.trainEnd].time,
      testStart: candles[boundary.testStart].time,
      testEnd: candles[boundary.testEnd].time,
      bestParams,
      inSampleMetrics,
      outOfSampleMetrics,
      testBacktest,
    });

    allInSampleMetrics.push(inSampleMetrics);
    allOutOfSampleMetrics.push(outOfSampleMetrics);
  }

  // Calculate aggregate metrics
  const aggregateMetrics = calculateAggregateMetrics(
    allInSampleMetrics,
    allOutOfSampleMetrics,
    metric,
  );

  // Generate recommendation
  const recommendation = generateRecommendation(periods, aggregateMetrics, metric);

  return {
    periods,
    aggregateMetrics,
    recommendation,
  };
}

/**
 * Calculate aggregate metrics across all periods
 */
function calculateAggregateMetrics(
  inSampleMetrics: Record<OptimizationMetric, number>[],
  outOfSampleMetrics: Record<OptimizationMetric, number>[],
  primaryMetric: OptimizationMetric,
): WalkForwardResult["aggregateMetrics"] {
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

  // Calculate averages
  const avgInSample: Record<OptimizationMetric, number> = {} as Record<OptimizationMetric, number>;
  const avgOutOfSample: Record<OptimizationMetric, number> = {} as Record<
    OptimizationMetric,
    number
  >;

  for (const key of metricKeys) {
    avgInSample[key] =
      inSampleMetrics.reduce((sum, m) => sum + (isFinite(m[key]) ? m[key] : 0), 0) /
      inSampleMetrics.length;
    avgOutOfSample[key] =
      outOfSampleMetrics.reduce((sum, m) => sum + (isFinite(m[key]) ? m[key] : 0), 0) /
      outOfSampleMetrics.length;
  }

  // Calculate stability ratio for primary metric
  const avgIn = avgInSample[primaryMetric];
  const avgOut = avgOutOfSample[primaryMetric];

  let stabilityRatio: number;
  if (avgIn === 0) {
    stabilityRatio = avgOut >= 0 ? 1 : 0;
  } else if (avgIn < 0 && avgOut < 0) {
    // Both negative: higher ratio is worse overfitting
    stabilityRatio = Math.min(avgOut / avgIn, 1);
  } else if (avgIn > 0 && avgOut > 0) {
    // Both positive: closer to 1 is better
    stabilityRatio = Math.min(avgOut / avgIn, 1);
  } else {
    // Mixed signs: low stability
    stabilityRatio = 0;
  }

  return {
    avgInSample,
    avgOutOfSample,
    stabilityRatio,
  };
}

/**
 * Generate recommendation based on walk-forward results
 */
function generateRecommendation(
  periods: WalkForwardPeriod[],
  aggregateMetrics: WalkForwardResult["aggregateMetrics"],
  metric: OptimizationMetric,
): WalkForwardResult["recommendation"] {
  const { avgInSample, avgOutOfSample, stabilityRatio } = aggregateMetrics;

  // Count profitable out-of-sample periods
  const profitablePeriods = periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;
  const profitableRatio = profitablePeriods / periods.length;

  // Analyze parameter stability
  const paramKeys = Object.keys(periods[0]?.bestParams || {});
  const paramVariance: Record<string, number> = {};

  for (const key of paramKeys) {
    const values = periods.map((p) => p.bestParams[key]);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    paramVariance[key] = variance;
  }

  // Calculate suggested params (most common or median)
  const suggestedParams: Record<string, number> = {};
  for (const key of paramKeys) {
    const values = periods.map((p) => p.bestParams[key]).sort((a, b) => a - b);
    suggestedParams[key] = values[Math.floor(values.length / 2)]; // Median
  }

  // Decision logic
  const inSampleValue = avgInSample[metric];
  const outOfSampleValue = avgOutOfSample[metric];

  // Good: stability ratio > 0.5, profitable > 60%, out-of-sample positive
  if (stabilityRatio >= 0.5 && profitableRatio >= 0.6 && outOfSampleValue > 0) {
    return {
      useOptimizedParams: true,
      reason: `Strong out-of-sample performance (${(stabilityRatio * 100).toFixed(1)}% stability, ${(profitableRatio * 100).toFixed(0)}% profitable periods)`,
      suggestedParams,
    };
  }

  // Moderate: stability ratio > 0.3, profitable > 50%
  if (stabilityRatio >= 0.3 && profitableRatio >= 0.5) {
    return {
      useOptimizedParams: true,
      reason: `Moderate stability (${(stabilityRatio * 100).toFixed(1)}%). Consider using conservative parameters.`,
      suggestedParams,
    };
  }

  // Weak: some profit but low stability
  if (profitableRatio > 0.4) {
    return {
      useOptimizedParams: false,
      reason: `Low stability (${(stabilityRatio * 100).toFixed(1)}%). Optimization may be overfitting to historical data.`,
    };
  }

  // Poor: negative out-of-sample or very low profitability
  return {
    useOptimizedParams: false,
    reason: `Poor out-of-sample performance (${(profitableRatio * 100).toFixed(0)}% profitable). Strategy may not be robust.`,
  };
}

/**
 * Get summary statistics from walk-forward result
 * @param result Walk-forward result
 * @returns Summary object
 */
export function summarizeWalkForward(result: WalkForwardResult): {
  periodCount: number;
  avgInSampleReturn: number;
  avgOutOfSampleReturn: number;
  stabilityRatio: number;
  profitablePeriods: number;
  recommendation: string;
} {
  const profitablePeriods = result.periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;

  return {
    periodCount: result.periods.length,
    avgInSampleReturn: result.aggregateMetrics.avgInSample.returns,
    avgOutOfSampleReturn: result.aggregateMetrics.avgOutOfSample.returns,
    stabilityRatio: result.aggregateMetrics.stabilityRatio,
    profitablePeriods,
    recommendation: result.recommendation.reason,
  };
}

/**
 * Export combined out-of-sample equity curve
 * @param result Walk-forward result
 * @param initialCapital Initial capital
 * @returns Equity curve as array of {time, equity}
 */
export function getOutOfSampleEquityCurve(
  result: WalkForwardResult,
  initialCapital = 100000,
): Array<{ time: number; equity: number }> {
  const curve: Array<{ time: number; equity: number }> = [];
  let equity = initialCapital;

  for (const period of result.periods) {
    // Apply the return from this period
    const returnPercent = period.outOfSampleMetrics.returns;
    const returnAmount = equity * (returnPercent / 100);
    equity += returnAmount;

    curve.push({
      time: period.testEnd,
      equity,
    });
  }

  return curve;
}
