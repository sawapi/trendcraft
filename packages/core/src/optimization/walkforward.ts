/**
 * Walk-Forward Analysis
 *
 * Rolling window optimization to validate parameter robustness
 * and prevent overfitting.
 */

import { runBacktest } from "../backtest";
import type { BacktestOptions, NormalizedCandle } from "../types";
import type {
  OptimizationConstraint,
  OptimizationMetric,
  ParameterRange,
  WalkForwardOptions,
  WalkForwardPeriod,
  WalkForwardResult,
} from "../types/optimization";
import { err, ok, type Result, tcError } from "../types/result";
import { DEFAULT_BACKTEST_CAPITAL } from "./constants";
import { generateParameterCombinations, gridSearch, type StrategyFactory } from "./grid-search";
import { assertOptimizerKeywords, calculateAllMetrics } from "./metrics";
import {
  aggregateInOutMetrics,
  assertNoOwnWarmup,
  validateWarmupBars,
  warmWindow,
} from "./walkforward-shared";

/**
 * Default options for walk-forward analysis
 */
const DEFAULT_OPTIONS: Required<
  Omit<WalkForwardOptions, "constraints" | "progressCallback" | "paramFilter">
> = {
  windowSize: 252, // ~1 year of daily data
  stepSize: 63, // ~1 quarter
  testSize: 63, // ~1 quarter
  purgeBars: 0, // adjacent train/test windows (no purge gap)
  metric: "sharpe",
  warmupBars: Number.POSITIVE_INFINITY, // all preceding history
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
  purgeBars = 0,
): number {
  const minDataNeeded = windowSize + purgeBars + testSize;
  if (totalCandles < minDataNeeded) return 0;

  return Math.floor((totalCandles - minDataNeeded) / stepSize) + 1;
}

/** Shared input guard for the boundary generators that accept purgeBars. */
export function validatePurgeBars(purgeBars: number): void {
  if (purgeBars < 0 || !Number.isInteger(purgeBars)) {
    throw new Error(`purgeBars must be a non-negative integer, got ${purgeBars}`);
  }
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
  const { windowSize, stepSize, testSize, purgeBars } = { ...DEFAULT_OPTIONS, ...options };
  validatePurgeBars(purgeBars);

  const boundaries: Array<{
    trainStart: number;
    trainEnd: number;
    testStart: number;
    testEnd: number;
  }> = [];

  let trainStart = 0;

  while (trainStart + windowSize + purgeBars + testSize <= candles.length) {
    const trainEnd = trainStart + windowSize - 1;
    // The purge gap stays out of BOTH windows: bars whose indicator
    // lookbacks or exit labels straddle the boundary can't inform training
    const testStart = trainEnd + 1 + purgeBars;
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
 * Wrap a strategy factory so every backtest it feeds treats the first
 * `warmupBars` candles as history only. The walk-forward owns the warm-up of
 * each window, so a factory that sets its own is rejected rather than
 * silently overridden.
 */
function withWarmup(createStrategy: StrategyFactory, warmupBars: number): StrategyFactory {
  return (params) => {
    const strategy = createStrategy(params);
    assertNoOwnWarmup(strategy.options);
    return {
      ...strategy,
      options: { capital: DEFAULT_BACKTEST_CAPITAL, ...strategy.options, warmupBars },
    };
  };
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
  const {
    windowSize,
    stepSize,
    testSize,
    purgeBars,
    metric,
    constraints,
    progressCallback,
    paramFilter,
    warmupBars,
  } = {
    ...DEFAULT_OPTIONS,
    constraints: [] as OptimizationConstraint[],
    ...options,
  };
  assertOptimizerKeywords("walkForwardAnalysis", { metric, constraints });

  // Generate period boundaries (validates purgeBars)
  const boundaries = generatePeriodBoundaries(candles, {
    windowSize,
    stepSize,
    testSize,
    purgeBars,
  });

  validateWarmupBars(warmupBars);

  if (boundaries.length === 0) {
    throw new Error(
      `Insufficient data for walk-forward analysis. Need at least ${windowSize + purgeBars + testSize} candles, got ${candles.length}.`,
    );
  }

  // Fallback params for windows where no combination passed constraints
  // (none traded / none scored finite in that window), so gridSearch
  // returned no best params. Without a `paramFilter`, raw range minima
  // are a fine "nothing optimized here" placeholder. With a `paramFilter`,
  // minima could themselves be a structurally-invalid combo (e.g.
  // `shortPeriod === longPeriod` when both ranges start at the same
  // value) — exactly the kind the optimizer is told to skip — so we use
  // the first combo the filter accepts instead. If the filter accepts
  // *no* combination at all (a fully-degenerate search space, e.g. every
  // goldenCross candidate has `shortPeriod >= longPeriod`), there is no
  // valid fallback: throwing surfaces the empty search space rather than
  // silently reporting a filtered-out combo as a window's best params.
  //
  // Resolved lazily and memoized: when a `paramFilter` is set this
  // enumerates the full grid, which must NOT happen before the per-window
  // `gridSearch` has had a chance to reject an oversized grid via its
  // `maxCombinations` guard. Because the fallback is only ever needed
  // *after* a window's `gridSearch` returned (i.e. the grid already
  // passed that ≤10000 cap), computing it on first use keeps the
  // fast-fail `TOO_MANY_COMBINATIONS` path intact and bounds the
  // enumeration.
  const minimaParams = parameterRanges.reduce(
    (acc, r) => {
      acc[r.name] = r.min;
      return acc;
    },
    {} as Record<string, number>,
  );
  // Probe the factory once up front. gridSearch catches factory errors per
  // combination and only warns, so a factory that sets its own warmupBars
  // would otherwise log a warning for every combination and burn a full grid
  // before the error surfaced. A factory that throws on the minima for its
  // own reasons is left to gridSearch, which handles that per combination.
  let probeOptions: BacktestOptions | undefined;
  try {
    probeOptions = createStrategy(minimaParams).options;
  } catch {
    probeOptions = undefined;
  }
  assertNoOwnWarmup(probeOptions);

  let resolvedFallback: Record<string, number> | null = null;
  const fallbackParams = (): Record<string, number> => {
    if (resolvedFallback === null) {
      if (!paramFilter) {
        resolvedFallback = minimaParams;
      } else {
        const firstValid = generateParameterCombinations(parameterRanges).find((c) =>
          paramFilter(c),
        );
        if (firstValid === undefined) {
          throw new Error(
            "Invalid parameter ranges: every combination in the search space is rejected by a cross-parameter constraint (e.g. shortPeriod < longPeriod)",
          );
        }
        resolvedFallback = firstValid;
      }
    }
    return resolvedFallback;
  };

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

    // Cut each window with the history in front of it, so indicators open
    // warm instead of going dark for their first lookback bars.
    const train = warmWindow(candles, boundary.trainStart, boundary.trainEnd, warmupBars);
    const test = warmWindow(candles, boundary.testStart, boundary.testEnd, warmupBars);

    // Optimize on training data
    const gridResult = gridSearch(
      train.candles,
      withWarmup(createStrategy, train.warmupBars),
      parameterRanges,
      {
        metric,
        constraints,
        maxCombinations: 10000,
        paramFilter,
      },
    );

    // Use best parameters or fall back to the lazily-resolved fallback (a
    // filter-valid combo when a paramFilter is set, else range minima).
    // When validCombinations > 0, gridSearch guarantees bestParams is
    // non-null, but TypeScript can't infer that across the boundary.
    const bestParams: Record<string, number> =
      gridResult.validCombinations > 0 && gridResult.bestParams !== null
        ? gridResult.bestParams
        : fallbackParams();

    // Run backtest on training data with best params
    const trainStrategy = createStrategy(bestParams);
    assertNoOwnWarmup(trainStrategy.options);
    const trainBacktest = runBacktest(train.candles, trainStrategy.entry, trainStrategy.exit, {
      capital: DEFAULT_BACKTEST_CAPITAL,
      ...trainStrategy.options,
      warmupBars: train.warmupBars,
    });
    const inSampleMetrics = calculateAllMetrics(trainBacktest, train.window);

    // Run backtest on test data with same params
    const testStrategy = createStrategy(bestParams);
    const testBacktest = runBacktest(test.candles, testStrategy.entry, testStrategy.exit, {
      capital: DEFAULT_BACKTEST_CAPITAL,
      ...testStrategy.options,
      warmupBars: test.warmupBars,
    });
    const outOfSampleMetrics = calculateAllMetrics(testBacktest, test.window);

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
  const aggregateMetrics = aggregateInOutMetrics(allInSampleMetrics, allOutOfSampleMetrics, metric);

  // Generate recommendation
  const recommendation = generateRecommendation(periods, aggregateMetrics, metric);

  return {
    periods,
    aggregateMetrics,
    recommendation,
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
