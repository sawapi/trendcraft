/**
 * Monte Carlo Simulation
 *
 * Resamples the trade list to estimate how reliable a backtest's
 * performance is. Two methods (see {@link MonteCarloOptions.method}):
 * - `"bootstrap"` (default): sample N trades with replacement, so total
 *   return / Sharpe / profit factor vary — used for outcome-uncertainty
 *   and probability-of-loss estimates.
 * - `"shuffle"`: permute the trade order, so only the path-dependent max
 *   drawdown varies — used for sequence-risk analysis.
 */

import { mulberry32 } from "../core/random";
import type { BacktestResult, Trade } from "../types";
import type { MetricStatistics, MonteCarloOptions, MonteCarloResult } from "../types/optimization";
import { err, ok, type Result, tcError } from "../types/result";

/**
 * Default options
 */
const DEFAULT_OPTIONS = {
  simulations: 1000,
  confidenceLevel: 0.95,
  method: "bootstrap",
  ruinThreshold: 50,
} as const;

/**
 * Fisher-Yates shuffle algorithm — permutes the array (no replacement).
 * The multiset of elements is preserved, so only order changes.
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
 * Bootstrap resample — draw `array.length` elements with replacement.
 * Unlike {@link shuffleArray}, the same element can be drawn multiple
 * times and others omitted, so the multiset of returns changes per
 * draw. This is what makes total return / Sharpe / profit factor vary
 * across simulations rather than staying pinned to the original.
 */
function bootstrapSample<T>(array: T[], random: () => number): T[] {
  const n = array.length;
  const result: T[] = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = array[Math.floor(random() * n)];
  }
  return result;
}

// Local already-sorted variant of the shared `percentile` utility.
// Callers here already sort once and reuse the sorted array across
// many percentile lookups, so paying a second sort inside the public
// `percentile()` would be wasteful. The interpolation algorithm
// matches the public utility; consolidating into one canonical
// algorithm so semantics stay aligned.
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
  const method = options.method ?? DEFAULT_OPTIONS.method;
  const ruinThreshold = options.ruinThreshold ?? DEFAULT_OPTIONS.ruinThreshold;
  const { progressCallback } = options;

  const trades = result.trades;
  const initialCapital = result.initialCapital;

  if (trades.length < 2) {
    throw new Error("Need at least 2 trades for Monte Carlo simulation");
  }

  // Create random generator
  const random = options.seed !== undefined ? mulberry32(options.seed) : Math.random;
  const resample = method === "shuffle" ? shuffleArray : bootstrapSample;

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

    // Resample trades (bootstrap with replacement, or order shuffle)
    const resampledTrades = resample(trades, random);

    // Recalculate metrics
    const metrics = recalculateMetricsFromTrades(resampledTrades, initialCapital);

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

  // Original result values — the backtest's own reported metrics, kept
  // as-is for display. They are NOT used as a baseline for the downside
  // figures: the resampler recomputes Sharpe with a per-trade formula
  // that differs from the backtest's candle-aware annualization, so
  // comparing the two would mix scales.
  const originalSharpe = result.sharpeRatio;
  const originalReturn = result.totalReturnPercent;
  const originalMaxDD = result.maxDrawdown;
  const originalPF = result.profitFactor;

  // Downside-risk figures, measured directly on the resampled outcomes
  // (no cross-formula comparison, no permutation-test framing):
  // - probLoss: fraction of simulations that lost money. Under "shuffle"
  //   the return multiset is fixed so this collapses to 0 or 1; it is
  //   only informative under "bootstrap".
  // - riskOfRuin: fraction whose path-dependent max drawdown reached the
  //   ruin threshold. Drawdown is path-dependent, so this is meaningful
  //   under both methods.
  const probLoss = returnValues.filter((v) => v <= 0).length / simulations;
  const probProfit = 1 - probLoss;
  const riskOfRuin = maxDrawdownValues.filter((dd) => dd >= ruinThreshold).length / simulations;

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

  // Assessment narrative is method-specific because the two resamplers
  // answer different questions. Bootstrap varies the outcome, so the
  // story is about profitability and ruin; shuffle leaves return
  // invariant and only moves the drawdown path, so the story is about
  // sequence risk. There is no binary significance flag — the figures
  // in `downside` are the verdict.
  let reason: string;
  if (method === "shuffle") {
    // How often a different ordering drew down deeper than the one
    // actually observed. Low = the observed path was already near the
    // worst case, so little drawdown is hidden by trade sequence.
    const worseDrawdownProb =
      maxDrawdownValues.filter((v) => v > originalMaxDD).length / simulations;
    const p95MaxDD = getPercentile(sortedMaxDD, 95);
    const worsePct = (worseDrawdownProb * 100).toFixed(0);
    reason = `${worsePct}% of ${simulations} orderings drew down deeper than the observed ${originalMaxDD.toFixed(1)}% (95th pct ${p95MaxDD.toFixed(1)}%, risk of ${ruinThreshold}%+ ruin ${(riskOfRuin * 100).toFixed(0)}%). Trade sequence ${worseDrawdownProb <= 1 - confidenceLevel ? "barely affects" : "materially affects"} drawdown risk.`;
  } else {
    // Bootstrap: report the resampled profitability and ruin tail.
    const profitablePct = (probProfit * 100).toFixed(0);
    reason = `${profitablePct}% of ${simulations} bootstrap resamples were profitable (p(loss)=${probLoss.toFixed(3)}, risk of ${ruinThreshold}%+ ruin ${(riskOfRuin * 100).toFixed(0)}%). ${probLoss < 1 - confidenceLevel ? "Downside tail is contained." : "Results are sensitive to which trades occur."}`;
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
    downside: {
      probProfit,
      probLoss,
      riskOfRuin,
      ruinThreshold,
    },
    confidenceInterval,
    assessment: {
      reason,
      confidenceLevel,
    },
  };
}

/**
 * Format Monte Carlo result for display
 */
export function formatMonteCarloResult(result: MonteCarloResult): string {
  const { originalResult, statistics, downside, confidenceInterval, assessment } = result;

  const lines = [
    "=== Monte Carlo Simulation Results ===",
    `Simulations: ${result.simulationCount}`,
    "",
    "Original vs Simulated:",
    `  Sharpe: ${originalResult.sharpe.toFixed(2)} (mean: ${statistics.sharpe.mean.toFixed(2)})`,
    `  Return: ${originalResult.totalReturnPercent.toFixed(2)}% (mean: ${statistics.totalReturnPercent.mean.toFixed(2)}%)`,
    `  Max DD: ${originalResult.maxDrawdown.toFixed(2)}% (mean: ${statistics.maxDrawdown.mean.toFixed(2)}%)`,
    "",
    "Downside risk:",
    `  P(profit): ${(downside.probProfit * 100).toFixed(1)}%  P(loss): ${(downside.probLoss * 100).toFixed(1)}%`,
    `  Risk of ruin (${downside.ruinThreshold}%+ drawdown): ${(downside.riskOfRuin * 100).toFixed(1)}%`,
    "",
    `${(assessment.confidenceLevel * 100).toFixed(0)}% Confidence Intervals:`,
    `  Sharpe: [${confidenceInterval.sharpe.lower.toFixed(2)}, ${confidenceInterval.sharpe.upper.toFixed(2)}]`,
    `  Return: [${confidenceInterval.returns.lower.toFixed(2)}%, ${confidenceInterval.returns.upper.toFixed(2)}%]`,
    "",
    "Assessment:",
    `  ${assessment.reason}`,
  ];

  return lines.join("\n");
}

/**
 * Summarize Monte Carlo result
 */
export function summarizeMonteCarloResult(result: MonteCarloResult): {
  probProfit: number;
  probLoss: number;
  riskOfRuin: number;
  expectedSharpe: { mean: number; median: number };
  sharpe95CI: { lower: number; upper: number };
  originalSharpe: number;
} {
  return {
    probProfit: result.downside.probProfit,
    probLoss: result.downside.probLoss,
    riskOfRuin: result.downside.riskOfRuin,
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
