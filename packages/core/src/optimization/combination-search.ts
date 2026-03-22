/**
 * Combination Search
 *
 * Exhaustive search for optimal condition combinations.
 * Tests all possible AND combinations of entry/exit conditions.
 */

import { runBacktest } from "../backtest";
import { and, or } from "../backtest/conditions";
import { IndicatorCache } from "../core/indicator-cache";
import type { BacktestOptions, Condition, NormalizedCandle } from "../types";
import type { OptimizationConstraint, OptimizationMetric } from "../types/optimization";
import { calculateAllMetrics, checkConstraint, getMetricValue } from "./metrics";

/**
 * Condition definition for combination search
 */
export type ConditionDefinition = {
  /** Unique identifier */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Factory function to create the condition */
  create: () => Condition;
  /** Category for grouping (optional) */
  category?: "trend" | "momentum" | "volume" | "volatility" | "pattern";
  /** Whether this is a filter (should not be used alone) */
  isFilter?: boolean;
};

/**
 * Combination search result entry
 */
export type CombinationResultEntry = {
  /** Entry condition names */
  entryConditions: string[];
  /** Exit condition names */
  exitConditions: string[];
  /** Combined entry condition display */
  entryDisplay: string;
  /** Combined exit condition display */
  exitDisplay: string;
  /** Score based on selected metric */
  score: number;
  /** All calculated metrics */
  metrics: Record<OptimizationMetric, number>;
  /** Full backtest result */
  backtest: import("../types").BacktestResult;
  /** Whether all constraints were satisfied */
  passedConstraints: boolean;
};

/**
 * Combination search result
 */
export type CombinationSearchResult = {
  /** Best combination found */
  bestEntry: string[];
  bestExit: string[];
  bestScore: number;
  /** Metric used for optimization */
  metric: OptimizationMetric;
  /** Total combinations tested */
  totalCombinations: number;
  /** Valid combinations (passed constraints) */
  validCombinations: number;
  /** All results sorted by score */
  results: CombinationResultEntry[];
};

/**
 * Options for combination search
 */
export type CombinationSearchOptions = {
  /** Metric to optimize (default: "sharpe") */
  metric?: OptimizationMetric;
  /** Constraints to filter results */
  constraints?: OptimizationConstraint[];
  /** Minimum conditions per entry (default: 1) */
  minEntryConditions?: number;
  /** Maximum conditions per entry (default: 4) */
  maxEntryConditions?: number;
  /** Minimum conditions per exit (default: 1) */
  minExitConditions?: number;
  /** Maximum conditions per exit (default: 3) */
  maxExitConditions?: number;
  /** Backtest options */
  backtestOptions?: BacktestOptions;
  /** Progress callback */
  progressCallback?: (current: number, total: number, currentCombo: string) => void;
  /** Maximum combinations to test (default: 50000) */
  maxCombinations?: number;
  /** Keep all results or only valid ones (default: false) */
  keepAllResults?: boolean;
  /** Use OR instead of AND for combining conditions */
  useOr?: boolean;
  /** Required exit condition names (always AND-combined with other exits) */
  requiredExitConditions?: string[];
  /** Required entry condition names (always AND-combined with other entries) */
  requiredEntryConditions?: string[];
};

/**
 * Generate all combinations of items with size between min and max
 */
export function generateCombinations<T>(items: T[], minSize: number, maxSize: number): T[][] {
  const result: T[][] = [];

  function combine(start: number, current: T[]): void {
    if (current.length >= minSize) {
      result.push([...current]);
    }
    if (current.length >= maxSize) return;

    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return result;
}

/**
 * Count total combinations
 */
export function countTotalCombinations(
  entryCount: number,
  exitCount: number,
  minEntry: number,
  maxEntry: number,
  minExit: number,
  maxExit: number,
): number {
  // C(n, k) = n! / (k! * (n-k)!)
  function combination(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = (result * (n - i)) / (i + 1);
    }
    return Math.round(result);
  }

  let entryTotal = 0;
  for (let k = minEntry; k <= maxEntry; k++) {
    entryTotal += combination(entryCount, k);
  }

  let exitTotal = 0;
  for (let k = minExit; k <= maxExit; k++) {
    exitTotal += combination(exitCount, k);
  }

  return entryTotal * exitTotal;
}

/**
 * Run combination search
 */
export function combinationSearch(
  candles: NormalizedCandle[],
  entryConditions: ConditionDefinition[],
  exitConditions: ConditionDefinition[],
  options: CombinationSearchOptions = {},
): CombinationSearchResult {
  const {
    metric = "sharpe",
    constraints = [],
    minEntryConditions = 1,
    maxEntryConditions = 4,
    minExitConditions = 1,
    maxExitConditions = 3,
    backtestOptions = { capital: 1000000 },
    progressCallback,
    maxCombinations = 50000,
    keepAllResults = false,
    useOr = false,
    requiredExitConditions = [],
    requiredEntryConditions = [],
  } = options;

  // Find required conditions in the pools
  const requiredEntryDefs = entryConditions.filter((c) => requiredEntryConditions.includes(c.name));
  const requiredExitDefs = exitConditions.filter((c) => requiredExitConditions.includes(c.name));

  // Remove required conditions from the search pool (they'll be added to every combo)
  const searchableEntryConditions = entryConditions.filter(
    (c) => !requiredEntryConditions.includes(c.name),
  );
  const searchableExitConditions = exitConditions.filter(
    (c) => !requiredExitConditions.includes(c.name),
  );

  // Adjust min conditions based on required conditions
  const adjustedMinEntry = Math.max(0, minEntryConditions - requiredEntryDefs.length);
  const adjustedMaxEntry = Math.max(0, maxEntryConditions - requiredEntryDefs.length);
  const adjustedMinExit = Math.max(0, minExitConditions - requiredExitDefs.length);
  const adjustedMaxExit = Math.max(0, maxExitConditions - requiredExitDefs.length);

  // Check total combinations (using searchable conditions)
  const totalCombinations = countTotalCombinations(
    searchableEntryConditions.length,
    searchableExitConditions.length,
    adjustedMinEntry,
    adjustedMaxEntry,
    adjustedMinExit,
    adjustedMaxExit,
  );

  if (totalCombinations > maxCombinations) {
    throw new Error(
      `Too many combinations (${totalCombinations}). Maximum allowed is ${maxCombinations}. Consider reducing condition pool or max conditions per combo.`,
    );
  }

  // Generate combinations from searchable conditions
  const entryCombos = generateCombinations(
    searchableEntryConditions,
    adjustedMinEntry,
    adjustedMaxEntry,
  );
  const exitCombos = generateCombinations(
    searchableExitConditions,
    adjustedMinExit,
    adjustedMaxExit,
  );

  // If no searchable entry/exit, create single empty combo to allow required-only
  if (entryCombos.length === 0 && requiredEntryDefs.length > 0) {
    entryCombos.push([]);
  }
  if (exitCombos.length === 0 && requiredExitDefs.length > 0) {
    exitCombos.push([]);
  }

  // Shared indicator cache across all backtest runs on same candle data
  const cache = new IndicatorCache();

  const results: CombinationResultEntry[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestEntry: string[] = [];
  let bestExit: string[] = [];
  let validCombinations = 0;
  let current = 0;

  const combiner = useOr ? or : and;

  // Test all combinations
  for (const entryCombo of entryCombos) {
    for (const exitCombo of exitCombos) {
      current++;

      // Combine with required conditions
      const fullEntryCombo = [...requiredEntryDefs, ...entryCombo];
      const fullExitCombo = [...requiredExitDefs, ...exitCombo];

      const entryNames = fullEntryCombo.map((c) => c.name);
      const exitNames = fullExitCombo.map((c) => c.name);
      const entryDisplay = fullEntryCombo.map((c) => c.displayName).join(" + ");
      const exitDisplay = fullExitCombo.map((c) => c.displayName).join(" + ");

      // Report progress
      if (progressCallback) {
        progressCallback(current, totalCombinations, `${entryDisplay} → ${exitDisplay}`);
      }

      try {
        // Search conditions: combine with useOr setting (and/or)
        const searchEntryConditions = entryCombo.map((c) => c.create());
        const searchExitConditions = exitCombo.map((c) => c.create());

        const searchEntry =
          searchEntryConditions.length === 0
            ? null
            : searchEntryConditions.length === 1
              ? searchEntryConditions[0]
              : combiner(...searchEntryConditions);
        const searchExit =
          searchExitConditions.length === 0
            ? null
            : searchExitConditions.length === 1
              ? searchExitConditions[0]
              : combiner(...searchExitConditions);

        // Required conditions: always AND
        const requiredEntry = requiredEntryDefs.map((c) => c.create());
        const requiredExit = requiredExitDefs.map((c) => c.create());

        // Final: required AND search
        const entryCondition =
          searchEntry === null
            ? and(...requiredEntry)
            : requiredEntry.length > 0
              ? and(...requiredEntry, searchEntry)
              : searchEntry;

        const exitCondition =
          searchExit === null
            ? and(...requiredExit)
            : requiredExit.length > 0
              ? and(...requiredExit, searchExit)
              : searchExit;

        // Run backtest with shared cache
        const backtest = runBacktest(
          candles,
          entryCondition,
          exitCondition,
          backtestOptions,
          cache,
        );

        // Skip if no trades
        if (backtest.tradeCount === 0) continue;

        // Calculate metrics
        const metrics = calculateAllMetrics(backtest, candles, {
          initialCapital: backtestOptions.capital,
        });

        // Check constraints
        const passedConstraints = constraints.every((c) =>
          checkConstraint(getMetricValue(metrics, c.metric), c.operator, c.value),
        );

        // Get target metric score
        const score = getMetricValue(metrics, metric);

        const entry: CombinationResultEntry = {
          entryConditions: entryNames,
          exitConditions: exitNames,
          entryDisplay,
          exitDisplay,
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
            bestEntry = entryNames;
            bestExit = exitNames;
          }
        }
      } catch (error) {
        // Skip failed combinations
        console.warn(`Skipping ${entryDisplay} → ${exitDisplay}: ${error}`);
      }
    }
  }

  // Sort results by score (descending)
  results.sort((a, b) => b.score - a.score);

  return {
    bestEntry,
    bestExit,
    bestScore: bestScore === Number.NEGATIVE_INFINITY ? 0 : bestScore,
    metric,
    totalCombinations,
    validCombinations,
    results,
  };
}
