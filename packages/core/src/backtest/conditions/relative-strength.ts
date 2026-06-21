/**
 * Relative Strength (RS) Backtest Conditions
 *
 * Conditions for comparing stock performance against a benchmark.
 * Pass the benchmark candles via the `benchmark` backtest option — the engine
 * seeds them so these conditions can compute RS.
 *
 * @example
 * ```ts
 * import { runBacktest, rsAbove, rsBelow } from "trendcraft";
 *
 * const result = runBacktest(candles, rsAbove(1.0), rsBelow(0.8), {
 *   capital: 1_000_000,
 *   benchmark: sp500Candles,
 * });
 * ```
 */

import type { RSValue } from "../../indicators/relative-strength/benchmark-rs";
import { benchmarkRS } from "../../indicators/relative-strength/benchmark-rs";
import type { Candle, NormalizedCandle, PresetCondition, Series } from "../../types";

const BENCHMARK_KEY = "__benchmarkCandles";
const RS_CACHE_PREFIX = "rs_";

/**
 * Stable per-array identity for benchmark candles. The RS cache key embeds this
 * id so that reusing a shared `IndicatorCache` across runs with *different*
 * benchmarks (same candles) does not return RS data computed against the
 * previous benchmark. The same benchmark array always maps to the same id, so
 * the cache still hits across runs that share a benchmark.
 */
const benchmarkIds = new WeakMap<object, number>();
let nextBenchmarkId = 0;
function benchmarkId(benchmark: object): number {
  let id = benchmarkIds.get(benchmark);
  if (id === undefined) {
    id = nextBenchmarkId++;
    benchmarkIds.set(benchmark, id);
  }
  return id;
}

/**
 * Options for RS conditions
 */
export interface RSConditionOptions {
  /** Period for RS calculation (default: 52) */
  period?: number;
  /** SMA period for Mansfield RS (default: 52) */
  smaPeriod?: number;
}

/**
 * Get cached RS data or calculate it
 */
function getRSData(
  indicators: Record<string, unknown>,
  candles: (Candle | NormalizedCandle)[],
  options: RSConditionOptions = {},
): Series<RSValue> | null {
  const { period = 52, smaPeriod = 52 } = options;

  const benchmark = indicators[BENCHMARK_KEY] as (Candle | NormalizedCandle)[] | undefined;
  if (!benchmark?.length) return null;

  // Cache key includes the benchmark identity so changing benchmark (with the
  // same candles + shared cache) recomputes instead of returning stale RS data.
  const cacheKey = `${RS_CACHE_PREFIX}${benchmarkId(benchmark)}_${period}_${smaPeriod}`;

  const cached = indicators[cacheKey] as Series<RSValue> | undefined;
  if (cached) return cached;

  const rsData = benchmarkRS(candles, benchmark, { period, smaPeriod });
  indicators[cacheKey] = rsData;

  return rsData;
}

/**
 * Get RS value at the given index, accounting for offset between RS data and candles
 */
function getRSValueAtIndex(
  rsData: Series<RSValue>,
  candlesLength: number,
  index: number,
): RSValue | null {
  const offset = candlesLength - rsData.length;
  const rsIndex = index - offset;

  if (rsIndex < 0 || rsIndex >= rsData.length) return null;

  return rsData[rsIndex]?.value ?? null;
}

// ============================================
// RS Ratio Conditions
// ============================================

/**
 * RS ratio above threshold
 *
 * RS > 1.0 means outperforming benchmark
 *
 * @param threshold - RS threshold (default: 1.0)
 * @param options - RS calculation options
 *
 * @example
 * ```ts
 * // Enter when outperforming benchmark by 5%
 * const entry = rsAbove(1.05);
 * ```
 */
export function rsAbove(threshold = 1.0, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `rsAbove(${threshold})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value !== null && value.rs > threshold;
    },
  };
}

/**
 * RS ratio below threshold
 *
 * RS < 1.0 means underperforming benchmark
 *
 * @param threshold - RS threshold (default: 1.0)
 * @param options - RS calculation options
 */
export function rsBelow(threshold = 1.0, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `rsBelow(${threshold})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value !== null && value.rs < threshold;
    },
  };
}

// ============================================
// RS Trend Conditions
// ============================================

/**
 * RS is trending up
 *
 * @param options - RS calculation options
 *
 * @example
 * ```ts
 * // Buy when stock is gaining relative strength
 * const entry = and(goldenCross(), rsRising());
 * ```
 */
export function rsRising(options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rsRising()",
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value?.trend === "up";
    },
  };
}

/**
 * RS is trending down
 *
 * @param options - RS calculation options
 */
export function rsFalling(options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rsFalling()",
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value?.trend === "down";
    },
  };
}

// ============================================
// RS New High/Low Conditions
// ============================================

/**
 * Check if RS is at an extremum over the lookback period
 */
function isRSExtremum(
  rsData: Series<RSValue>,
  rsIndex: number,
  lookback: number,
  comparator: (past: number, current: number) => boolean,
): boolean {
  if (rsIndex < lookback || rsIndex >= rsData.length) return false;

  const currentRS = rsData[rsIndex]?.value?.rs;
  if (currentRS === undefined) return false;

  for (let i = 1; i <= lookback; i++) {
    const pastRS = rsData[rsIndex - i]?.value?.rs;
    if (pastRS !== undefined && comparator(pastRS, currentRS)) {
      return false;
    }
  }

  return true;
}

/**
 * RS at N-period high
 *
 * @param lookback - Periods to look back (default: 52)
 * @param options - RS calculation options
 *
 * @example
 * ```ts
 * // Buy on RS breakout
 * const entry = and(rsNewHigh(20), volumeAboveAvg());
 * ```
 */
export function rsNewHigh(lookback = 52, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `rsNewHigh(${lookback})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const offset = candles.length - rsData.length;
      const rsIndex = index - offset;

      return isRSExtremum(rsData, rsIndex, lookback, (past, current) => past >= current);
    },
  };
}

/**
 * RS at N-period low
 *
 * @param lookback - Periods to look back (default: 52)
 * @param options - RS calculation options
 */
export function rsNewLow(lookback = 52, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `rsNewLow(${lookback})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const offset = candles.length - rsData.length;
      const rsIndex = index - offset;

      return isRSExtremum(rsData, rsIndex, lookback, (past, current) => past <= current);
    },
  };
}

// ============================================
// RS Rating Conditions
// ============================================

/**
 * RS Rating above threshold
 *
 * RS Rating is a percentile rank (0-100) comparing to historical values.
 * A rating of 90 means the stock is outperforming 90% of its historical comparisons.
 *
 * @param rating - Minimum RS Rating (default: 80)
 * @param options - RS calculation options
 *
 * @example
 * ```ts
 * // Only trade stocks with strong relative strength
 * const entry = and(rsRatingAbove(80), perfectOrderBullish());
 * ```
 */
export function rsRatingAbove(rating = 80, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `rsRatingAbove(${rating})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value?.rsRating != null && value.rsRating > rating;
    },
  };
}

/**
 * RS Rating below threshold
 *
 * @param rating - Maximum RS Rating (default: 20)
 * @param options - RS calculation options
 */
export function rsRatingBelow(rating = 20, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `rsRatingBelow(${rating})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value?.rsRating != null && value.rsRating < rating;
    },
  };
}

// ============================================
// Mansfield RS Conditions
// ============================================

/**
 * Mansfield RS above threshold
 *
 * Mansfield RS measures deviation of RS from its SMA.
 * Values > 0 indicate RS is above its average (strengthening).
 *
 * @param threshold - Minimum Mansfield RS (default: 0)
 * @param options - RS calculation options
 *
 * @example
 * ```ts
 * // Trade when RS is accelerating
 * const entry = and(mansfieldRSAbove(5), rsRising());
 * ```
 */
export function mansfieldRSAbove(threshold = 0, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `mansfieldRSAbove(${threshold})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value?.mansfieldRS != null && value.mansfieldRS > threshold;
    },
  };
}

/**
 * Mansfield RS below threshold
 *
 * Values < 0 indicate RS is below its average (weakening).
 *
 * @param threshold - Maximum Mansfield RS (default: 0)
 * @param options - RS calculation options
 */
export function mansfieldRSBelow(threshold = 0, options: RSConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: `mansfieldRSBelow(${threshold})`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value?.mansfieldRS != null && value.mansfieldRS < threshold;
    },
  };
}

// ============================================
// Outperformance Conditions
// ============================================

/**
 * Stock outperforming benchmark by specified percentage
 *
 * @param minOutperformance - Minimum outperformance % (default: 0)
 * @param options - RS calculation options
 *
 * @example
 * ```ts
 * // Only trade stocks beating market by 10%+
 * const filter = outperformanceAbove(10);
 * ```
 */
export function outperformanceAbove(
  minOutperformance = 0,
  options: RSConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `outperformanceAbove(${minOutperformance}%)`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value !== null && value.outperformance > minOutperformance;
    },
  };
}

/**
 * Stock underperforming benchmark by specified percentage
 *
 * @param maxOutperformance - Maximum outperformance % (default: 0)
 * @param options - RS calculation options
 */
export function outperformanceBelow(
  maxOutperformance = 0,
  options: RSConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `outperformanceBelow(${maxOutperformance}%)`,
    evaluate: (indicators, _candle, index, candles) => {
      const rsData = getRSData(indicators, candles, options);
      if (!rsData) return false;

      const value = getRSValueAtIndex(rsData, candles.length, index);
      return value !== null && value.outperformance < maxOutperformance;
    },
  };
}

/**
 * Indicators-object key under which RS conditions read benchmark candles.
 *
 * Supply a benchmark to a backtest via the `benchmark` option — that is the
 * supported path. This key is exported for advanced callers that evaluate RS
 * conditions directly against a hand-built indicators object:
 *
 * @example
 * ```ts
 * import { BENCHMARK_CACHE_KEY, rsAbove } from "trendcraft";
 *
 * const indicators = { [BENCHMARK_CACHE_KEY]: sp500Candles };
 * rsAbove(1.0).evaluate(indicators, candle, index, candles);
 * ```
 *
 * The benchmark is a per-run input, not a candle-derived value, so it is never
 * stored in a shared {@link IndicatorCache}; pass it on every run that needs it.
 */
export const BENCHMARK_CACHE_KEY = BENCHMARK_KEY;

/**
 * Indicator keys that are run-local inputs rather than candle-derived
 * computations. The benchmark is supplied per run (the same candles can be run
 * against different benchmarks), so it must not be shared through the
 * candle-keyed {@link IndicatorCache}. Passed to `createCachedIndicators` so a
 * benchmark seeded on one run never leaks into a later run that omits it.
 *
 * Internal plumbing — not part of the public API.
 */
export const RUN_LOCAL_CACHE_KEYS: ReadonlySet<string> = new Set([BENCHMARK_KEY]);

/**
 * Seed benchmark candles into a backtest's indicators object so RS conditions
 * can read them. No-op when `benchmark` is undefined.
 *
 * Internal plumbing — the single owner of the `BENCHMARK_CACHE_KEY` write,
 * shared by every backtest engine entry point (`runBacktest`,
 * `runBacktestScaled`). Not part of the public API; supply a benchmark through
 * the `benchmark` backtest option instead.
 */
export function seedBenchmark(
  indicators: Record<string, unknown>,
  benchmark: (Candle | NormalizedCandle)[] | undefined,
): void {
  if (benchmark) {
    indicators[BENCHMARK_KEY] = benchmark;
  }
}
