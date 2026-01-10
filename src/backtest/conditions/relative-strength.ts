/**
 * Relative Strength (RS) Backtest Conditions
 *
 * Conditions for comparing stock performance against a benchmark.
 * Requires benchmark data to be set in the indicators cache as `__benchmarkCandles`.
 *
 * @example
 * ```ts
 * // Set benchmark before running backtest
 * const conditions = { entry: rsAbove(1.0), exit: rsBelow(0.8) };
 * const result = runBacktest(candles, {
 *   ...conditions,
 *   setup: (indicators) => {
 *     indicators.__benchmarkCandles = sp500Candles;
 *   }
 * });
 * ```
 */

import { benchmarkRS } from "../../indicators/relative-strength/benchmark-rs";
import type { PresetCondition, Series, Candle, NormalizedCandle } from "../../types";
import type { RSValue } from "../../indicators/relative-strength/benchmark-rs";

const BENCHMARK_KEY = "__benchmarkCandles";
const RS_CACHE_PREFIX = "rs_";

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
  const cacheKey = `${RS_CACHE_PREFIX}${period}_${smaPeriod}`;

  const cached = indicators[cacheKey] as Series<RSValue> | undefined;
  if (cached) return cached;

  const benchmark = indicators[BENCHMARK_KEY] as (Candle | NormalizedCandle)[] | undefined;
  if (!benchmark?.length) return null;

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
 * Helper function to set benchmark data in indicators cache
 *
 * Call this in your backtest setup to enable RS conditions.
 *
 * @example
 * ```ts
 * setBenchmark(indicators, sp500Candles);
 * ```
 */
export function setBenchmark(
  indicators: Record<string, unknown>,
  benchmark: (Candle | NormalizedCandle)[],
): void {
  indicators[BENCHMARK_KEY] = benchmark;
}

/**
 * Key for storing benchmark in indicators cache
 *
 * You can set benchmark manually: `indicators.__benchmarkCandles = benchmarkData`
 */
export const BENCHMARK_CACHE_KEY = BENCHMARK_KEY;
