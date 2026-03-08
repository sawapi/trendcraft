/**
 * Pattern Projection Analysis
 *
 * Analyzes price behavior after pattern/event occurrences to project
 * future returns with statistical confidence bounds.
 */

import type { PatternSignal } from "../signals/patterns/types";
import type { NormalizedCandle, Series } from "../types";
import type {
  EventExtractor,
  HitRate,
  PatternProjection,
  PatternProjectionOptions,
} from "./pattern-projection-types";

const DEFAULT_HORIZON = 20;
const DEFAULT_CONFIDENCE = 0.95;
const DEFAULT_THRESHOLDS = [1, 2, 5, 10];

/**
 * Calculate the p-th percentile of a sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Calculate median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 50);
}

/**
 * Project price outcomes after pattern/event occurrences
 *
 * For each event, collects return percentages at each bar offset up to the horizon.
 * Computes mean, median, and confidence bounds across all events.
 * Bearish events have their returns inverted so positive = favorable.
 *
 * @param candles - Historical candle data
 * @param events - Array of events to analyze
 * @param extractor - Function to extract time and direction from each event
 * @param options - Projection options
 * @returns PatternProjection with statistical analysis
 *
 * @example
 * ```ts
 * import { projectPatternOutcome, doubleBottom } from "trendcraft";
 *
 * const patterns = doubleBottom(candles);
 * const projection = projectPatternOutcome(
 *   candles,
 *   patterns,
 *   (p) => ({ time: p.time, direction: "bullish" }),
 *   { horizon: 30 },
 * );
 * console.log(`Avg return after 10 bars: ${projection.avgReturnByBar[9]}%`);
 * ```
 */
export function projectPatternOutcome<T>(
  candles: NormalizedCandle[],
  events: T[],
  extractor: EventExtractor<T>,
  options?: PatternProjectionOptions,
): PatternProjection {
  const horizon = options?.horizon ?? DEFAULT_HORIZON;
  const confidenceLevel = options?.confidenceLevel ?? DEFAULT_CONFIDENCE;
  const thresholds = options?.thresholds ?? DEFAULT_THRESHOLDS;

  if (events.length === 0) {
    return {
      patternCount: 0,
      validCount: 0,
      avgReturnByBar: [],
      medianReturnByBar: [],
      upperBound: [],
      lowerBound: [],
      hitRates: thresholds.map((t) => ({ threshold: t, rate: 0 })),
    };
  }

  // Build timestamp → index map for O(1) lookup
  const timeToIndex = new Map<number, number>();
  for (let i = 0; i < candles.length; i++) {
    timeToIndex.set(candles[i].time, i);
  }

  // Collect returns for each bar offset
  // returnsByBar[offset] = array of return% values across events
  const returnsByBar: number[][] = Array.from({ length: horizon }, () => []);
  // Track max return within horizon for each valid event (for hit rate calculation)
  const maxReturns: number[] = [];

  let validCount = 0;

  for (const event of events) {
    const { time, direction = "bullish" } = extractor(event);
    const eventIndex = timeToIndex.get(time);
    if (eventIndex === undefined) continue;

    // Need at least 1 bar of forward data
    if (eventIndex >= candles.length - 1) continue;

    const basePrice = candles[eventIndex].close;
    if (basePrice === 0) continue;

    const sign = direction === "bearish" ? -1 : 1;
    let maxReturn = Number.NEGATIVE_INFINITY;
    let hasAnyBar = false;

    for (let offset = 0; offset < horizon; offset++) {
      const targetIndex = eventIndex + offset + 1;
      if (targetIndex >= candles.length) break;

      const ret = sign * ((candles[targetIndex].close - basePrice) / basePrice) * 100;
      returnsByBar[offset].push(ret);
      if (ret > maxReturn) maxReturn = ret;
      hasAnyBar = true;
    }

    if (hasAnyBar) {
      validCount++;
      maxReturns.push(maxReturn);
    }
  }

  // Calculate statistics for each bar offset
  const avgReturnByBar: number[] = [];
  const medianReturnByBar: number[] = [];
  const upperBound: number[] = [];
  const lowerBound: number[] = [];

  const lowerP = ((1 - confidenceLevel) / 2) * 100;
  const upperP = (1 - (1 - confidenceLevel) / 2) * 100;

  for (let offset = 0; offset < horizon; offset++) {
    const values = returnsByBar[offset];
    if (values.length === 0) {
      avgReturnByBar.push(0);
      medianReturnByBar.push(0);
      upperBound.push(0);
      lowerBound.push(0);
      continue;
    }

    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    avgReturnByBar.push(Math.round(avg * 100) / 100);
    medianReturnByBar.push(Math.round(median(values) * 100) / 100);

    const sorted = [...values].sort((a, b) => a - b);
    lowerBound.push(Math.round(percentile(sorted, lowerP) * 100) / 100);
    upperBound.push(Math.round(percentile(sorted, upperP) * 100) / 100);
  }

  // Calculate hit rates
  const hitRates: HitRate[] = thresholds.map((threshold) => {
    if (maxReturns.length === 0) return { threshold, rate: 0 };
    const hits = maxReturns.filter((r) => r >= threshold).length;
    return {
      threshold,
      rate: Math.round((hits / maxReturns.length) * 100 * 100) / 100,
    };
  });

  return {
    patternCount: events.length,
    validCount,
    avgReturnByBar,
    medianReturnByBar,
    upperBound,
    lowerBound,
    hitRates,
  };
}

/**
 * Project outcomes from a Series with boolean or numeric values
 *
 * Events are extracted where value is truthy (boolean) or non-null/non-zero (numeric).
 *
 * @param candles - Historical candle data
 * @param series - Series of indicator values (events where value is truthy)
 * @param options - Projection options
 * @returns PatternProjection
 *
 * @example
 * ```ts
 * import { projectFromSeries, crossOver, sma } from "trendcraft";
 *
 * const crosses = crossOver(sma(candles, { period: 5 }), sma(candles, { period: 25 }));
 * const projection = projectFromSeries(candles, crosses);
 * ```
 */
export function projectFromSeries<V>(
  candles: NormalizedCandle[],
  series: Series<V>,
  options?: PatternProjectionOptions,
): PatternProjection {
  const events = series.filter((s) => {
    if (typeof s.value === "boolean") return s.value;
    if (typeof s.value === "number") return s.value !== 0;
    return s.value != null;
  });

  return projectPatternOutcome(candles, events, (e) => ({ time: e.time }), options);
}

/** Bearish pattern types */
const BEARISH_PATTERNS = new Set(["double_top", "head_shoulders"]);

/**
 * Project outcomes from PatternSignal array
 *
 * Automatically determines direction from pattern type:
 * - double_top, head_shoulders → bearish
 * - double_bottom, inverse_head_shoulders, cup_handle → bullish
 *
 * @param candles - Historical candle data
 * @param signals - Array of PatternSignal from pattern detection functions
 * @param options - Projection options
 * @returns PatternProjection
 *
 * @example
 * ```ts
 * import { projectFromPatterns, doubleBottom } from "trendcraft";
 *
 * const patterns = doubleBottom(candles);
 * const projection = projectFromPatterns(candles, patterns);
 * console.log(`Hit rate (5%): ${projection.hitRates.find(h => h.threshold === 5)?.rate}%`);
 * ```
 */
export function projectFromPatterns(
  candles: NormalizedCandle[],
  signals: PatternSignal[],
  options?: PatternProjectionOptions,
): PatternProjection {
  return projectPatternOutcome(
    candles,
    signals,
    (s) => ({
      time: s.time,
      direction: BEARISH_PATTERNS.has(s.type) ? "bearish" : "bullish",
    }),
    options,
  );
}
