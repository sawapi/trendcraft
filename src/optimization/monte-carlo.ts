/**
 * Monte Carlo Simulation
 *
 * Shuffles trade sequence to test robustness of backtest results.
 * Determines if performance is statistically significant vs random chance.
 */

import type { BacktestResult, Trade } from "../types";
import type { MetricStatistics, MonteCarloOptions, MonteCarloResult } from "../types/optimization";
import { type Result, err, ok, tcError } from "../types/result";

/**
 * Default options
 */
const DEFAULT_OPTIONS = {
  simulations: 1000,
  confidenceLevel: 0.95,
} as const;

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Simple seeded random number generator (Mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calculate percentile from sorted array using linear interpolation
 */
function getPercentile(sorted: number[], p: number): number {
  const n = sorted.length;
  const index = (p / 100) * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * Calculate statistics from array of values
 */
export function calculateStatistics(values: number[]): MetricStatistics {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      percentile5: 0,
      percentile25: 0,
      percentile75: 0,
      percentile95: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // Mean
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  // Standard deviation
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median: getPercentile(sorted, 50),
    stdDev,
    percentile5: getPercentile(sorted, 5),
    percentile25: getPercentile(sorted, 25),
    percentile75: getPercentile(sorted, 75),
    percentile95: getPercentile(sorted, 95),
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Recalculate metrics from shuffled trades
 */
function recalculateMetricsFromTrades(
  trades: Trade[],
  initialCapital: number,
): {
  sharpe: number;
  maxDrawdown: number;
  totalReturnPercent: number;
  profitFactor: number;
} {
  if (trades.length === 0) {
    return { sharpe: 0, maxDrawdown: 0, totalReturnPercent: 0, profitFactor: 0 };
  }

  // Rebuild equity curve from shuffled trades
  let capital = initialCapital;
  let peakCapital = initialCapital;
  let maxDrawdown = 0;
  const returns: number[] = [];

  for (const trade of trades) {
    // Apply trade return
    const returnAmount = capital * (trade.returnPercent / 100);
    capital += returnAmount;
    returns.push(trade.returnPercent / 100);

    // Track drawdown
    if (capital > peakCapital) {
      peakCapital = capital;
    }
    const drawdown = ((peakCapital - capital) / peakCapital) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Calculate Sharpe ratio from trade returns
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  // Annualize assuming average trade length (simplified)
  const sharpe =
    stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252 / Math.max(1, trades.length)) : 0;

  // Calculate profit factor
  const profits = trades.filter((t) => t.return > 0).reduce((sum, t) => sum + t.return, 0);
  const losses = Math.abs(
    trades.filter((t) => t.return <= 0).reduce((sum, t) => sum + t.return, 0),
  );
  const profitFactor = losses > 0 ? profits / losses : profits > 0 ? 999.99 : 0;

  const totalReturnPercent = ((capital - initialCapital) / initialCapital) * 100;

  return { sharpe, maxDrawdown, totalReturnPercent, profitFactor };
}

/**
 * Run Monte Carlo simulation on backtest results
 *
 * @param result Original backtest result
 * @param options Monte Carlo options
 * @returns Monte Carlo analysis result
 */
export function runMonteCarloSimulation(
  result: BacktestResult,
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const simulations = options.simulations ?? DEFAULT_OPTIONS.simulations;
  const confidenceLevel = options.confidenceLevel ?? DEFAULT_OPTIONS.confidenceLevel;
  const { progressCallback } = options;

  const trades = result.trades;
  const initialCapital = result.initialCapital;

  if (trades.length < 2) {
    throw new Error("Need at least 2 trades for Monte Carlo simulation");
  }

  // Create random generator
  const random = options.seed !== undefined ? createSeededRandom(options.seed) : Math.random;

  // Collect simulation results
  const sharpeValues: number[] = [];
  const maxDrawdownValues: number[] = [];
  const returnValues: number[] = [];
  const profitFactorValues: number[] = [];

  // Run simulations
  for (let i = 0; i < simulations; i++) {
    if (progressCallback) {
      progressCallback(i + 1, simulations);
    }

    // Shuffle trades
    const shuffledTrades = shuffleArray(trades, random);

    // Recalculate metrics
    const metrics = recalculateMetricsFromTrades(shuffledTrades, initialCapital);

    sharpeValues.push(metrics.sharpe);
    maxDrawdownValues.push(metrics.maxDrawdown);
    returnValues.push(metrics.totalReturnPercent);
    profitFactorValues.push(metrics.profitFactor);
  }

  // Calculate statistics
  const statistics = {
    sharpe: calculateStatistics(sharpeValues),
    maxDrawdown: calculateStatistics(maxDrawdownValues),
    totalReturnPercent: calculateStatistics(returnValues),
    profitFactor: calculateStatistics(profitFactorValues),
  };

  // Original result values
  const originalSharpe = result.sharpeRatio;
  const originalReturn = result.totalReturnPercent;
  const originalMaxDD = result.maxDrawdown;
  const originalPF = result.profitFactor;

  // Calculate p-values (probability of achieving >= original by chance)
  const pValueSharpe = sharpeValues.filter((v) => v >= originalSharpe).length / simulations;
  const pValueReturns = returnValues.filter((v) => v >= originalReturn).length / simulations;

  // Calculate confidence intervals
  const alpha = 1 - confidenceLevel;
  const lowerPercentilePct = (alpha / 2) * 100;
  const upperPercentilePct = (1 - alpha / 2) * 100;

  const sortedSharpe = [...sharpeValues].sort((a, b) => a - b);
  const sortedReturns = [...returnValues].sort((a, b) => a - b);
  const sortedMaxDD = [...maxDrawdownValues].sort((a, b) => a - b);

  const confidenceInterval = {
    sharpe: {
      lower: getPercentile(sortedSharpe, lowerPercentilePct),
      upper: getPercentile(sortedSharpe, upperPercentilePct),
    },
    returns: {
      lower: getPercentile(sortedReturns, lowerPercentilePct),
      upper: getPercentile(sortedReturns, upperPercentilePct),
    },
    maxDrawdown: {
      lower: getPercentile(sortedMaxDD, lowerPercentilePct),
      upper: getPercentile(sortedMaxDD, upperPercentilePct),
    },
  };

  // Assessment
  const isSignificant = pValueSharpe < 1 - confidenceLevel;
  let reason: string;
  if (isSignificant) {
    reason = `Original Sharpe (${originalSharpe.toFixed(2)}) exceeds ${(confidenceLevel * 100).toFixed(0)}% of random permutations (p=${pValueSharpe.toFixed(3)}). Strategy shows statistically significant edge.`;
  } else {
    reason = `Original Sharpe (${originalSharpe.toFixed(2)}) is within random distribution (p=${pValueSharpe.toFixed(3)}). Results may be due to lucky trade sequence.`;
  }

  return {
    originalResult: {
      sharpe: originalSharpe,
      maxDrawdown: originalMaxDD,
      totalReturnPercent: originalReturn,
      profitFactor: originalPF,
    },
    statistics,
    simulationCount: simulations,
    pValue: {
      sharpe: pValueSharpe,
      returns: pValueReturns,
    },
    confidenceInterval,
    assessment: {
      isSignificant,
      reason,
      confidenceLevel,
    },
  };
}

/**
 * Format Monte Carlo result for display
 */
export function formatMonteCarloResult(result: MonteCarloResult): string {
  const { originalResult, statistics, pValue, confidenceInterval, assessment } = result;

  const lines = [
    "=== Monte Carlo Simulation Results ===",
    `Simulations: ${result.simulationCount}`,
    "",
    "Original vs Simulated:",
    `  Sharpe: ${originalResult.sharpe.toFixed(2)} (mean: ${statistics.sharpe.mean.toFixed(2)}, p=${pValue.sharpe.toFixed(3)})`,
    `  Return: ${originalResult.totalReturnPercent.toFixed(2)}% (mean: ${statistics.totalReturnPercent.mean.toFixed(2)}%)`,
    `  Max DD: ${originalResult.maxDrawdown.toFixed(2)}% (mean: ${statistics.maxDrawdown.mean.toFixed(2)}%)`,
    "",
    `${(assessment.confidenceLevel * 100).toFixed(0)}% Confidence Intervals:`,
    `  Sharpe: [${confidenceInterval.sharpe.lower.toFixed(2)}, ${confidenceInterval.sharpe.upper.toFixed(2)}]`,
    `  Return: [${confidenceInterval.returns.lower.toFixed(2)}%, ${confidenceInterval.returns.upper.toFixed(2)}%]`,
    "",
    "Assessment:",
    `  ${assessment.isSignificant ? "SIGNIFICANT" : "NOT SIGNIFICANT"}`,
    `  ${assessment.reason}`,
  ];

  return lines.join("\n");
}

/**
 * Summarize Monte Carlo result
 */
export function summarizeMonteCarloResult(result: MonteCarloResult): {
  isSignificant: boolean;
  pValueSharpe: number;
  pValueReturns: number;
  expectedSharpe: { mean: number; median: number };
  sharpe95CI: { lower: number; upper: number };
  originalSharpe: number;
} {
  return {
    isSignificant: result.assessment.isSignificant,
    pValueSharpe: result.pValue.sharpe,
    pValueReturns: result.pValue.returns,
    expectedSharpe: {
      mean: result.statistics.sharpe.mean,
      median: result.statistics.sharpe.median,
    },
    sharpe95CI: result.confidenceInterval.sharpe,
    originalSharpe: result.originalResult.sharpe,
  };
}

/**
 * Safe variant of runMonteCarloSimulation that returns a Result instead of throwing.
 *
 * @example
 * ```ts
 * const result = runMonteCarloSimulationSafe(backtestResult);
 * if (result.ok) {
 *   console.log(result.value.assessment);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function runMonteCarloSimulationSafe(
  result: BacktestResult,
  options: MonteCarloOptions = {},
): Result<MonteCarloResult> {
  try {
    return ok(runMonteCarloSimulation(result, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("Need at least")
      ? ("INSUFFICIENT_DATA" as const)
      : ("COMPUTATION_FAILED" as const);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
