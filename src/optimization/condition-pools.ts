/**
 * Condition Pools & Combination Search Utilities
 *
 * Predefined condition pools for entry/exit strategies
 * and utility functions for working with combination search results.
 */

import type { NormalizedCandle } from "../types";
import type { OptimizationMetric } from "../types/optimization";
import { type Result, err, ok, tcError } from "../types/result";
import {
  type CombinationResultEntry,
  type CombinationSearchOptions,
  type CombinationSearchResult,
  type ConditionDefinition,
  combinationSearch,
} from "./combination-search";

/**
 * Get top N results from combination search
 */
export function getTopCombinations(
  result: CombinationSearchResult,
  n: number,
  onlyValid = true,
): CombinationResultEntry[] {
  const filtered = onlyValid ? result.results.filter((r) => r.passedConstraints) : result.results;

  return filtered.slice(0, n);
}

/**
 * Format combination result for display
 */
export function formatCombinationResult(entry: CombinationResultEntry): string {
  const lines = [
    `Entry: ${entry.entryDisplay}`,
    `Exit:  ${entry.exitDisplay}`,
    "---",
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

/**
 * Safe variant of combinationSearch that returns a Result instead of throwing.
 *
 * @example
 * ```ts
 * const result = combinationSearchSafe(candles, entryConditions, exitConditions);
 * if (result.ok) {
 *   console.log(result.value.bestEntry, result.value.bestExit);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function combinationSearchSafe(
  candles: NormalizedCandle[],
  entryConditions: ConditionDefinition[],
  exitConditions: ConditionDefinition[],
  options: CombinationSearchOptions = {},
): Result<CombinationSearchResult> {
  try {
    return ok(combinationSearch(candles, entryConditions, exitConditions, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("Too many combinations")
      ? ("TOO_MANY_COMBINATIONS" as const)
      : ("OPTIMIZATION_FAILED" as const);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
