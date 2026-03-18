/**
 * Strategy Rotation
 *
 * Ranks multiple strategies by recent performance and allocates capital
 * proportionally to the best performers. Supports equal-weight, proportional,
 * and top-N allocation methods.
 *
 * @packageDocumentation
 */

import type { BacktestResult } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metric used for ranking strategies */
export type StrategyPerformanceMetric =
  | "returnPercent"
  | "sharpeRatio"
  | "profitFactor"
  | "winRate";

/** Options for strategy rotation */
export type StrategyRotationOptions = {
  /** Lookback window in number of trades for ranking (default: 20) */
  lookbackTrades?: number;
  /** Performance metric for ranking (default: 'returnPercent') */
  rankingMetric?: StrategyPerformanceMetric;
  /** Maximum number of strategies to allocate to (default: all) */
  maxActiveStrategies?: number;
  /** Minimum allocation per strategy (default: 0.05 = 5%) */
  minAllocation?: number;
  /** Allocation method (default: 'proportional') */
  allocationMethod?: "equal" | "proportional" | "topN";
};

/** Allocation for a single strategy */
export type StrategyAllocation = {
  /** Strategy index */
  strategyIndex: number;
  /** Allocation weight (0-1) */
  weight: number;
  /** Metric value used for ranking */
  metricValue: number;
};

/** Strategy rotation result */
export type StrategyRotationResult = {
  /** Current allocation */
  allocations: StrategyAllocation[];
  /** Number of active strategies */
  activeCount: number;
  /** Strategy rankings (best first, by index) */
  rankings: number[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeMetric(
  trades: { return: number; returnPercent: number }[],
  metric: StrategyPerformanceMetric,
): number {
  if (trades.length === 0) return 0;

  switch (metric) {
    case "returnPercent": {
      return trades.reduce((sum, t) => sum + t.returnPercent, 0);
    }
    case "winRate": {
      return trades.filter((t) => t.return > 0).length / trades.length;
    }
    case "profitFactor": {
      const gross = trades
        .filter((t) => t.return > 0)
        .reduce((s, t) => s + t.return, 0);
      const loss = Math.abs(
        trades.filter((t) => t.return <= 0).reduce((s, t) => s + t.return, 0),
      );
      if (loss > 0) return gross / loss;
      return gross > 0 ? Infinity : 0;
    }
    case "sharpeRatio": {
      const rets = trades.map((t) => t.returnPercent / 100);
      const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
      const variance =
        rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
      const std = Math.sqrt(variance);
      return std > 0 ? mean / std : 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Rotate allocation among multiple strategies based on recent performance.
 *
 * Takes an array of backtest results and ranks them by a chosen metric over
 * the most recent trades. Capital is allocated to the top performers using
 * the specified allocation method.
 *
 * @param results - Array of backtest results (one per strategy)
 * @param options - Rotation options
 * @returns Allocation weights and rankings
 *
 * @example
 * ```ts
 * import { runBacktest, rotateStrategies } from "trendcraft";
 *
 * const results = [resultA, resultB, resultC];
 * const rotation = rotateStrategies(results, {
 *   lookbackTrades: 20,
 *   rankingMetric: 'returnPercent',
 *   allocationMethod: 'proportional',
 * });
 * console.log(rotation.allocations);
 * // [{ strategyIndex: 1, weight: 0.55, ... }, { strategyIndex: 0, weight: 0.30, ... }, ...]
 * ```
 */
export function rotateStrategies(
  results: BacktestResult[],
  options: StrategyRotationOptions = {},
): StrategyRotationResult {
  const {
    lookbackTrades = 20,
    rankingMetric = "returnPercent",
    maxActiveStrategies = results.length,
    minAllocation = 0.05,
    allocationMethod = "proportional",
  } = options;

  if (results.length === 0) {
    return { allocations: [], activeCount: 0, rankings: [] };
  }

  // Calculate metric for each strategy using recent trades
  const metrics: { index: number; value: number }[] = results.map(
    (r, index) => {
      const recent = r.trades.slice(-lookbackTrades);
      return { index, value: computeMetric(recent, rankingMetric) };
    },
  );

  // Sort by metric descending
  metrics.sort((a, b) => b.value - a.value);

  const rankings = metrics.map((m) => m.index);
  const activeCount = Math.min(maxActiveStrategies, results.length);
  const active = metrics.slice(0, activeCount);

  // Allocate
  let allocations: StrategyAllocation[];

  switch (allocationMethod) {
    case "equal":
    case "topN": {
      const weight = 1 / activeCount;
      allocations = active.map((m) => ({
        strategyIndex: m.index,
        weight,
        metricValue: m.value,
      }));
      break;
    }

    case "proportional": {
      // Only allocate to strategies with positive metric values
      const positiveActive = active.filter((m) => m.value > 0);

      if (positiveActive.length === 0) {
        // Fall back to equal weight if no positive metrics
        const weight = 1 / activeCount;
        allocations = active.map((m) => ({
          strategyIndex: m.index,
          weight,
          metricValue: m.value,
        }));
      } else {
        const totalMetric = positiveActive.reduce((s, m) => s + m.value, 0);
        allocations = active.map((m) => ({
          strategyIndex: m.index,
          weight: m.value > 0 ? m.value / totalMetric : 0,
          metricValue: m.value,
        }));
      }
      break;
    }
  }

  // Enforce minimum allocation: remove strategies below minimum and redistribute
  if (minAllocation > 0 && allocations.length > 1) {
    const aboveMin = allocations.filter((a) => a.weight >= minAllocation);
    const belowMin = allocations.filter((a) => a.weight < minAllocation && a.weight > 0);

    if (belowMin.length > 0 && aboveMin.length > 0) {
      const redistributed = belowMin.reduce((s, a) => s + a.weight, 0);
      const aboveTotal = aboveMin.reduce((s, a) => s + a.weight, 0);

      allocations = aboveMin.map((a) => ({
        ...a,
        weight: a.weight + (a.weight / aboveTotal) * redistributed,
      }));

      // Add zero-weight entries for removed strategies
      for (const b of belowMin) {
        allocations.push({ ...b, weight: 0 });
      }
    }
  }

  // Normalize to sum to 1
  const totalWeight = allocations.reduce((s, a) => s + a.weight, 0);
  if (totalWeight > 0 && Math.abs(totalWeight - 1) > 1e-10) {
    allocations = allocations.map((a) => ({
      ...a,
      weight: a.weight / totalWeight,
    }));
  }

  // Sort by weight descending for output
  allocations.sort((a, b) => b.weight - a.weight);

  return {
    allocations,
    activeCount: allocations.filter((a) => a.weight > 0).length,
    rankings,
  };
}
