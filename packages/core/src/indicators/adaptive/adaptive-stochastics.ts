/**
 * Adaptive Stochastics indicator
 *
 * Stochastic oscillator whose lookback period adapts based on ADX (trend strength):
 * - Strong trend (high ADX) -> longer period (avoid whipsaws in trends)
 * - Weak trend (low ADX) -> shorter period (responsive to range-bound moves)
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { dmi } from "../momentum/dmi";

/**
 * Adaptive Stochastics configuration options
 */
export type AdaptiveStochasticsOptions = {
  /** Base stochastic lookback period (default: 14) */
  basePeriod?: number;
  /** Minimum period for low ADX (default: 5) */
  minPeriod?: number;
  /** Maximum period for high ADX (default: 21) */
  maxPeriod?: number;
  /** ADX period (default: 14) */
  adxPeriod?: number;
  /** ADX threshold for full adaptation (default: 40) */
  adxThreshold?: number;
  /** K smoothing period (default: 3) */
  kSmoothing?: number;
  /** D smoothing period (default: 3) */
  dSmoothing?: number;
};

/**
 * Adaptive Stochastics result value
 */
export type AdaptiveStochasticsValue = {
  /** %K line value (0-100) or null if insufficient data */
  k: number | null;
  /** %D line value (0-100) or null if insufficient data */
  d: number | null;
  /** The effective stochastic period used at this bar */
  effectivePeriod: number;
  /** ADX value at this bar, or null if insufficient data */
  adx: number | null;
};

/**
 * Compute raw %K for a given lookback period at bar index i.
 * %K = 100 * (close - lowest low) / (highest high - lowest low)
 */
function rawStochK(candles: NormalizedCandle[], i: number, lookback: number): number | null {
  if (i < lookback - 1) return null;

  let hh = Number.NEGATIVE_INFINITY;
  let ll = Number.POSITIVE_INFINITY;
  for (let j = i - lookback + 1; j <= i; j++) {
    if (candles[j].high > hh) hh = candles[j].high;
    if (candles[j].low < ll) ll = candles[j].low;
  }

  const range = hh - ll;
  if (range === 0) return 50; // flat market
  return (100 * (candles[i].close - ll)) / range;
}

/**
 * Adaptive Stochastics that adjusts its lookback period based on ADX trend strength.
 *
 * High ADX (strong trend) -> longer stochastic period to avoid whipsaws.
 * Low ADX (weak trend / range) -> shorter period for responsiveness.
 *
 * The period is linearly interpolated between minPeriod and maxPeriod based on
 * the ADX value relative to adxThreshold.
 *
 * @param candles - OHLCV candle data
 * @param options - Adaptive Stochastics configuration
 * @returns Series with K, D values and the effective period / ADX at each bar
 *
 * @example
 * ```ts
 * const result = adaptiveStochastics(candles, { basePeriod: 14, adxThreshold: 40 });
 * result.forEach(p => console.log(`K: ${p.value.k}, Period: ${p.value.effectivePeriod}`));
 * ```
 */
export function adaptiveStochastics(
  candles: Candle[] | NormalizedCandle[],
  options: AdaptiveStochasticsOptions = {},
): Series<AdaptiveStochasticsValue> {
  const basePeriod = options.basePeriod ?? 14;
  const minPeriod = options.minPeriod ?? 5;
  const maxPeriod = options.maxPeriod ?? 21;
  const adxPeriod = options.adxPeriod ?? 14;
  const adxThreshold = options.adxThreshold ?? 40;
  const kSmoothing = options.kSmoothing ?? 3;
  const dSmoothing = options.dSmoothing ?? 3;

  if (minPeriod < 2) {
    throw new Error("Adaptive Stochastics minPeriod must be at least 2");
  }
  if (maxPeriod < minPeriod) {
    throw new Error("Adaptive Stochastics maxPeriod must be >= minPeriod");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  if (normalized.length === 0) return [];

  // Calculate DMI/ADX
  const dmiSeries = dmi(normalized, { period: adxPeriod });

  const result: Series<AdaptiveStochasticsValue> = [];

  // We need to compute raw K values per bar with adaptive periods,
  // then apply K smoothing and D smoothing via simple moving average.
  const rawKValues: (number | null)[] = [];
  const effectivePeriods: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const adxValue = dmiSeries[i]?.value?.adx ?? null;

    // Determine effective period based on ADX
    let effectivePeriod = basePeriod;
    if (adxValue !== null) {
      // Ratio: how strong the trend is (0 to 1, clamped)
      const ratio = Math.min(1, adxValue / adxThreshold);
      // Strong trend -> longer period; weak trend -> shorter period
      effectivePeriod = Math.round(minPeriod + ratio * (maxPeriod - minPeriod));
      effectivePeriod = Math.max(minPeriod, Math.min(maxPeriod, effectivePeriod));
    }
    effectivePeriods.push(effectivePeriod);

    const rawK = rawStochK(normalized, i, effectivePeriod);
    rawKValues.push(rawK);
  }

  // Apply K smoothing (SMA of raw K)
  const smoothedK: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (i < kSmoothing - 1) {
      smoothedK.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - kSmoothing + 1; j <= i; j++) {
      if (rawKValues[j] !== null) {
        sum += rawKValues[j] as number;
        count++;
      }
    }
    smoothedK.push(count === kSmoothing ? sum / count : null);
  }

  // Apply D smoothing (SMA of smoothed K)
  const dValues: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (i < kSmoothing + dSmoothing - 2) {
      dValues.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - dSmoothing + 1; j <= i; j++) {
      if (smoothedK[j] !== null) {
        sum += smoothedK[j] as number;
        count++;
      }
    }
    dValues.push(count === dSmoothing ? sum / count : null);
  }

  // Build result
  for (let i = 0; i < normalized.length; i++) {
    const adxValue = dmiSeries[i]?.value?.adx ?? null;
    result.push({
      time: normalized[i].time,
      value: {
        k: smoothedK[i],
        d: dValues[i],
        effectivePeriod: effectivePeriods[i],
        adx: adxValue,
      },
    });
  }

  return result;
}
