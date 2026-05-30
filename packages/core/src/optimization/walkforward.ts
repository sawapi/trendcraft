/**
 * Walk-Forward Analysis
 *
 * Rolling window optimization to validate parameter robustness
 * and prevent overfitting.
 */

import { runBacktest } from "../backtest";
import type { NormalizedCandle } from "../types";
import type {
  OptimizationConstraint,
  OptimizationMetric,
  ParameterRange,
  WalkForwardOptions,
  WalkForwardPeriod,
  WalkForwardResult,
} from "../types/optimization";
import { err, ok, type Result, tcError } from "../types/result";
import { gridSearch, type StrategyFactory } from "./grid-search";
import { calculateAllMetrics } from "./metrics";

/**
 * Default options for walk-forward analysis
 */
const DEFAULT_OPTIONS: Required<Omit<WalkForwardOptions, "constraints" | "progressCallback">> = {
  windowSize: 252, // ~1 year of daily data
  stepSize: 63, // ~1 quarter
  testSize: 63, // ~1 quarter
  metric: "sharpe",
};

/**
 * Calculate the number of walk-forward periods possible
 * @param totalCandles Total number of candles
 * @param windowSize Training window size
 * @param stepSize Step size between periods
 * @param testSize Test period size
 * @returns Number of periods
 */
export function calculatePeriodCount(
  totalCandles: number,
  windowSize: number,
  stepSize: number,
  testSize: number,
): number {
  const minDataNeeded = windowSize + testSize;
  if (totalCandles < minDataNeeded) return 0;

  return Math.floor((totalCandles - windowSize - testSize) / stepSize) + 1;
}

/**
 * Generate walk-forward period boundaries
 * @param candles Candle data
 * @param options Walk-forward options
 * @returns Array of period boundaries
 */
export function generatePeriodBoundaries(
  candles: NormalizedCandle[],
  options: WalkForwardOptions = {},
): Array<{
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
}> {
  const { windowSize, stepSize, testSize } = { ...DEFAULT_OPTIONS, ...options };

  const boundaries: Array<{
    trainStart: number;
    trainEnd: number;
    testStart: number;
    testEnd: number;
  }> = [];

  let trainStart = 0;

  while (trainStart + windowSize + testSize <= candles.length) {
    const trainEnd = trainStart + windowSize - 1;
    const testStart = trainEnd + 1;
    const testEnd = testStart + testSize - 1;

    boundaries.push({
      trainStart,
      trainEnd,
      testStart,
      testEnd,
    });

    trainStart += stepSize;
  }

  return boundaries;
}

/**
 * Run walk-forward analysis
 * @param candles Candle data
 * @param createStrategy Strategy factory function
 * @param parameterRanges Parameter ranges to optimize
 * @param options Walk-forward options
 * @returns Walk-forward analysis result
 */
export function walkForwardAnalysis(
  candles: NormalizedCandle[],
  createStrategy: StrategyFactory,
  parameterRanges: ParameterRange[],
  options: WalkForwardOptions = {},
): WalkForwardResult {
  const { windowSize, stepSize, testSize, metric, constraints, progressCallback } = {
    ...DEFAULT_OPTIONS,
    constraints: [] as OptimizationConstraint[],
    ...options,
  };

  // Generate period boundaries
  const boundaries = generatePeriodBoundaries(candles, {
    windowSize,
    stepSize,
    testSize,
  });

  if (boundaries.length === 0) {
    throw new Error(
      `Insufficient data for walk-forward analysis. Need at least ${windowSize + testSize} candles, got ${candles.length}.`,
    );
  }

  const periods: WalkForwardPeriod[] = [];
  const allInSampleMetrics: Record<OptimizationMetric, number>[] = [];
  const allOutOfSampleMetrics: Record<OptimizationMetric, number>[] = [];

  // Process each period
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];

    // Report progress
    if (progressCallback) {
      progressCallback(i + 1, boundaries.length);
    }

    // Extract train and test data
    const trainCandles = candles.slice(boundary.trainStart, boundary.trainEnd + 1);
    const testCandles = candles.slice(boundary.testStart, boundary.testEnd + 1);

    // Optimize on training data
    const gridResult = gridSearch(trainCandles, createStrategy, parameterRanges, {
      metric,
      constraints,
      maxCombinations: 10000,
    });

    // Use best parameters or fallback to range minima.
    // When validCombinations > 0, gridSearch guarantees bestParams is non-null,
    // but TypeScript can't infer that across the boundary, so assert here.
    const bestParams: Record<string, number> =
      gridResult.validCombinations > 0 && gridResult.bestParams !== null
        ? gridResult.bestParams
        : parameterRanges.reduce(
            (acc, r) => {
              acc[r.name] = r.min;
              return acc;
            },
            {} as Record<string, number>,
          );

    // Run backtest on training data with best params
    const trainStrategy = createStrategy(bestParams);
    const trainBacktest = runBacktest(trainCandles, trainStrategy.entry, trainStrategy.exit, {
      capital: 100000,
      ...trainStrategy.options,
    });
    const inSampleMetrics = calculateAllMetrics(trainBacktest, trainCandles);

    // Run backtest on test data with same params
    const testStrategy = createStrategy(bestParams);
    const testBacktest = runBacktest(testCandles, testStrategy.entry, testStrategy.exit, {
      capital: 100000,
      ...testStrategy.options,
    });
    const outOfSampleMetrics = calculateAllMetrics(testBacktest, testCandles);

    // Record period result
    periods.push({
      trainStart: candles[boundary.trainStart].time,
      trainEnd: candles[boundary.trainEnd].time,
      testStart: candles[boundary.testStart].time,
      testEnd: candles[boundary.testEnd].time,
      bestParams,
      inSampleMetrics,
      outOfSampleMetrics,
      testBacktest,
    });

    allInSampleMetrics.push(inSampleMetrics);
    allOutOfSampleMetrics.push(outOfSampleMetrics);
  }

  // Calculate aggregate metrics
  const aggregateMetrics = calculateAggregateMetrics(
    allInSampleMetrics,
    allOutOfSampleMetrics,
    metric,
  );

  // Generate recommendation
  const recommendation = generateRecommendation(periods, aggregateMetrics, metric);

  return {
    periods,
    aggregateMetrics,
    recommendation,
  };
}

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
 * Calculate aggregate metrics across all periods
 */
function calculateAggregateMetrics(
  inSampleMetrics: Record<OptimizationMetric, number>[],
  outOfSampleMetrics: Record<OptimizationMetric, number>[],
  primaryMetric: OptimizationMetric,
): WalkForwardResult["aggregateMetrics"] {
  const metricKeys: OptimizationMetric[] = [
    "sharpe",
    "calmar",
    "profitFactor",
    "recoveryFactor",
    "returns",
    "winRate",
    "tradeCount",
    "maxDrawdown",
  ];

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
  for (const key of metricKeys) {
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

/**
 * Generate recommendation based on walk-forward results
 */
function generateRecommendation(
  periods: WalkForwardPeriod[],
  aggregateMetrics: WalkForwardResult["aggregateMetrics"],
  metric: OptimizationMetric,
): WalkForwardResult["recommendation"] {
  const { avgInSample, avgOutOfSample, stabilityRatio } = aggregateMetrics;

  // Count profitable out-of-sample periods
  const profitablePeriods = periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;
  const profitableRatio = periods.length > 0 ? profitablePeriods / periods.length : 0;

  // Analyze parameter stability
  const paramKeys = Object.keys(periods[0]?.bestParams || {});
  const paramVariance: Record<string, number> = {};

  for (const key of paramKeys) {
    const values = periods.map((p) => p.bestParams[key]);
    if (values.length === 0) {
      paramVariance[key] = 0;
      continue;
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    paramVariance[key] = variance;
  }

  // Calculate suggested params (most common or median)
  const suggestedParams: Record<string, number> = {};
  for (const key of paramKeys) {
    const values = periods.map((p) => p.bestParams[key]).sort((a, b) => a - b);
    suggestedParams[key] = values[Math.floor(values.length / 2)]; // Median
  }

  // Decision logic
  const _inSampleValue = avgInSample[metric];
  const outOfSampleValue = avgOutOfSample[metric];

  // Good: stability ratio > 0.5, profitable > 60%, out-of-sample positive
  if (stabilityRatio >= 0.5 && profitableRatio >= 0.6 && outOfSampleValue > 0) {
    return {
      useOptimizedParams: true,
      reason: `Strong out-of-sample performance (${(stabilityRatio * 100).toFixed(1)}% stability, ${(profitableRatio * 100).toFixed(0)}% profitable periods)`,
      suggestedParams,
    };
  }

  // Moderate: stability ratio > 0.3, profitable > 50%
  if (stabilityRatio >= 0.3 && profitableRatio >= 0.5) {
    return {
      useOptimizedParams: true,
      reason: `Moderate stability (${(stabilityRatio * 100).toFixed(1)}%). Consider using conservative parameters.`,
      suggestedParams,
    };
  }

  // Weak: some profit but low stability
  if (profitableRatio > 0.4) {
    return {
      useOptimizedParams: false,
      reason: `Low stability (${(stabilityRatio * 100).toFixed(1)}%). Optimization may be overfitting to historical data.`,
    };
  }

  // Poor: negative out-of-sample or very low profitability
  return {
    useOptimizedParams: false,
    reason: `Poor out-of-sample performance (${(profitableRatio * 100).toFixed(0)}% profitable). Strategy may not be robust.`,
  };
}

/**
 * Get summary statistics from walk-forward result
 * @param result Walk-forward result
 * @returns Summary object
 */
export function summarizeWalkForward(result: WalkForwardResult): {
  periodCount: number;
  avgInSampleReturn: number;
  avgOutOfSampleReturn: number;
  stabilityRatio: number;
  profitablePeriods: number;
  recommendation: string;
} {
  const profitablePeriods = result.periods.filter((p) => p.outOfSampleMetrics.returns > 0).length;

  return {
    periodCount: result.periods.length,
    avgInSampleReturn: result.aggregateMetrics.avgInSample.returns,
    avgOutOfSampleReturn: result.aggregateMetrics.avgOutOfSample.returns,
    stabilityRatio: result.aggregateMetrics.stabilityRatio,
    profitablePeriods,
    recommendation: result.recommendation.reason,
  };
}

/**
 * Export combined out-of-sample equity curve
 * @param result Walk-forward result
 * @param initialCapital Initial capital
 * @returns Equity curve as array of {time, equity}
 */
export function getOutOfSampleEquityCurve(
  result: WalkForwardResult,
  initialCapital = 100000,
): Array<{ time: number; equity: number }> {
  const curve: Array<{ time: number; equity: number }> = [];
  let equity = initialCapital;

  for (const period of result.periods) {
    // Apply the return from this period
    const returnPercent = period.outOfSampleMetrics.returns;
    const returnAmount = equity * (returnPercent / 100);
    equity += returnAmount;

    curve.push({
      time: period.testEnd,
      equity,
    });
  }

  return curve;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Annualize a total return (in percent) over a calendar span.
 * Returns `NaN` when the span is non-positive.
 */
function annualizeByCalendar(totalReturnPercent: number, startMs: number, endMs: number): number {
  const years = (endMs - startMs) / MS_PER_YEAR;
  if (!(years > 0)) return Number.NaN;
  const total = totalReturnPercent / 100;
  // A loss beyond -100% is not representable; clamp like `annualizeReturn`.
  if (total <= -1) return -100;
  return ((1 + total) ** (1 / years) - 1) * 100;
}

/**
 * Walk-Forward Efficiency (WFE) — Pardo's measure of how well a
 * strategy's in-sample optimization carries to out-of-sample data.
 *
 * For each period, WFE = (annualized out-of-sample return) /
 * (annualized in-sample return). The training and test windows usually
 * differ in length, so both returns are annualized over their calendar
 * span before the ratio. The result is the **average per-period WFE**.
 *
 * A WFE of 1.0 means out-of-sample matched the optimized in-sample
 * result; Pardo treats ≥ 0.5 (50–60%) as the threshold for a genuinely
 * robust strategy rather than a curve-fit one. WFE is not capped — an
 * out-of-sample result that beats in-sample yields > 1.0. (This is
 * distinct from `aggregateMetrics.stabilityRatio`, which is capped at 1
 * and computed on the primary optimization metric rather than on
 * annualized return.)
 *
 * Periods whose in-sample annualized return is ≤ 0 are skipped: walk-
 * forward efficiency is undefined when the strategy wasn't even
 * profitable in-sample, since the ratio's sign and magnitude would be
 * meaningless. Returns `NaN` when no period has a positive in-sample
 * return, matching the `calculateCalmarRatio` "undefined" convention.
 *
 * @param result Walk-forward analysis result
 * @returns Average per-period walk-forward efficiency, or `NaN` when undefined
 * @example
 * ```ts
 * import { walkForwardAnalysis, wfeRatio } from "trendcraft";
 *
 * const wf = walkForwardAnalysis(candles, createStrategy, ranges);
 * const wfe = wfeRatio(wf);
 * if (Number.isFinite(wfe) && wfe >= 0.5) {
 *   console.log(`Robust: WFE ${(wfe * 100).toFixed(0)}%`);
 * }
 * ```
 */
export function wfeRatio(result: WalkForwardResult): number {
  const ratios: number[] = [];
  for (const p of result.periods) {
    const isAnn = annualizeByCalendar(p.inSampleMetrics.returns, p.trainStart, p.trainEnd);
    const oosAnn = annualizeByCalendar(p.outOfSampleMetrics.returns, p.testStart, p.testEnd);
    if (Number.isFinite(isAnn) && isAnn > 0 && Number.isFinite(oosAnn)) {
      ratios.push(oosAnn / isAnn);
    }
  }
  if (ratios.length === 0) return Number.NaN;
  return ratios.reduce((s, v) => s + v, 0) / ratios.length;
}

/**
 * Stitch the out-of-sample trades from every walk-forward period into a
 * single continuous equity curve, one point per trade.
 *
 * {@link getOutOfSampleEquityCurve} emits one point per *period* (the
 * compounded period return at each `testEnd`). This finer variant walks
 * every period's out-of-sample trades in chronological order and
 * compounds each trade's return, so the curve shows the intra-period
 * path — the canonical "stitched OOS equity" used to visualize walk-
 * forward robustness. Points are placed at trade exits, the finest
 * granularity the walk-forward result carries (per-candle marks are not
 * retained on the period backtests).
 *
 * Each trade is compounded against the running equity
 * (`equity *= 1 + returnPercent/100`), matching the full-capital
 * trade-compounding convention used elsewhere in the library (e.g. the
 * Monte Carlo resampler). A leading anchor point at the first period's
 * `testStart` with the initial capital starts the curve.
 *
 * Trades from every period are merged and sorted globally by exit time
 * before compounding, so the curve stays chronological even when test
 * windows overlap (`stepSize < testSize`). Note that overlapping windows
 * test the same span more than once, so the shared trades are
 * double-counted — the same caveat that applies to the period-level
 * {@link getOutOfSampleEquityCurve}. Use non-overlapping windows
 * (`stepSize === testSize`, the default) for a clean stitched curve.
 *
 * @param result Walk-forward analysis result
 * @param initialCapital Starting capital (default 100000)
 * @returns Equity curve as `{ time, equity }` — one leading anchor plus one point per out-of-sample trade
 * @example
 * ```ts
 * import { walkForwardAnalysis, stitchOosEquity } from "trendcraft";
 *
 * const wf = walkForwardAnalysis(candles, createStrategy, ranges);
 * const curve = stitchOosEquity(wf, 100_000);
 * // curve[curve.length - 1].equity → final stitched out-of-sample equity
 * ```
 */
export function stitchOosEquity(
  result: WalkForwardResult,
  initialCapital = 100000,
): Array<{ time: number; equity: number }> {
  const curve: Array<{ time: number; equity: number }> = [];
  let equity = initialCapital;

  const firstPeriod = result.periods[0];
  if (firstPeriod) {
    curve.push({ time: firstPeriod.testStart, equity });
  }

  // Merge every period's out-of-sample trades and sort by exit time
  // globally. Sorting per period would leave the curve non-chronological
  // when test windows overlap (a later period can hold trades that
  // exited before the previous period's last trade).
  const trades = result.periods
    .flatMap((period) => period.testBacktest.trades)
    .sort((a, b) => a.exitTime - b.exitTime);
  for (const trade of trades) {
    equity += equity * (trade.returnPercent / 100);
    curve.push({ time: trade.exitTime, equity });
  }

  return curve;
}

/**
 * Safe variant of walkForwardAnalysis that returns a Result instead of throwing.
 *
 * @example
 * ```ts
 * const result = walkForwardAnalysisSafe(candles, createStrategy, parameterRanges);
 * if (result.ok) {
 *   console.log(result.value.recommendation);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function walkForwardAnalysisSafe(
  candles: NormalizedCandle[],
  createStrategy: StrategyFactory,
  parameterRanges: ParameterRange[],
  options: WalkForwardOptions = {},
): Result<WalkForwardResult> {
  try {
    return ok(walkForwardAnalysis(candles, createStrategy, parameterRanges, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("Insufficient data")
      ? ("INSUFFICIENT_DATA" as const)
      : ("OPTIMIZATION_FAILED" as const);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
