/**
 * Deep Drawdown Analysis
 *
 * Provides advanced drawdown analytics beyond basic period tracking:
 * - Distribution analysis with percentile statistics
 * - Conditional drawdown by market regime (volatility, trend)
 * - Recovery time estimation from historical patterns
 * - Ulcer Performance Index (risk-adjusted return metric)
 */

import { type AnnualizationOptions, annualizationFactor } from "../calendar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Drawdown distribution bin */
export type DrawdownBin = {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  frequency: number;
};

/** Drawdown distribution result */
export type DrawdownDistribution = {
  bins: DrawdownBin[];
  median: number;
  percentile95: number;
  percentile99: number;
};

/** Conditional drawdown by market condition */
export type ConditionalDrawdownResult = {
  /** Drawdowns during high volatility periods */
  highVolatility: { avgDepth: number; count: number; maxDepth: number };
  /** Drawdowns during low volatility periods */
  lowVolatility: { avgDepth: number; count: number; maxDepth: number };
  /** Drawdowns during trending markets */
  trending: { avgDepth: number; count: number; maxDepth: number };
  /** Drawdowns during ranging markets */
  ranging: { avgDepth: number; count: number; maxDepth: number };
};

/** Recovery time estimate */
export type RecoveryEstimate = {
  /** Estimated recovery time in bars based on historical drawdowns */
  estimatedBars: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Historical recovery times for similar depth drawdowns */
  historicalRecoveries: number[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the value at the given percentile (0-100) using linear interpolation. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

function conditionStats(depths: number[]): {
  avgDepth: number;
  count: number;
  maxDepth: number;
} {
  if (depths.length === 0) return { avgDepth: 0, count: 0, maxDepth: 0 };
  const sum = depths.reduce((a, b) => a + b, 0);
  return {
    avgDepth: sum / depths.length,
    count: depths.length,
    maxDepth: Math.max(...depths),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze the distribution of drawdown depths.
 *
 * Creates equal-width histogram bins and computes median, 95th and 99th
 * percentile statistics over the provided drawdown depths.
 *
 * @param drawdownDepths - Array of drawdown percentages (positive numbers)
 * @param numBins - Number of histogram bins (default 10)
 * @returns Distribution with bins and percentile statistics
 *
 * @example
 * ```ts
 * import { drawdownDistribution } from "trendcraft";
 *
 * const depths = [2, 5, 8, 3, 12, 1, 7, 4, 15, 6];
 * const dist = drawdownDistribution(depths);
 * console.log(`Median drawdown: ${dist.median}%`);
 * console.log(`95th percentile: ${dist.percentile95}%`);
 * ```
 */
export function drawdownDistribution(drawdownDepths: number[], numBins = 10): DrawdownDistribution {
  if (drawdownDepths.length === 0) {
    return {
      bins: [],
      median: 0,
      percentile95: 0,
      percentile99: 0,
    };
  }

  const sorted = [...drawdownDepths].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Build equal-width bins
  const binWidth = max === min ? 1 : (max - min) / numBins;
  const bins: DrawdownBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const rangeStart = min + i * binWidth;
    const rangeEnd = i === numBins - 1 ? max : min + (i + 1) * binWidth;
    bins.push({ rangeStart, rangeEnd, count: 0, frequency: 0 });
  }

  // Assign each depth to a bin
  for (const d of sorted) {
    let idx = max === min ? 0 : Math.floor((d - min) / binWidth);
    if (idx >= numBins) idx = numBins - 1;
    bins[idx].count++;
  }

  // Calculate frequencies
  const total = sorted.length;
  for (const bin of bins) {
    bin.frequency = bin.count / total;
  }

  return {
    bins,
    median: median(sorted),
    percentile95: percentile(sorted, 95),
    percentile99: percentile(sorted, 99),
  };
}

/**
 * Analyze drawdowns conditioned on market regime.
 *
 * Splits drawdown observations into four categories based on concurrent
 * volatility level (high/low relative to median) and market trend
 * (trending/ranging based on absolute return relative to median).
 *
 * @param returns - Array of period returns
 * @param drawdownDepths - Drawdown depth at each corresponding point
 * @param volatilities - Volatility measure at each corresponding point
 * @returns Drawdown statistics segmented by market condition
 *
 * @example
 * ```ts
 * import { conditionalDrawdown } from "trendcraft";
 *
 * const result = conditionalDrawdown(returns, drawdowns, volatilities);
 * console.log(`High-vol avg DD: ${result.highVolatility.avgDepth}%`);
 * console.log(`Trending avg DD: ${result.trending.avgDepth}%`);
 * ```
 */
export function conditionalDrawdown(
  returns: number[],
  drawdownDepths: number[],
  volatilities: number[],
): ConditionalDrawdownResult {
  const len = Math.min(returns.length, drawdownDepths.length, volatilities.length);

  if (len === 0) {
    const empty = { avgDepth: 0, count: 0, maxDepth: 0 };
    return {
      highVolatility: { ...empty },
      lowVolatility: { ...empty },
      trending: { ...empty },
      ranging: { ...empty },
    };
  }

  // Compute medians for classification
  const sortedVol = [...volatilities.slice(0, len)].sort((a, b) => a - b);
  const medianVol = median(sortedVol);

  const absReturns = returns.slice(0, len).map(Math.abs);
  const sortedAbsRet = [...absReturns].sort((a, b) => a - b);
  const medianAbsRet = median(sortedAbsRet);

  const highVolDepths: number[] = [];
  const lowVolDepths: number[] = [];
  const trendingDepths: number[] = [];
  const rangingDepths: number[] = [];

  for (let i = 0; i < len; i++) {
    const dd = drawdownDepths[i];
    if (dd === 0) continue; // skip non-drawdown bars

    if (volatilities[i] >= medianVol) {
      highVolDepths.push(dd);
    } else {
      lowVolDepths.push(dd);
    }

    if (absReturns[i] >= medianAbsRet) {
      trendingDepths.push(dd);
    } else {
      rangingDepths.push(dd);
    }
  }

  return {
    highVolatility: conditionStats(highVolDepths),
    lowVolatility: conditionStats(lowVolDepths),
    trending: conditionStats(trendingDepths),
    ranging: conditionStats(rangingDepths),
  };
}

/**
 * Estimate recovery time for a current drawdown based on historical patterns.
 *
 * Finds historical drawdowns within +/-50% of the current depth and averages
 * their recovery times. Confidence increases with the number of matching
 * historical drawdowns (capped at 1.0 with 5+ matches).
 *
 * @param currentDrawdown - Current drawdown depth (positive percentage)
 * @param historicalDrawdowns - Array of historical drawdown observations
 * @returns Estimated recovery time, confidence, and matching recoveries
 *
 * @example
 * ```ts
 * import { estimateRecoveryTime } from "trendcraft";
 *
 * const history = [
 *   { depth: 10, recoveryBars: 20 },
 *   { depth: 12, recoveryBars: 25 },
 *   { depth: 8, recoveryBars: 15 },
 * ];
 * const est = estimateRecoveryTime(11, history);
 * console.log(`Estimated recovery: ${est.estimatedBars} bars`);
 * console.log(`Confidence: ${(est.confidence * 100).toFixed(0)}%`);
 * ```
 */
export function estimateRecoveryTime(
  currentDrawdown: number,
  historicalDrawdowns: { depth: number; recoveryBars: number }[],
): RecoveryEstimate {
  if (historicalDrawdowns.length === 0 || currentDrawdown <= 0) {
    return { estimatedBars: 0, confidence: 0, historicalRecoveries: [] };
  }

  // Find drawdowns within +/-50% of current depth
  const lowerBound = currentDrawdown * 0.5;
  const upperBound = currentDrawdown * 1.5;

  const matches = historicalDrawdowns.filter((d) => d.depth >= lowerBound && d.depth <= upperBound);

  if (matches.length > 0) {
    const recoveries = matches.map((m) => m.recoveryBars);
    const avgBars = recoveries.reduce((a, b) => a + b, 0) / recoveries.length;
    return {
      estimatedBars: Math.round(avgBars),
      confidence: Math.min(1, matches.length / 5),
      historicalRecoveries: recoveries,
    };
  }

  // Fallback: use all drawdowns scaled by depth ratio
  const allRecoveries = historicalDrawdowns.map((d) => d.recoveryBars);
  const avgDepth =
    historicalDrawdowns.reduce((s, d) => s + d.depth, 0) / historicalDrawdowns.length;
  const depthRatio = avgDepth > 0 ? currentDrawdown / avgDepth : 1;
  const avgBars = allRecoveries.reduce((a, b) => a + b, 0) / allRecoveries.length;
  const scaled = Math.round(avgBars * depthRatio);

  return {
    estimatedBars: scaled,
    confidence: Math.min(1, historicalDrawdowns.length / 5) * 0.5,
    historicalRecoveries: allRecoveries,
  };
}

/**
 * Calculate the Ulcer Performance Index (UPI).
 *
 * The Ulcer Index measures downside volatility by computing the RMS of
 * percentage drawdowns from the running peak. The UPI divides annualised
 * excess return by the Ulcer Index, rewarding strategies that avoid deep
 * or prolonged drawdowns.
 *
 * @param equityCurve - Array of equity values over time
 * @param riskFreeRate - Annualised risk-free rate (default 0)
 * @returns Ulcer Performance Index value
 *
 * @example
 * ```ts
 * import { ulcerPerformanceIndex } from "trendcraft";
 *
 * const equity = [100, 102, 99, 101, 105, 103, 108];
 * const upi = ulcerPerformanceIndex(equity, 0.02);
 * console.log(`UPI: ${upi.toFixed(2)}`);
 * ```
 */
export function ulcerPerformanceIndex(
  equityCurve: number[],
  riskFreeRate = 0,
  annualizationOpts: AnnualizationOptions = {},
): number {
  if (equityCurve.length < 2) return 0;

  // Calculate percentage drawdowns from running peak
  let peak = equityCurve[0];
  let sumSqDD = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) peak = equityCurve[i];
    const dd = peak > 0 ? ((peak - equityCurve[i]) / peak) * 100 : 0;
    sumSqDD += dd * dd;
  }

  const ulcerIndex = Math.sqrt(sumSqDD / equityCurve.length);
  if (ulcerIndex === 0) return 0;

  // Annualised return using the configured trading-days-per-year (default: 252)
  const totalReturn = equityCurve[equityCurve.length - 1] / equityCurve[0] - 1;
  const n = equityCurve.length;
  const periodsPerYear = annualizationFactor(annualizationOpts);
  const annualReturn = (1 + totalReturn) ** (periodsPerYear / n) - 1;

  return (annualReturn - riskFreeRate) / (ulcerIndex / 100);
}
