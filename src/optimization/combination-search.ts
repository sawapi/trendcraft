/**
 * Combination Search
 *
 * Exhaustive search for optimal condition combinations.
 * Tests all possible AND combinations of entry/exit conditions.
 */

import type { BacktestOptions, Condition, NormalizedCandle } from "../types";
import type {
  GridSearchOptions,
  OptimizationConstraint,
  OptimizationMetric,
  OptimizationResultEntry,
} from "../types/optimization";
import { and, or } from "../backtest/conditions";
import { runBacktest } from "../backtest";
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
export function generateCombinations<T>(
  items: T[],
  minSize: number,
  maxSize: number,
): T[][] {
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
  const requiredEntryDefs = entryConditions.filter((c) =>
    requiredEntryConditions.includes(c.name),
  );
  const requiredExitDefs = exitConditions.filter((c) =>
    requiredExitConditions.includes(c.name),
  );

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
      `Too many combinations (${totalCombinations}). ` +
        `Maximum allowed is ${maxCombinations}. ` +
        `Consider reducing condition pool or max conditions per combo.`,
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

  const results: CombinationResultEntry[] = [];
  let bestScore = -Infinity;
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
        // Create combined conditions (always use AND for combining with required)
        const allEntryConditions = fullEntryCombo.map((c) => c.create());
        const allExitConditions = fullExitCombo.map((c) => c.create());

        const entryCondition =
          allEntryConditions.length === 1
            ? allEntryConditions[0]
            : and(...allEntryConditions);

        const exitCondition =
          allExitConditions.length === 1
            ? allExitConditions[0]
            : and(...allExitConditions);

        // Run backtest
        const backtest = runBacktest(
          candles,
          entryCondition,
          exitCondition,
          backtestOptions,
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
    bestScore: bestScore === -Infinity ? 0 : bestScore,
    metric,
    totalCombinations,
    validCombinations,
    results,
  };
}

/**
 * Get top N results from combination search
 */
export function getTopCombinations(
  result: CombinationSearchResult,
  n: number,
  onlyValid: boolean = true,
): CombinationResultEntry[] {
  const filtered = onlyValid
    ? result.results.filter((r) => r.passedConstraints)
    : result.results;

  return filtered.slice(0, n);
}

/**
 * Format combination result for display
 */
export function formatCombinationResult(entry: CombinationResultEntry): string {
  const lines = [
    `Entry: ${entry.entryDisplay}`,
    `Exit:  ${entry.exitDisplay}`,
    `---`,
    `Return: ${entry.metrics.returns.toFixed(2)}%`,
    `Win Rate: ${entry.metrics.winRate.toFixed(1)}%`,
    `Trades: ${entry.metrics.tradeCount}`,
    `Sharpe: ${entry.metrics.sharpe.toFixed(2)}`,
    `Max DD: ${entry.metrics.maxDrawdown.toFixed(2)}%`,
    `PF: ${entry.metrics.profitFactor.toFixed(2)}`,
  ];
  return lines.join("\n");
}

/**
 * Summarize combination search results
 */
export function summarizeCombinationSearch(result: CombinationSearchResult): {
  totalTested: number;
  validCount: number;
  validPercent: number;
  bestEntry: string;
  bestExit: string;
  bestScore: number;
  metric: OptimizationMetric;
} {
  return {
    totalTested: result.totalCombinations,
    validCount: result.validCombinations,
    validPercent: (result.validCombinations / result.totalCombinations) * 100,
    bestEntry: result.bestEntry.join(" + "),
    bestExit: result.bestExit.join(" + "),
    bestScore: result.bestScore,
    metric: result.metric,
  };
}

// ============================================
// Predefined Condition Pools
// ============================================

/**
 * Create standard entry condition pool
 *
 * Optimized based on 2025-12-25 Sony combination search analysis:
 * - Removed: RSI<30, RSI<40, Stoch<20, BB Lower (counter-trend, ineffective)
 * - Changed to filter-only: PO Bullish, PO+, Pullback (too strict, rarely fires)
 */
export function createEntryConditionPool(): ConditionDefinition[] {
  // Import conditions dynamically to avoid circular dependencies
  const conditions = require("../backtest/conditions");

  return [
    // Trend - Core signals
    {
      name: "gc",
      displayName: "Golden Cross",
      category: "trend",
      create: () => conditions.goldenCross(5, 25),
    },
    {
      name: "validatedGc",
      displayName: "Validated GC",
      category: "trend",
      create: () => conditions.validatedGoldenCross({ minScore: 50 }),
    },
    {
      name: "priceAboveSma75",
      displayName: "Price > SMA75",
      category: "trend",
      isFilter: true,
      create: () => conditions.priceAboveSma(75),
    },

    // Trend - Filter only (strict conditions)
    {
      name: "poBullish",
      displayName: "PO Bullish",
      category: "trend",
      isFilter: true, // Changed: too strict for standalone use
      create: () => conditions.perfectOrderActiveBullish({ periods: [5, 25, 75] }),
    },
    {
      name: "poPlus",
      displayName: "PO+",
      category: "trend",
      isFilter: true, // Changed: too strict for standalone use
      create: () => conditions.poPlusEntry(),
    },
    {
      name: "pb",
      displayName: "Pullback",
      category: "trend",
      isFilter: true, // Changed: too strict for standalone use
      create: () => conditions.pbEntry(),
    },

    // Momentum - Only trend-following signals
    {
      name: "macdCrossUp",
      displayName: "MACD Cross Up",
      category: "momentum",
      create: () => conditions.macdCrossUp(),
    },
    {
      name: "stochCrossUp",
      displayName: "Stoch Cross Up",
      category: "momentum",
      create: () => conditions.stochCrossUp(),
    },
    // REMOVED: rsiBelow30, rsiBelow40, stochOversold (counter-trend, ineffective)

    // Volume - All effective
    {
      name: "volAnomaly",
      displayName: "Vol Anomaly",
      category: "volume",
      create: () => conditions.volumeAnomalyCondition(2.0, 20),
    },
    {
      name: "volTrend",
      displayName: "Vol Confirms Trend",
      category: "volume",
      create: () => conditions.volumeConfirmsTrend(),
    },
    {
      name: "volAbove15",
      displayName: "Vol > 1.5x",
      category: "volume",
      isFilter: true,
      create: () => conditions.volumeRatioAbove(1.5, 20),
    },

    // Pattern
    {
      name: "rangeBreakout",
      displayName: "Range Breakout",
      category: "pattern",
      create: () => conditions.rangeBreakout(),
    },
    // REMOVED: bbLower (counter-trend, ineffective)

    // Volatility
    {
      name: "regimeNormal",
      displayName: "Normal Vol",
      category: "volatility",
      isFilter: true,
      create: () => conditions.regimeIs("normal"),
    },
    {
      name: "notHighVol",
      displayName: "Not High Vol",
      category: "volatility",
      isFilter: true,
      create: () => conditions.regimeNot("high"),
    },
  ];
}

/**
 * Create standard exit condition pool
 *
 * Optimized based on 2025-12-25 Sony combination search analysis:
 * - Removed: inRange (ambiguous trigger conditions, ineffective)
 * - Key finding: MACD↓ + VolDiv dominated top results
 */
export function createExitConditionPool(): ConditionDefinition[] {
  const conditions = require("../backtest/conditions");

  return [
    // Trend
    {
      name: "dc",
      displayName: "Dead Cross",
      category: "trend",
      create: () => conditions.deadCross(5, 25),
    },
    {
      name: "validatedDc",
      displayName: "Validated DC",
      category: "trend",
      create: () => conditions.validatedDeadCross({ minScore: 50 }),
    },
    {
      name: "poCollapsed",
      displayName: "PO Collapsed",
      category: "trend",
      create: () => conditions.perfectOrderCollapsed({ periods: [5, 25, 75] }),
    },
    {
      name: "poBreakdown",
      displayName: "PO Breakdown",
      category: "trend",
      create: () => conditions.perfectOrderBreakdown({ periods: [5, 25, 75] }),
    },

    // Momentum
    {
      name: "rsiAbove70",
      displayName: "RSI > 70",
      category: "momentum",
      create: () => conditions.rsiAbove(70),
    },
    {
      name: "rsiAbove60",
      displayName: "RSI > 60",
      category: "momentum",
      create: () => conditions.rsiAbove(60),
    },
    {
      name: "macdCrossDown",
      displayName: "MACD Cross Down",
      category: "momentum",
      create: () => conditions.macdCrossDown(),
    },
    {
      name: "stochOverbought",
      displayName: "Stoch > 80",
      category: "momentum",
      create: () => conditions.stochAbove(80),
    },
    {
      name: "stochCrossDown",
      displayName: "Stoch Cross Down",
      category: "momentum",
      create: () => conditions.stochCrossDown(),
    },

    // Pattern
    // REMOVED: inRange (ambiguous trigger, ineffective)
    {
      name: "rangeConfirmed",
      displayName: "Range Confirmed",
      category: "pattern",
      create: () => conditions.rangeConfirmed(),
    },
    {
      name: "bbUpper",
      displayName: "BB Upper Touch",
      category: "pattern",
      create: () => conditions.bollingerTouch("upper"),
    },

    // Volume
    {
      name: "volDivergence",
      displayName: "Vol Divergence",
      category: "volume",
      create: () => conditions.volumeDivergence(),
    },
  ];
}
