/**
 * Grid Search Optimization
 *
 * Exhaustive parameter search for finding optimal backtest configurations.
 */

import { runBacktest } from "../backtest";
import { IndicatorCache } from "../core/indicator-cache";
import type { BacktestOptions, Condition, NormalizedCandle } from "../types";
import type {
  GridSearchOptions,
  GridSearchResult,
  OptimizationConstraint,
  OptimizationMetric,
  OptimizationResultEntry,
  ParameterRange,
} from "../types/optimization";
import { err, ok, type Result, tcError } from "../types/result";
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
 * Epsilon divisor used by `getParameterValues` when comparing the loop
 * variable against `range.max` (epsilon = step / FACTOR). Exposed so
 * external tools (UIs deriving the same grid points, MCP callers
 * pre-validating LLM output, etc.) can reproduce the comparison
 * semantics without re-deriving the constant.
 */
export const GRID_SEARCH_EPSILON_FACTOR = 1_000_000;

function getParameterValues(range: ParameterRange): number[] {
  if (range.step <= 0) {
    throw new Error(`Parameter "${range.name}" step must be positive`);
  }
  if (range.max < range.min) {
    throw new Error(`Parameter "${range.name}" max must be greater than or equal to min`);
  }

  const values: number[] = [];
  const epsilon = Math.abs(range.step) / GRID_SEARCH_EPSILON_FACTOR;

  for (let value = range.min; value <= range.max + epsilon; value += range.step) {
    const roundedValue =
      Math.round(value * GRID_SEARCH_EPSILON_FACTOR) / GRID_SEARCH_EPSILON_FACTOR;
    if (roundedValue <= range.max + epsilon) {
      values.push(roundedValue);
    }
  }

  return values;
}

/**
 * Generate all parameter combinations from ranges
 * @param ranges Parameter ranges to combine
 * @returns Array of all parameter combinations
 */
export function generateParameterCombinations(ranges: ParameterRange[]): Record<string, number>[] {
  if (ranges.length === 0) return [{}];

  const combinations: Record<string, number>[] = [];

  function generate(index: number, current: Record<string, number>): void {
    if (index === ranges.length) {
      combinations.push({ ...current });
      return;
    }

    const range = ranges[index];
    for (const value of getParameterValues(range)) {
      current[range.name] = value;
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
    return total * getParameterValues(range).length;
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
      `Too many parameter combinations (${totalCombinations}). Maximum allowed is ${maxCombinations}. Consider reducing parameter ranges or increasing step sizes.`,
    );
  }

  // Generate all combinations
  const combinations = generateParameterCombinations(parameterRanges);

  // Shared indicator cache across all backtest runs on same candle data
  const cache = new IndicatorCache();

  // Run backtests and collect results
  const results: OptimizationResultEntry[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestParams: Record<string, number> | null = null;
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

      // Run backtest with shared cache
      const backtest = runBacktest(candles, strategy.entry, strategy.exit, backtestOptions, cache);

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

      // Only keep valid, finite-scored results unless keepAllResults
      // is true. Calmar / MAR / Recovery return NaN when maxDD <= 0
      // (matches empyrical / pyfolio). Letting NaN / Infinity through
      // would corrupt downstream consumers that re-sort or average
      // `results` (e.g. strategy-dna's `computeRecommendedParams`,
      // `extractSensitivityData`) without their own isFinite guard.
      const finiteScore = Number.isFinite(score);
      if (keepAllResults || (passedConstraints && finiteScore)) {
        results.push(entry);
      }

      // Update best if passes constraints AND has a finite score.
      if (passedConstraints && finiteScore) {
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

  // Sort results by score (descending). NaN scores sink to the end:
  // any comparison involving NaN returns false, so the comparator
  // falls through, but explicit handling makes the order deterministic.
  results.sort((a, b) => {
    const aFinite = Number.isFinite(a.score);
    const bFinite = Number.isFinite(b.score);
    if (aFinite && bFinite) return b.score - a.score;
    if (aFinite) return -1;
    if (bFinite) return 1;
    return 0;
  });

  return {
    bestParams: validCombinations > 0 ? bestParams : null,
    bestScore: bestScore === Number.NEGATIVE_INFINITY ? null : bestScore,
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
export function param(name: string, min: number, max: number, step: number): ParameterRange {
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
  onlyValid = true,
): OptimizationResultEntry[] {
  const filtered = onlyValid ? result.results.filter((r) => r.passedConstraints) : result.results;

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
  bestParams: Record<string, number> | null;
  bestScore: number | null;
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

/**
 * Safe variant of gridSearch that returns a Result instead of throwing.
 *
 * @example
 * ```ts
 * const result = gridSearchSafe(candles, createStrategy, parameterRanges);
 * if (result.ok) {
 *   console.log(result.value.bestParams);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function gridSearchSafe(
  candles: NormalizedCandle[],
  createStrategy: StrategyFactory,
  parameterRanges: ParameterRange[],
  options: GridSearchOptions = {},
): Result<GridSearchResult> {
  try {
    return ok(gridSearch(candles, createStrategy, parameterRanges, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("Too many parameter combinations")
      ? ("TOO_MANY_COMBINATIONS" as const)
      : ("OPTIMIZATION_FAILED" as const);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
