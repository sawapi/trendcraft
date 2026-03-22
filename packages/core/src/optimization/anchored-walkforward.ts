/**
 * Anchored Walk-Forward Analysis
 *
 * Fixed-origin expanding window optimization to validate strategy robustness
 * while preventing overfitting.
 *
 * Unlike rolling walk-forward which uses a sliding window of fixed size,
 * AWF keeps the start point fixed and progressively expands the training period.
 */

import { runBacktest } from "../backtest";
import { and } from "../backtest/conditions";
import type { BacktestOptions, NormalizedCandle } from "../types";
import type {
  AWFPeriod,
  AWFResult,
  AnchoredWalkForwardOptions,
  OptimizationConstraint,
  OptimizationMetric,
} from "../types/optimization";
import { type Result, err, ok, tcError } from "../types/result";
import {
  analyzeConditionStability,
  calculateAggregateAWFMetrics,
  generateAWFRecommendation,
} from "./anchored-walkforward-utils";
import {
  type CombinationSearchOptions,
  type ConditionDefinition,
  combinationSearch,
} from "./combination-search";
import { calculateAllMetrics } from "./metrics";

// Re-export public utility functions
export {
  summarizeAWFResult,
  formatAWFResult,
  getAWFEquityCurve,
} from "./anchored-walkforward-utils";

/**
 * Default AWF options
 */
const DEFAULT_OPTIONS = {
  initialTrainSize: 504, // ~2 years
  expansionStep: 252, // ~1 year
  testSize: 252, // ~1 year
  metric: "sharpe" as OptimizationMetric,
} as const;

/**
 * Period boundary indices
 */
type PeriodBoundary = {
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
};

/**
 * Generate AWF period boundaries
 */
export function generateAWFBoundaries(
  candles: NormalizedCandle[],
  options: AnchoredWalkForwardOptions,
): PeriodBoundary[] {
  const initialTrainSize = options.initialTrainSize ?? DEFAULT_OPTIONS.initialTrainSize;
  const expansionStep = options.expansionStep ?? DEFAULT_OPTIONS.expansionStep;
  const testSize = options.testSize ?? DEFAULT_OPTIONS.testSize;
  const { anchorDate } = options;

  // Find anchor index
  let anchorIndex = candles.findIndex((c) => c.time >= anchorDate);
  if (anchorIndex === -1) anchorIndex = 0;

  const boundaries: PeriodBoundary[] = [];

  let trainEnd = anchorIndex + initialTrainSize - 1;

  while (trainEnd + testSize < candles.length) {
    const testStart = trainEnd + 1;
    const testEnd = Math.min(testStart + testSize - 1, candles.length - 1);

    boundaries.push({
      trainStart: anchorIndex,
      trainEnd,
      testStart,
      testEnd,
    });

    trainEnd += expansionStep;
  }

  return boundaries;
}

/**
 * Calculate number of possible AWF periods
 */
export function calculateAWFPeriodCount(
  totalCandles: number,
  anchorIndex: number,
  initialTrainSize: number,
  expansionStep: number,
  testSize: number,
): number {
  const availableCandles = totalCandles - anchorIndex;
  const minRequired = initialTrainSize + testSize;

  if (availableCandles < minRequired) return 0;

  return Math.floor((availableCandles - minRequired) / expansionStep) + 1;
}

/**
 * Run Anchored Walk-Forward analysis with combination search
 */
export function anchoredWalkForwardAnalysis(
  candles: NormalizedCandle[],
  entryConditions: ConditionDefinition[],
  exitConditions: ConditionDefinition[],
  options: AnchoredWalkForwardOptions,
  combinationOptions: Omit<CombinationSearchOptions, "progressCallback"> = {},
): AWFResult {
  const metric = options.metric ?? DEFAULT_OPTIONS.metric;
  const constraints = options.constraints ?? ([] as OptimizationConstraint[]);
  const { progressCallback } = options;

  // Generate period boundaries
  const boundaries = generateAWFBoundaries(candles, options);

  if (boundaries.length === 0) {
    const initialTrainSize = options.initialTrainSize ?? DEFAULT_OPTIONS.initialTrainSize;
    const testSize = options.testSize ?? DEFAULT_OPTIONS.testSize;
    throw new Error(
      `Insufficient data for AWF analysis. Need at least ${initialTrainSize + testSize} candles after anchor date.`,
    );
  }

  const periods: AWFPeriod[] = [];
  const conditionOccurrences: Record<string, number> = {};

  // Backtest options
  const backtestOpts: BacktestOptions = combinationOptions.backtestOptions ?? {
    capital: 1000000,
  };

  // Process each period
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];

    if (progressCallback) {
      progressCallback(i + 1, boundaries.length, "train");
    }

    // Extract training and test data
    const trainCandles = candles.slice(boundary.trainStart, boundary.trainEnd + 1);
    const testCandles = candles.slice(boundary.testStart, boundary.testEnd + 1);

    // Run combination search on training data
    const searchResult = combinationSearch(trainCandles, entryConditions, exitConditions, {
      ...combinationOptions,
      metric,
      constraints,
    });

    // Get best combination
    const bestEntry = searchResult.bestEntry;
    const bestExit = searchResult.bestExit;

    // Track condition frequency
    for (const cond of bestEntry) {
      conditionOccurrences[`entry:${cond}`] = (conditionOccurrences[`entry:${cond}`] || 0) + 1;
    }
    for (const cond of bestExit) {
      conditionOccurrences[`exit:${cond}`] = (conditionOccurrences[`exit:${cond}`] || 0) + 1;
    }

    if (progressCallback) {
      progressCallback(i + 1, boundaries.length, "test");
    }

    // Build combined conditions for test
    const entryDefs = entryConditions.filter((c) => bestEntry.includes(c.name));
    const exitDefs = exitConditions.filter((c) => bestExit.includes(c.name));

    const entryCondition =
      entryDefs.length === 1 ? entryDefs[0].create() : and(...entryDefs.map((d) => d.create()));

    const exitCondition =
      exitDefs.length === 1 ? exitDefs[0].create() : and(...exitDefs.map((d) => d.create()));

    // Get in-sample metrics from best result
    const bestSearchResult = searchResult.results.find(
      (r) =>
        r.entryConditions.join(",") === bestEntry.join(",") &&
        r.exitConditions.join(",") === bestExit.join(","),
    );
    const inSampleMetrics = bestSearchResult?.metrics ?? ({} as Record<OptimizationMetric, number>);

    // Run out-of-sample test
    const testBacktest = runBacktest(testCandles, entryCondition, exitCondition, backtestOpts);
    const outOfSampleMetrics = calculateAllMetrics(testBacktest, testCandles, {
      initialCapital: backtestOpts.capital ?? 1000000,
    });

    periods.push({
      periodNumber: i + 1,
      trainStart: candles[boundary.trainStart].time,
      trainEnd: candles[boundary.trainEnd].time,
      trainCandleCount: trainCandles.length,
      testStart: candles[boundary.testStart].time,
      testEnd: candles[boundary.testEnd].time,
      testCandleCount: testCandles.length,
      bestEntryConditions: bestEntry,
      bestExitConditions: bestExit,
      inSampleMetrics,
      outOfSampleMetrics,
      testBacktest,
    });
  }

  // Calculate aggregate metrics
  const aggregateMetrics = calculateAggregateAWFMetrics(periods, metric);

  // Analyze condition stability
  const stabilityAnalysis = analyzeConditionStability(periods, conditionOccurrences);

  // Generate recommendation
  const recommendation = generateAWFRecommendation(periods, aggregateMetrics, stabilityAnalysis);

  return {
    periods,
    aggregateMetrics,
    stabilityAnalysis,
    recommendation,
  };
}

/**
 * Safe variant of anchoredWalkForwardAnalysis that returns a Result instead of throwing.
 *
 * @example
 * ```ts
 * const result = anchoredWalkForwardAnalysisSafe(candles, entryConditions, exitConditions, options);
 * if (result.ok) {
 *   console.log(result.value.recommendation);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function anchoredWalkForwardAnalysisSafe(
  candles: NormalizedCandle[],
  entryConditions: ConditionDefinition[],
  exitConditions: ConditionDefinition[],
  options: AnchoredWalkForwardOptions,
  combinationOptions: Omit<CombinationSearchOptions, "progressCallback"> = {},
): Result<AWFResult> {
  try {
    return ok(
      anchoredWalkForwardAnalysis(
        candles,
        entryConditions,
        exitConditions,
        options,
        combinationOptions,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("Insufficient data")
      ? ("INSUFFICIENT_DATA" as const)
      : ("OPTIMIZATION_FAILED" as const);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
