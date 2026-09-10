/**
 * Strategy Rotation
 *
 * Ranks multiple strategies by recent performance and allocates capital
 * proportionally to the best performers. Supports equal-weight, proportional,
 * and top-N allocation methods.
 *
 * @packageDocumentation
 */

import { profitFactorFromReturns } from "../analysis/return-metrics";
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
  /**
   * Metric value used for ranking. `Infinity` for a profit factor with no
   * losing trade in the lookback; `NaN` when the metric cannot be computed
   * (non-finite returns, an overflowing intermediate). Both serialize to
   * `null` in JSON.
   */
  metricValue: number;
};

/** Strategy rotation result */
export type StrategyRotationResult = {
  /** Current allocation */
  allocations: StrategyAllocation[];
  /** Number of strategies with `weight > 0` (can be fewer than `allocations.length`) */
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
      return profitFactorFromReturns(trades.map((t) => t.return));
    }
    case "sharpeRatio": {
      const rets = trades.map((t) => t.returnPercent / 100);
      const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
      const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
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
  const metrics: { index: number; value: number }[] = results.map((r, index) => {
    const recent = r.trades.slice(-lookbackTrades);
    return { index, value: computeMetric(recent, rankingMetric) };
  });

  // Sort by metric descending with an explicit comparison rather than
  // subtraction: `Infinity - Infinity` is NaN, which the sort treats as a tie
  // (input order kept, sort is stable), but a NaN *metric* (non-finite
  // returns, or an intermediate that overflowed) would then tie with
  // everything and land anywhere; it ranks last instead.
  const rank = (v: number) => (Number.isNaN(v) ? Number.NEGATIVE_INFINITY : v);
  metrics.sort((a, b) => {
    const av = rank(a.value);
    const bv = rank(b.value);
    return bv > av ? 1 : bv < av ? -1 : 0;
  });

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
        // Scale every positive metric by the largest one before summing, so
        // the total is finite (in [1, count]) even when the raw sum would
        // overflow. An infinite metric (a profit factor with no losing trade)
        // scales to 1 and every finite metric beside it to 0 — the limit of
        // "proportional": it takes everything, several share equally. Summing
        // the raw values instead gave `Infinity / Infinity = NaN` for the
        // leader and 0 for everyone else, which no downstream guard caught.
        // `metrics` is sorted descending and `positiveActive` keeps that
        // order, so the first entry is the largest (no spread: a spread over
        // a huge strategy list hits the engine's argument limit).
        const largest = positiveActive[0].value;
        const scaled = (v: number) =>
          v === Number.POSITIVE_INFINITY
            ? 1
            : v > 0 && largest < Number.POSITIVE_INFINITY
              ? v / largest
              : 0;
        const total = positiveActive.reduce((s, m) => s + scaled(m.value), 0);
        allocations = active.map((m) => ({
          strategyIndex: m.index,
          weight: scaled(m.value) / total,
          metricValue: m.value,
        }));
      }
      break;
    }
  }

  // Enforce minimum allocation: zero out strategies below the minimum and
  // hand their weight to the rest, pro rata. Mapped in place so that a
  // strategy which already had weight 0 keeps its row — rebuilding the array
  // from the two partitions dropped those rows whenever this branch fired.
  if (minAllocation > 0 && allocations.length > 1) {
    const isAbove = (a: StrategyAllocation) => a.weight >= minAllocation;
    const redistributed = allocations.reduce((s, a) => (isAbove(a) ? s : s + a.weight), 0);
    const aboveTotal = allocations.reduce((s, a) => (isAbove(a) ? s + a.weight : s), 0);

    if (redistributed > 0 && aboveTotal > 0) {
      // `Math.min(1, …)`: the pro-rata sum can land 1 ulp above 1.
      allocations = allocations.map((a) =>
        isAbove(a)
          ? { ...a, weight: Math.min(1, a.weight + (a.weight / aboveTotal) * redistributed) }
          : { ...a, weight: 0 },
      );
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
