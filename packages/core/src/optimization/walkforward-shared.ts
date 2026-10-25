/**
 * Pieces shared by rolling and anchored walk-forward: how a window is cut
 * from the series (with its warm-up history) and how per-period metrics are
 * aggregated.
 */

import type { NormalizedCandle } from "../types";
import type { OptimizationMetric } from "../types/optimization";

/**
 * A walk-forward window together with the history in front of it.
 * `candles` is `warmupBars` bars of history followed by the window itself;
 * `window` is the window alone, the span metrics are scored on.
 */
export type WarmWindow = {
  candles: NormalizedCandle[];
  warmupBars: number;
  window: NormalizedCandle[];
};

/**
 * Shared input guard for the walk-forward `warmupBars` option.
 * `Infinity` (the default) means "all available history".
 */
export function validateWarmupBars(warmupBars: number): void {
  if (!(warmupBars >= 0) || (Number.isFinite(warmupBars) && !Number.isInteger(warmupBars))) {
    throw new Error(`warmupBars must be a non-negative integer or Infinity, got ${warmupBars}`);
  }
}

/**
 * Walk-forward sets each window's `warmupBars` itself; a value supplied
 * through the strategy's or search's backtest options would be overridden,
 * so it is rejected with a pointer to the walk-forward option instead.
 */
export function assertNoOwnWarmup(options: { warmupBars?: number } | undefined): void {
  if (options?.warmupBars !== undefined) {
    throw new Error(
      "Set warmupBars on the walk-forward options, not on the backtest options: " +
        "walk-forward sets each window's warm-up itself.",
    );
  }
}

/**
 * Cut the window `[start, end]` out of `candles` together with up to
 * `maxWarmupBars` bars of preceding history.
 *
 * Slicing a window bare restarts every indicator inside it, so a lookback-L
 * rule cannot signal for its first L - 1 bars — a 200-bar trend filter sits
 * out 200 of a 252-bar test year, and the shorter the window the larger the
 * share lost. The history in front is strictly earlier than the window, so
 * using it is causal; the backtest's `warmupBars` keeps it out of trades and
 * metrics.
 *
 * @example
 * ```ts
 * const { candles: withHistory, warmupBars, window } = warmWindow(candles, 252, 314, Infinity);
 * const result = runBacktest(withHistory, entry, exit, { capital: 100_000, warmupBars });
 * const metrics = calculateAllMetrics(result, window);
 * ```
 */
export function warmWindow(
  candles: NormalizedCandle[],
  start: number,
  end: number,
  maxWarmupBars: number,
): WarmWindow {
  const from = Math.max(0, start - maxWarmupBars);
  return {
    candles: candles.slice(from, end + 1),
    warmupBars: start - from,
    window: candles.slice(start, end + 1),
  };
}

// A Record keyed by the union makes the compiler reject a missing metric: a
// key omitted from the averaging is never set, so aggregate[key] reads back
// undefined and any run optimised on it (e.g. "mar") silently collapses
// stabilityRatio to 0 and the recommendation to the pessimistic branch.
const METRIC_KEYS: Record<OptimizationMetric, true> = {
  sharpe: true,
  calmar: true,
  mar: true,
  profitFactor: true,
  recoveryFactor: true,
  returns: true,
  winRate: true,
  tradeCount: true,
  maxDrawdown: true,
};

/** Every {@link OptimizationMetric}, in a stable order. */
export const OPTIMIZATION_METRICS = /* @__PURE__ */ Object.keys(
  METRIC_KEYS,
) as OptimizationMetric[];

/**
 * Mean across only the finite entries; returns 0 when no finite
 * value exists. This is the right behavior for averaging optimization
 * metrics where NaN means "undefined for this period" (e.g. Calmar
 * with maxDD=0): treating NaN as 0 would silently bias the average,
 * dropping the period from the denominator preserves "no data" semantics.
 */
function averageFinite(values: number[]): number {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Average every metric across periods and derive the stability ratio of the
 * primary one. Shared by rolling and anchored walk-forward so the two cannot
 * drift apart again — the anchored copy had lost "mar" from its key list and
 * averaged NaN periods as 0.
 *
 * @example
 * ```ts
 * const inSample = {
 *   sharpe: 1.2, calmar: 0.8, mar: 0.7, profitFactor: 1.5, recoveryFactor: 2,
 *   returns: 12, winRate: 55, tradeCount: 40, maxDrawdown: 9,
 * };
 * const outOfSample = { ...inSample, sharpe: 0.6 };
 * const { stabilityRatio } = aggregateInOutMetrics([inSample], [outOfSample], "sharpe");
 * // stabilityRatio === 0.5
 * ```
 */
export function aggregateInOutMetrics(
  inSampleMetrics: Record<OptimizationMetric, number>[],
  outOfSampleMetrics: Record<OptimizationMetric, number>[],
  primaryMetric: OptimizationMetric,
): {
  avgInSample: Record<OptimizationMetric, number>;
  avgOutOfSample: Record<OptimizationMetric, number>;
  stabilityRatio: number;
} {
  // Calculate averages
  const avgInSample: Record<OptimizationMetric, number> = {} as Record<OptimizationMetric, number>;
  const avgOutOfSample: Record<OptimizationMetric, number> = {} as Record<
    OptimizationMetric,
    number
  >;

  // Average only across periods where the metric was actually
  // defined. Calmar / MAR / Recovery return NaN when a period had
  // maxDD <= 0; coercing those to 0 collapses the average toward 0
  // and makes `stabilityRatio` look perfect (avgIn === avgOut === 0
  // → branch returns 1), letting `generateRecommendation` endorse
  // params whose primary metric was never measurable. Excluding NaN
  // periods from the denominator preserves "no data" semantics.
  for (const key of OPTIMIZATION_METRICS) {
    avgInSample[key] = averageFinite(inSampleMetrics.map((m) => m[key]));
    avgOutOfSample[key] = averageFinite(outOfSampleMetrics.map((m) => m[key]));
  }

  // Calculate stability ratio for primary metric. If the primary
  // metric was undefined (NaN) on every in-sample or out-of-sample
  // period, `avgIn` / `avgOut` will be 0 (the "no data" sentinel
  // from `averageFinite`) — but that 0 has different meaning from a
  // measured 0. Distinguish by counting finite samples explicitly so
  // the absence-of-data case yields stabilityRatio = 0 (no claim of
  // stability) rather than the spurious 1 produced by the avgIn===0
  // branch below.
  const inFiniteCount = inSampleMetrics.filter((m) => Number.isFinite(m[primaryMetric])).length;
  const outFiniteCount = outOfSampleMetrics.filter((m) => Number.isFinite(m[primaryMetric])).length;
  const avgIn = avgInSample[primaryMetric];
  const avgOut = avgOutOfSample[primaryMetric];

  let stabilityRatio: number;
  if (inFiniteCount === 0 || outFiniteCount === 0) {
    // Primary metric never measurable on at least one side — cannot
    // make a stability claim either way.
    stabilityRatio = 0;
  } else if (avgIn === 0) {
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
