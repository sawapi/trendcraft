/**
 * Grid Search Optimization
 *
 * Exhaustive parameter search for finding optimal backtest configurations.
 */

import type { BacktestOptions, Condition, NormalizedCandle } from "../types";
import type {
  GridSearchOptions,
  GridSearchResult,
  OptimizationConstraint,
  OptimizationMetric,
  OptimizationResultEntry,
  ParameterRange,
} from "../types/optimization";
import { runBacktest } from "../backtest";
import { calculateAllMetrics, checkConstraint, getMetricValue } from "./metrics";

/**
 * Strategy factory function type
 */
export type StrategyFactory = (params: Record<string, number>) => {
  entry: Condition;
  exit: Condition;
  options?: BacktestOptions;
};

/**
 * Generate all parameter combinations from ranges
 * @param ranges Parameter ranges to combine
 * @returns Array of all parameter combinations
 */
export function generateParameterCombinations(
  ranges: ParameterRange[],
): Record<string, number>[] {
  if (ranges.length === 0) return [{}];

  const combinations: Record<string, number>[] = [];

  function generate(index: number, current: Record<string, number>): void {
    if (index === ranges.length) {
      combinations.push({ ...current });
      return;
    }

    const range = ranges[index];
    // Calculate number of steps to avoid floating point issues
    const numSteps = Math.round((range.max - range.min) / range.step) + 1;
    for (let i = 0; i < numSteps; i++) {
      // Calculate value from index to avoid cumulative floating point errors
      const value = range.min + i * range.step;
      // Round to avoid floating point precision issues
      const roundedValue = Math.round(value * 1000000) / 1000000;
      current[range.name] = roundedValue;
      generate(index + 1, current);
    }
  }

  generate(0, {});
  return combinations;
}

/**
 * Count total number of combinations
 * @param ranges Parameter ranges
 * @returns Total number of combinations
 */
export function countCombinations(ranges: ParameterRange[]): number {
  if (ranges.length === 0) return 1;

  return ranges.reduce((total, range) => {
    const count = Math.floor((range.max - range.min) / range.step) + 1;
    return total * count;
  }, 1);
}

/**
 * Check if result passes all constraints
 * @param metrics Calculated metrics
 * @param constraints Constraints to check
 * @returns Whether all constraints are satisfied
 */
function checkAllConstraints(
  metrics: Record<OptimizationMetric, number>,
  constraints: OptimizationConstraint[],
): boolean {
  for (const constraint of constraints) {
    const value = getMetricValue(metrics, constraint.metric);
    if (!checkConstraint(value, constraint.operator, constraint.value)) {
      return false;
    }
  }
  return true;
}

/**
 * Perform grid search optimization
 * @param candles Candle data
 * @param createStrategy Strategy factory function
 * @param parameterRanges Parameter ranges to search
 * @param options Grid search options
 * @returns Grid search results
 */
export function gridSearch(
  candles: NormalizedCandle[],
  createStrategy: StrategyFactory,
  parameterRanges: ParameterRange[],
  options: GridSearchOptions = {},
): GridSearchResult {
  const {
    metric = "sharpe",
    constraints = [],
    maxCombinations = 10000,
    progressCallback,
    keepAllResults = false,
  } = options;

  // Check total combinations
  const totalCombinations = countCombinations(parameterRanges);

  if (totalCombinations > maxCombinations) {
    throw new Error(
      `Too many parameter combinations (${totalCombinations}). ` +
        `Maximum allowed is ${maxCombinations}. ` +
        `Consider reducing parameter ranges or increasing step sizes.`,
    );
  }

  // Generate all combinations
  const combinations = generateParameterCombinations(parameterRanges);

  // Run backtests and collect results
  const results: OptimizationResultEntry[] = [];
  let bestScore = -Infinity;
  let bestParams: Record<string, number> = {};
  let validCombinations = 0;

  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];

    // Report progress
    if (progressCallback) {
      progressCallback(i + 1, combinations.length);
    }

    try {
      // Create strategy with current parameters
      const strategy = createStrategy(params);
      const backtestOptions: BacktestOptions = {
        capital: 100000,
        ...strategy.options,
      };

      // Run backtest
      const backtest = runBacktest(candles, strategy.entry, strategy.exit, backtestOptions);

      // Calculate metrics
      const metrics = calculateAllMetrics(backtest, candles, {
        initialCapital: backtestOptions.capital,
      });

      // Check constraints
      const passedConstraints = checkAllConstraints(metrics, constraints);

      // Get target metric score
      const score = getMetricValue(metrics, metric);

      // Track results
      const entry: OptimizationResultEntry = {
        params,
        score,
        metrics,
        backtest,
        passedConstraints,
      };

      // Only keep valid results unless keepAllResults is true
      if (keepAllResults || passedConstraints) {
        results.push(entry);
      }

      // Update best if passes constraints
      if (passedConstraints) {
        validCombinations++;
        if (score > bestScore) {
          bestScore = score;
          bestParams = { ...params };
        }
      }
    } catch (error) {
      // Skip failed combinations
      console.warn(`Skipping parameters ${JSON.stringify(params)}: ${error}`);
    }
  }

  // Sort results by score (descending)
  results.sort((a, b) => b.score - a.score);

  return {
    bestParams,
    bestScore: bestScore === -Infinity ? 0 : bestScore,
    metric,
    totalCombinations,
    validCombinations,
    results,
  };
}

/**
 * Create parameter range helper
 * @param name Parameter name
 * @param min Minimum value
 * @param max Maximum value
 * @param step Step size
 * @returns ParameterRange object
 */
export function param(
  name: string,
  min: number,
  max: number,
  step: number,
): ParameterRange {
  return { name, min, max, step };
}

/**
 * Create constraint helper
 * @param metric Metric to constrain
 * @param operator Comparison operator
 * @param value Threshold value
 * @returns OptimizationConstraint object
 */
export function constraint(
  metric: OptimizationMetric,
  operator: ">" | ">=" | "<" | "<=" | "==",
  value: number,
): OptimizationConstraint {
  return { metric, operator, value };
}

/**
 * Get top N results from grid search
 * @param result Grid search result
 * @param n Number of results to return
 * @param onlyValid Only include results that passed constraints
 * @returns Top N results
 */
export function getTopResults(
  result: GridSearchResult,
  n: number,
  onlyValid: boolean = true,
): OptimizationResultEntry[] {
  const filtered = onlyValid
    ? result.results.filter((r) => r.passedConstraints)
    : result.results;

  return filtered.slice(0, n);
}

/**
 * Summarize grid search results
 * @param result Grid search result
 * @returns Summary object
 */
export function summarizeGridSearch(result: GridSearchResult): {
  totalTested: number;
  validCount: number;
  validPercent: number;
  bestParams: Record<string, number>;
  bestScore: number;
  metric: OptimizationMetric;
} {
  return {
    totalTested: result.totalCombinations,
    validCount: result.validCombinations,
    validPercent: (result.validCombinations / result.totalCombinations) * 100,
    bestParams: result.bestParams,
    bestScore: result.bestScore,
    metric: result.metric,
  };
}
