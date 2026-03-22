/**
 * Drawdown Analysis
 *
 * Analyzes drawdown periods from backtest results to provide
 * comprehensive drawdown statistics and insights.
 */

import type { DrawdownPeriod } from "../types";

/**
 * Summary statistics for drawdown periods
 */
export type DrawdownSummary = {
  /** Total number of drawdown periods */
  count: number;
  /** Average drawdown depth in percent */
  avgDepth: number;
  /** Maximum drawdown depth in percent */
  maxDepth: number;
  /** Average drawdown duration in bars */
  avgDurationBars: number;
  /** Maximum drawdown duration in bars */
  maxDurationBars: number;
  /** Average recovery time in bars (only recovered periods) */
  avgRecoveryBars: number;
  /** Maximum recovery time in bars (only recovered periods) */
  maxRecoveryBars: number;
  /** Percentage of drawdowns that recovered */
  recoveryRate: number;
  /** The worst drawdown period (deepest) */
  worstDrawdown: DrawdownPeriod | null;
  /** The longest recovery period */
  longestRecovery: DrawdownPeriod | null;
};

/**
 * Analyze drawdown periods to produce summary statistics
 *
 * @param periods - Array of drawdown periods from BacktestResult
 * @returns Summary statistics for drawdown analysis
 *
 * @example
 * ```ts
 * import { runBacktest, analyzeDrawdowns } from "trendcraft";
 *
 * const result = runBacktest(candles, entry, exit, options);
 * const summary = analyzeDrawdowns(result.drawdownPeriods);
 * console.log(`Worst drawdown: ${summary.maxDepth}%`);
 * console.log(`Avg recovery: ${summary.avgRecoveryBars} bars`);
 * ```
 */
export function analyzeDrawdowns(periods: DrawdownPeriod[]): DrawdownSummary {
  if (periods.length === 0) {
    return {
      count: 0,
      avgDepth: 0,
      maxDepth: 0,
      avgDurationBars: 0,
      maxDurationBars: 0,
      avgRecoveryBars: 0,
      maxRecoveryBars: 0,
      recoveryRate: 0,
      worstDrawdown: null,
      longestRecovery: null,
    };
  }

  const recovered = periods.filter((p) => p.recoveryTime !== undefined);

  let totalDepth = 0;
  let maxDepth = 0;
  let worstDrawdown: DrawdownPeriod = periods[0];
  let totalDuration = 0;
  let maxDuration = 0;

  for (const p of periods) {
    totalDepth += p.maxDepthPercent;
    totalDuration += p.durationBars;
    if (p.maxDepthPercent > maxDepth) {
      maxDepth = p.maxDepthPercent;
      worstDrawdown = p;
    }
    if (p.durationBars > maxDuration) {
      maxDuration = p.durationBars;
    }
  }

  let totalRecoveryBars = 0;
  let maxRecoveryBars = 0;
  let longestRecovery: DrawdownPeriod | null = null;

  for (const p of recovered) {
    const rb = p.recoveryBars ?? 0;
    totalRecoveryBars += rb;
    if (rb > maxRecoveryBars) {
      maxRecoveryBars = rb;
      longestRecovery = p;
    }
  }

  return {
    count: periods.length,
    avgDepth: Math.round((totalDepth / periods.length) * 100) / 100,
    maxDepth: Math.round(maxDepth * 100) / 100,
    avgDurationBars: Math.round((totalDuration / periods.length) * 100) / 100,
    maxDurationBars: maxDuration,
    avgRecoveryBars:
      recovered.length > 0 ? Math.round((totalRecoveryBars / recovered.length) * 100) / 100 : 0,
    maxRecoveryBars,
    recoveryRate: Math.round((recovered.length / periods.length) * 100 * 100) / 100,
    worstDrawdown,
    longestRecovery,
  };
}
