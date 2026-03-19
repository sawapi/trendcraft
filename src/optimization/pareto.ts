/**
 * Pareto (Multi-Objective) Optimization — NSGA-II
 *
 * Finds the Pareto-optimal front for 2-4 objectives simultaneously,
 * using fast non-dominated sorting and crowding distance.
 */

import { runBacktest } from "../backtest";
import { IndicatorCache } from "../core/indicator-cache";
import type { BacktestOptions, NormalizedCandle } from "../types";
import type {
  OptimizationMetric,
  OptimizationResultEntry,
  ParetoObjective,
  ParetoOptions,
  ParetoResult,
  ParetoResultEntry,
  ParameterRange,
} from "../types/optimization";
import { type Result, err, ok, tcError } from "../types/result";
import { calculateAllMetrics, checkConstraint, getMetricValue } from "./metrics";
import {
  type StrategyFactory,
  generateParameterCombinations,
} from "./grid-search";

/**
 * Get the objective value, flipping sign for minimize objectives
 * so that "higher is better" universally.
 */
function getObjectiveValue(
  metrics: Record<OptimizationMetric, number>,
  objective: ParetoObjective,
): number {
  const raw = getMetricValue(metrics, objective.metric);
  return objective.direction === "minimize" ? -raw : raw;
}

/**
 * Check if solution `a` dominates solution `b`
 * (a is at least as good in all objectives and strictly better in at least one)
 */
function dominates(
  a: Record<OptimizationMetric, number>,
  b: Record<OptimizationMetric, number>,
  objectives: ParetoObjective[],
): boolean {
  let strictlyBetter = false;
  for (const obj of objectives) {
    const va = getObjectiveValue(a, obj);
    const vb = getObjectiveValue(b, obj);
    if (va < vb) return false; // a is worse in this objective
    if (va > vb) strictlyBetter = true;
  }
  return strictlyBetter;
}

/**
 * Fast Non-Dominated Sort (NSGA-II)
 *
 * Assigns each solution to a Pareto front (0 = best).
 * O(M·N²) where M = number of objectives, N = population size.
 *
 * @param entries - Solutions to sort
 * @param objectives - Optimization objectives
 * @returns Array of fronts, each containing indices into entries
 *
 * @example
 * ```ts
 * const fronts = fastNonDominatedSort(entries, [
 *   { metric: "sharpe", direction: "maximize" },
 *   { metric: "maxDrawdown", direction: "minimize" },
 * ]);
 * console.log(`First front has ${fronts[0].length} solutions`);
 * ```
 */
export function fastNonDominatedSort(
  entries: OptimizationResultEntry[],
  objectives: ParetoObjective[],
): number[][] {
  const n = entries.length;
  if (n === 0) return [];

  const dominationCount = new Array<number>(n).fill(0);
  const dominatedSets: number[][] = Array.from({ length: n }, () => []);
  const fronts: number[][] = [[]];

  // Calculate domination relationships
  for (let p = 0; p < n; p++) {
    for (let q = p + 1; q < n; q++) {
      if (dominates(entries[p].metrics, entries[q].metrics, objectives)) {
        dominatedSets[p].push(q);
        dominationCount[q]++;
      } else if (dominates(entries[q].metrics, entries[p].metrics, objectives)) {
        dominatedSets[q].push(p);
        dominationCount[p]++;
      }
    }
    if (dominationCount[p] === 0) {
      fronts[0].push(p);
    }
  }

  // Build subsequent fronts
  let currentFront = 0;
  while (currentFront < fronts.length && fronts[currentFront].length > 0) {
    const nextFront: number[] = [];
    for (const p of fronts[currentFront]) {
      for (const q of dominatedSets[p]) {
        dominationCount[q]--;
        if (dominationCount[q] === 0) {
          nextFront.push(q);
        }
      }
    }
    if (nextFront.length > 0) {
      fronts.push(nextFront);
    }
    currentFront++;
  }

  return fronts;
}

/**
 * Calculate crowding distance for solutions in a single front
 *
 * Measures how isolated a solution is in the objective space.
 * Higher distance = more isolated = more valuable for diversity.
 *
 * @param entries - All solutions
 * @param frontIndices - Indices of solutions in this front
 * @param objectives - Optimization objectives
 * @returns Map of index to crowding distance
 *
 * @example
 * ```ts
 * const distances = crowdingDistance(entries, fronts[0], objectives);
 * for (const [idx, dist] of distances) {
 *   console.log(`Solution ${idx}: crowding distance = ${dist}`);
 * }
 * ```
 */
export function crowdingDistance(
  entries: OptimizationResultEntry[],
  frontIndices: number[],
  objectives: ParetoObjective[],
): Map<number, number> {
  const distances = new Map<number, number>();
  const n = frontIndices.length;

  // Initialize distances
  for (const idx of frontIndices) {
    distances.set(idx, 0);
  }

  if (n <= 2) {
    // Boundary solutions get infinite distance
    for (const idx of frontIndices) {
      distances.set(idx, Infinity);
    }
    return distances;
  }

  // For each objective, sort and accumulate distances
  for (const obj of objectives) {
    // Sort front indices by this objective value
    const sorted = [...frontIndices].sort((a, b) => {
      const va = getObjectiveValue(entries[a].metrics, obj);
      const vb = getObjectiveValue(entries[b].metrics, obj);
      return va - vb;
    });

    // Boundary solutions get infinite distance
    distances.set(sorted[0], Infinity);
    distances.set(sorted[n - 1], Infinity);

    // Calculate range for normalization
    const minVal = getObjectiveValue(entries[sorted[0]].metrics, obj);
    const maxVal = getObjectiveValue(entries[sorted[n - 1]].metrics, obj);
    const range = maxVal - minVal;
    if (range === 0) continue;

    // Interior solutions: distance += normalized gap to neighbors
    for (let i = 1; i < n - 1; i++) {
      const prev = getObjectiveValue(entries[sorted[i - 1]].metrics, obj);
      const next = getObjectiveValue(entries[sorted[i + 1]].metrics, obj);
      const current = distances.get(sorted[i])!;
      if (current === Infinity) continue;
      distances.set(sorted[i], current + (next - prev) / range);
    }
  }

  return distances;
}

/**
 * Run Pareto multi-objective optimization
 *
 * Evaluates all parameter combinations, then applies NSGA-II
 * (fast non-dominated sort + crowding distance) to identify
 * the Pareto front — solutions where no objective can be improved
 * without worsening another.
 *
 * @param candles - Price data
 * @param createStrategy - Factory function creating strategy from parameters
 * @param paramRanges - Parameter ranges to search
 * @param options - Pareto optimization options
 * @returns ParetoResult with front assignments and crowding distances
 *
 * @example
 * ```ts
 * const result = paretoOptimization(candles, createStrategy, [
 *   param("rsiPeriod", 10, 20, 2),
 *   param("smaPeriod", 20, 50, 5),
 * ], {
 *   objectives: [
 *     { metric: "sharpe", direction: "maximize" },
 *     { metric: "maxDrawdown", direction: "minimize" },
 *   ],
 * });
 * console.log(`Pareto front: ${result.paretoFront.length} solutions`);
 * ```
 */
export function paretoOptimization(
  candles: NormalizedCandle[],
  createStrategy: StrategyFactory,
  paramRanges: ParameterRange[],
  options: ParetoOptions,
): ParetoResult {
  const {
    objectives,
    constraints = [],
    maxCombinations = 10000,
    progressCallback,
  } = options;

  if (objectives.length < 2 || objectives.length > 4) {
    throw new Error("Pareto optimization requires 2-4 objectives");
  }

  const combinations = generateParameterCombinations(paramRanges);

  if (combinations.length > maxCombinations) {
    throw new Error(
      `Too many combinations: ${combinations.length} > ${maxCombinations}. Reduce parameter ranges or increase maxCombinations.`,
    );
  }

  const cache = new IndicatorCache();

  // Evaluate all combinations
  const validEntries: OptimizationResultEntry[] = [];

  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    progressCallback?.(i + 1, combinations.length);

    try {
      const { entry, exit, options: btOptions } = createStrategy(params);
      const backtestOptions: BacktestOptions = {
        capital: 100000,
        ...btOptions,
      };
      const result = runBacktest(candles, entry, exit, backtestOptions, cache);

      const metrics = calculateAllMetrics(result, candles, {
        initialCapital: backtestOptions.capital,
      });

      // Check constraints
      const passedConstraints = constraints.every((c) =>
        checkConstraint(getMetricValue(metrics, c.metric), c.operator, c.value),
      );

      if (passedConstraints) {
        // Use first objective's metric value as the "score" for compatibility
        const score = getMetricValue(metrics, objectives[0].metric);
        validEntries.push({
          params,
          score,
          metrics,
          backtest: result,
          passedConstraints: true,
        });
      }
    } catch {
      // Skip invalid parameter combinations
    }
  }

  if (validEntries.length === 0) {
    return {
      paretoFront: [],
      allResults: [],
      objectives,
      totalCombinations: combinations.length,
      validCombinations: 0,
    };
  }

  // Run NSGA-II: non-dominated sort
  const fronts = fastNonDominatedSort(validEntries, objectives);

  // Assign front indices and crowding distances
  const paretoEntries: ParetoResultEntry[] = validEntries.map((e) => ({
    ...e,
    frontIndex: -1,
    crowdingDistance: 0,
  }));

  for (let fi = 0; fi < fronts.length; fi++) {
    const front = fronts[fi];

    // Assign front index
    for (const idx of front) {
      paretoEntries[idx].frontIndex = fi;
    }

    // Calculate crowding distances for this front
    const distances = crowdingDistance(validEntries, front, objectives);
    for (const [idx, dist] of distances) {
      paretoEntries[idx].crowdingDistance = dist;
    }
  }

  // Sort: front index ascending, then crowding distance descending
  paretoEntries.sort((a, b) => {
    if (a.frontIndex !== b.frontIndex) return a.frontIndex - b.frontIndex;
    // Higher crowding distance is preferred (more diverse)
    if (b.crowdingDistance !== a.crowdingDistance)
      return b.crowdingDistance - a.crowdingDistance;
    return 0;
  });

  // Extract Pareto front (front index 0)
  const paretoFront = paretoEntries.filter((e) => e.frontIndex === 0);

  return {
    paretoFront,
    allResults: paretoEntries,
    objectives,
    totalCombinations: combinations.length,
    validCombinations: validEntries.length,
  };
}

/**
 * Safe version of paretoOptimization that returns a Result type
 *
 * @example
 * ```ts
 * const result = paretoOptimizationSafe(candles, createStrategy, ranges, options);
 * if (result.ok) {
 *   console.log(result.value.paretoFront.length);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function paretoOptimizationSafe(
  candles: NormalizedCandle[],
  createStrategy: StrategyFactory,
  paramRanges: ParameterRange[],
  options: ParetoOptions,
): Result<ParetoResult> {
  try {
    return ok(
      paretoOptimization(candles, createStrategy, paramRanges, options),
    );
  } catch (e) {
    return err(
      tcError(
        "INVALID_PARAMS",
        e instanceof Error ? e.message : String(e),
        {},
        e instanceof Error ? e : undefined,
      ),
    );
  }
}

/**
 * Summarize Pareto optimization results as a formatted string
 *
 * @param result - Pareto optimization result
 * @returns Human-readable summary
 *
 * @example
 * ```ts
 * console.log(summarizeParetoResult(result));
 * ```
 */
export function summarizeParetoResult(result: ParetoResult): string {
  const lines: string[] = [];
  lines.push("=== Pareto Optimization Summary ===");
  lines.push(
    `Objectives: ${result.objectives.map((o) => `${o.metric} (${o.direction})`).join(", ")}`,
  );
  lines.push(`Total combinations: ${result.totalCombinations}`);
  lines.push(`Valid combinations: ${result.validCombinations}`);
  lines.push(`Pareto front size: ${result.paretoFront.length}`);
  lines.push("");

  if (result.paretoFront.length > 0) {
    lines.push("--- Pareto Front Solutions ---");
    const top = result.paretoFront.slice(0, 10);
    for (let i = 0; i < top.length; i++) {
      const entry = top[i];
      const objValues = result.objectives
        .map(
          (o) =>
            `${o.metric}=${getMetricValue(entry.metrics, o.metric).toFixed(4)}`,
        )
        .join(", ");
      const paramStr = Object.entries(entry.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      lines.push(
        `  #${i + 1}: ${objValues} | params: {${paramStr}} | crowding: ${entry.crowdingDistance === Infinity ? "\u221E" : entry.crowdingDistance.toFixed(4)}`,
      );
    }
  }

  return lines.join("\n");
}
