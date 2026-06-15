/**
 * Multi-Timeframe (MTF) Context
 *
 * Manages multiple timeframe data and synchronization for backtesting.
 * Enables conditions that evaluate indicators across different timeframes.
 */

import type { MtfContext, MtfDataset, NormalizedCandle, TimeframeShorthand } from "../types";
import { resample } from "./resample";

/**
 * Interchangeable timeframe spellings. The canonical form is the first member.
 * Single source of truth for timeframe aliasing, used by both
 * {@link normalizeTimeframe} and the context builder so a condition that asks
 * for `"weekly"` finds data registered under `"1w"` and vice versa.
 */
const TF_ALIAS_GROUPS: TimeframeShorthand[][] = [
  ["1d", "daily"],
  ["1w", "weekly"],
  ["1M", "monthly"],
];

/** All interchangeable spellings of a timeframe (e.g. `"1w"` -> `["1w", "weekly"]`). */
function equivalentTimeframes(tf: TimeframeShorthand): TimeframeShorthand[] {
  return TF_ALIAS_GROUPS.find((group) => group.includes(tf)) ?? [tf];
}

/**
 * Create an MTF context from base timeframe candles
 *
 * Generates resampled data for each requested timeframe and builds
 * index mappings for efficient lookups during backtesting.
 *
 * @param baseCandles - Base timeframe candles (typically daily)
 * @param timeframes - Higher timeframes to generate (e.g., ["weekly", "monthly"])
 * @returns MTF context for use in condition evaluation
 *
 * @example
 * ```ts
 * const mtf = createMtfContext(dailyCandles, ["weekly", "monthly"]);
 *
 * // Access weekly data
 * const weeklyCandles = mtf.datasets.get("weekly")?.candles;
 * ```
 */
export function createMtfContext(
  baseCandles: NormalizedCandle[],
  timeframes: TimeframeShorthand[],
): MtfContext {
  const datasets = new Map<TimeframeShorthand, MtfDataset>();
  const indices = new Map<TimeframeShorthand, number>();

  // Generate resampled data for each timeframe
  for (const tf of timeframes) {
    const resampled = resample(baseCandles, tf);
    const dataset: MtfDataset = {
      timeframe: tf,
      candles: resampled,
      indicators: {},
    };
    // Register the same dataset under every interchangeable spelling (e.g. both
    // "1w" and "weekly") so conditions resolve regardless of which alias the
    // caller passed in `timeframes`. -1 = no higher-timeframe candle has closed
    // yet (set per bar by updateMtfIndices during iteration).
    for (const key of equivalentTimeframes(tf)) {
      datasets.set(key, dataset);
      indices.set(key, -1);
    }
  }

  return {
    datasets,
    indices,
    currentTime: baseCandles.length > 0 ? baseCandles[0].time : 0,
  };
}

/**
 * Build a mapping from base candle index to higher timeframe indices
 *
 * For each base candle, finds the corresponding index in each higher timeframe.
 * Used for efficient lookups during backtest iteration.
 *
 * @param baseCandles - Base timeframe candles
 * @param mtfContext - MTF context with resampled data
 * @returns Map from timeframe to array of indices (indexed by base candle index)
 */
export function buildMtfIndexMap(
  baseCandles: NormalizedCandle[],
  mtfContext: MtfContext,
): Map<TimeframeShorthand, number[]> {
  const indexMap = new Map<TimeframeShorthand, number[]>();

  for (const [tf, dataset] of mtfContext.datasets) {
    const higherCandles = dataset.candles;
    const indices: number[] = [];

    let containingIdx = 0;

    for (let baseIdx = 0; baseIdx < baseCandles.length; baseIdx++) {
      const baseTime = baseCandles[baseIdx].time;

      // Advance to the higher-timeframe candle that CONTAINS this base candle:
      // the last one whose period has started at or before the base bar.
      while (
        containingIdx < higherCandles.length - 1 &&
        higherCandles[containingIdx + 1].time <= baseTime
      ) {
        containingIdx++;
      }

      // Expose only the last CLOSED higher-timeframe candle. The containing
      // candle's period has not ended yet at this base bar, so its OHLC (built
      // from the whole period, including bars still in the future) would leak
      // look-ahead information. Point one bar back instead; -1 means no
      // higher-timeframe candle has closed yet.
      indices.push(containingIdx - 1);
    }

    indexMap.set(tf, indices);
  }

  return indexMap;
}

/**
 * Build an MTF context and its base→higher-timeframe index map in one step, or
 * `undefined` when no timeframes are requested. This is the standard setup used
 * by every per-bar consumer (backtest engine, scaled-entry simulation, stock
 * screening), kept in one place so they stay aligned.
 *
 * @param candles - Base timeframe candles
 * @param timeframes - Higher timeframes to generate (omit/empty for none)
 * @returns `{ context, indexMap }`, or `undefined` when `timeframes` is empty
 */
export function buildMtfSetup(
  candles: NormalizedCandle[],
  timeframes: TimeframeShorthand[] | undefined,
): { context: MtfContext; indexMap: Map<TimeframeShorthand, number[]> } | undefined {
  if (!timeframes || timeframes.length === 0) return undefined;
  const context = createMtfContext(candles, timeframes);
  const indexMap = buildMtfIndexMap(candles, context);
  return { context, indexMap };
}

/**
 * Update MTF context indices for a specific base candle index
 *
 * Called during backtest iteration to keep MTF indices synchronized.
 *
 * @param mtfContext - MTF context to update
 * @param indexMap - Pre-built index mapping
 * @param baseIndex - Current base candle index
 * @param baseTime - Current base candle timestamp
 */
export function updateMtfIndices(
  mtfContext: MtfContext,
  indexMap: Map<TimeframeShorthand, number[]>,
  baseIndex: number,
  baseTime: number,
): void {
  mtfContext.currentTime = baseTime;

  for (const [tf, indices] of indexMap) {
    if (baseIndex < indices.length) {
      mtfContext.indices.set(tf, indices[baseIndex]);
    }
  }
}

/**
 * Get the current candle for a specific timeframe
 *
 * @param mtfContext - MTF context
 * @param timeframe - Target timeframe
 * @returns Current candle or null if not available
 */
export function getMtfCandle(
  mtfContext: MtfContext,
  timeframe: TimeframeShorthand,
): NormalizedCandle | null {
  const dataset = mtfContext.datasets.get(timeframe);
  const index = mtfContext.indices.get(timeframe);

  // index < 0 means no higher-timeframe candle has closed yet at this bar.
  if (!dataset || index === undefined || index < 0) {
    return null;
  }

  return dataset.candles[index] ?? null;
}

/**
 * Get a cached indicator value for a specific timeframe
 *
 * @param mtfContext - MTF context
 * @param timeframe - Target timeframe
 * @param indicatorKey - Cache key for the indicator
 * @returns Indicator series or undefined if not cached
 */
export function getMtfIndicator<T>(
  mtfContext: MtfContext,
  timeframe: TimeframeShorthand,
  indicatorKey: string,
): T | undefined {
  const dataset = mtfContext.datasets.get(timeframe);
  if (!dataset) return undefined;

  return dataset.indicators[indicatorKey] as T | undefined;
}

/**
 * Set a cached indicator value for a specific timeframe
 *
 * @param mtfContext - MTF context
 * @param timeframe - Target timeframe
 * @param indicatorKey - Cache key for the indicator
 * @param value - Indicator series to cache
 */
export function setMtfIndicator<T>(
  mtfContext: MtfContext,
  timeframe: TimeframeShorthand,
  indicatorKey: string,
  value: T,
): void {
  const dataset = mtfContext.datasets.get(timeframe);
  if (dataset) {
    dataset.indicators[indicatorKey] = value;
  }
}

/**
 * Get the current indicator value at the current MTF index
 *
 * @param mtfContext - MTF context
 * @param timeframe - Target timeframe
 * @param indicatorKey - Cache key for the indicator
 * @returns Current indicator value or null
 */
export function getCurrentMtfIndicatorValue<T>(
  mtfContext: MtfContext,
  timeframe: TimeframeShorthand,
  indicatorKey: string,
): T | null {
  const dataset = mtfContext.datasets.get(timeframe);
  const index = mtfContext.indices.get(timeframe);

  // index < 0 means no higher-timeframe candle has closed yet at this bar.
  if (!dataset || index === undefined || index < 0) {
    return null;
  }

  const series = dataset.indicators[indicatorKey] as Array<{ time: number; value: T }> | undefined;
  if (!series || index >= series.length) {
    return null;
  }

  return series[index]?.value ?? null;
}

/**
 * Check if MTF context has a specific timeframe
 */
export function hasMtfTimeframe(mtfContext: MtfContext, timeframe: TimeframeShorthand): boolean {
  return mtfContext.datasets.has(timeframe);
}

/**
 * Get all available timeframes in the MTF context
 */
export function getMtfTimeframes(mtfContext: MtfContext): TimeframeShorthand[] {
  return Array.from(mtfContext.datasets.keys());
}

/**
 * Normalize timeframe aliases to canonical form
 * e.g., "weekly" -> "1w", "monthly" -> "1M"
 */
export function normalizeTimeframe(tf: TimeframeShorthand): TimeframeShorthand {
  // Canonical form is the first member of the alias group (e.g. "weekly" -> "1w").
  return equivalentTimeframes(tf)[0];
}

/**
 * Check if timeframe A is higher than timeframe B
 * (e.g., weekly is higher than daily)
 */
export function isHigherTimeframe(tfA: TimeframeShorthand, tfB: TimeframeShorthand): boolean {
  const order: Record<string, number> = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
    daily: 1440,
    "1w": 10080,
    weekly: 10080,
    "1M": 43200,
    monthly: 43200,
  };

  const a = order[tfA] ?? 0;
  const b = order[tfB] ?? 0;
  return a > b;
}
