/**
 * Adaptive Bollinger Bands indicator
 *
 * Bollinger Bands where the standard deviation multiplier adapts based on
 * rolling kurtosis (tail risk):
 * - High kurtosis (fat tails) -> wider bands
 * - Normal kurtosis -> standard bands
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Adaptive Bollinger Bands configuration options
 */
export type AdaptiveBollingerOptions = {
  /** SMA period (default: 20) */
  period?: number;
  /** Base standard deviation multiplier (default: 2) */
  baseStdDev?: number;
  /** Lookback for kurtosis calculation (default: 100) */
  kurtosisLookback?: number;
  /** Minimum multiplier (default: 1.5) */
  minMultiplier?: number;
  /** Maximum multiplier (default: 3.0) */
  maxMultiplier?: number;
};

/**
 * Adaptive Bollinger Bands result value
 */
export type AdaptiveBollingerValue = {
  /** Upper band or null if insufficient data */
  upper: number | null;
  /** Middle band (SMA) or null if insufficient data */
  middle: number | null;
  /** Lower band or null if insufficient data */
  lower: number | null;
  /** Bandwidth = (upper - lower) / middle, or null */
  bandwidth: number | null;
  /** The effective stdDev multiplier used at this bar */
  effectiveMultiplier: number;
  /** Excess kurtosis at this bar, or null if insufficient data */
  kurtosis: number | null;
};

/**
 * Calculate rolling excess kurtosis for a window of values.
 * Excess kurtosis = (m4 / m2^2) - 3, where m2 and m4 are central moments.
 * Normal distribution has excess kurtosis of 0.
 */
function calculateKurtosis(values: number[]): number | null {
  const n = values.length;
  if (n < 4) return null;

  const mean = values.reduce((s, v) => s + v, 0) / n;
  let m2 = 0;
  let m4 = 0;
  for (const v of values) {
    const diff = v - mean;
    const diff2 = diff * diff;
    m2 += diff2;
    m4 += diff2 * diff2;
  }
  m2 /= n;
  m4 /= n;

  if (m2 === 0) return null;

  return m4 / (m2 * m2) - 3;
}

/**
 * Adaptive Bollinger Bands that adjusts the standard deviation multiplier
 * based on rolling kurtosis.
 *
 * Higher kurtosis (fat tails / extreme moves) -> wider bands (higher multiplier).
 * Normal or negative kurtosis -> standard or narrower bands.
 *
 * The multiplier is linearly interpolated between minMultiplier and maxMultiplier
 * based on kurtosis, clamped to the [min, max] range.
 *
 * @param candles - OHLCV candle data
 * @param options - Adaptive Bollinger configuration
 * @returns Series with band values and the effective multiplier / kurtosis at each bar
 *
 * @example
 * ```ts
 * const result = adaptiveBollinger(candles, { period: 20, baseStdDev: 2 });
 * result.forEach(p => console.log(`Upper: ${p.value.upper}, Mult: ${p.value.effectiveMultiplier}`));
 * ```
 */
export function adaptiveBollinger(
  candles: Candle[] | NormalizedCandle[],
  options: AdaptiveBollingerOptions = {},
): Series<AdaptiveBollingerValue> {
  const period = options.period ?? 20;
  const baseStdDev = options.baseStdDev ?? 2;
  const kurtosisLookback = options.kurtosisLookback ?? 100;
  const minMultiplier = options.minMultiplier ?? 1.5;
  const maxMultiplier = options.maxMultiplier ?? 3.0;

  if (period < 1) {
    throw new Error("Adaptive Bollinger period must be at least 1");
  }
  if (minMultiplier <= 0) {
    throw new Error("Adaptive Bollinger minMultiplier must be positive");
  }
  if (maxMultiplier < minMultiplier) {
    throw new Error("Adaptive Bollinger maxMultiplier must be >= minMultiplier");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  if (normalized.length === 0) return [];

  const result: Series<AdaptiveBollingerValue> = [];

  // Kurtosis mapping: excess kurtosis of 0 (normal) maps to baseStdDev.
  // Excess kurtosis of +6 or higher maps to maxMultiplier.
  // Negative excess kurtosis maps toward minMultiplier.
  const kurtosisScale = 6; // excess kurtosis range for full adaptation

  for (let i = 0; i < normalized.length; i++) {
    // Not enough data for SMA
    if (i < period - 1) {
      result.push({
        time: normalized[i].time,
        value: {
          upper: null,
          middle: null,
          lower: null,
          bandwidth: null,
          effectiveMultiplier: baseStdDev,
          kurtosis: null,
        },
      });
      continue;
    }

    // Calculate SMA and standard deviation
    let sum = 0;
    const windowPrices: number[] = [];
    for (let j = i - period + 1; j <= i; j++) {
      const p = getPrice(normalized[j], "close");
      windowPrices.push(p);
      sum += p;
    }
    const sma = sum / period;

    let variance = 0;
    for (const p of windowPrices) {
      variance += (p - sma) ** 2;
    }
    variance /= period; // population variance (same as standard BB)
    const sd = Math.sqrt(variance);

    // Calculate kurtosis from a longer lookback
    const kurtStart = Math.max(0, i - kurtosisLookback + 1);
    const kurtValues: number[] = [];
    for (let j = kurtStart; j <= i; j++) {
      kurtValues.push(getPrice(normalized[j], "close"));
    }
    const kurt = calculateKurtosis(kurtValues);

    // Determine effective multiplier
    let effectiveMultiplier = baseStdDev;
    if (kurt !== null) {
      // Normalize kurtosis to [-1, 1] range using kurtosisScale
      const normalizedKurt = Math.max(-1, Math.min(1, kurt / kurtosisScale));
      // Map: -1 -> minMultiplier, 0 -> baseStdDev, +1 -> maxMultiplier
      if (normalizedKurt >= 0) {
        effectiveMultiplier = baseStdDev + normalizedKurt * (maxMultiplier - baseStdDev);
      } else {
        effectiveMultiplier = baseStdDev + normalizedKurt * (baseStdDev - minMultiplier);
      }
      effectiveMultiplier = Math.max(minMultiplier, Math.min(maxMultiplier, effectiveMultiplier));
    }

    const upper = sma + effectiveMultiplier * sd;
    const lower = sma - effectiveMultiplier * sd;
    const bandwidth = sma !== 0 ? (upper - lower) / sma : null;

    result.push({
      time: normalized[i].time,
      value: {
        upper,
        middle: sma,
        lower,
        bandwidth,
        effectiveMultiplier,
        kurtosis: kurt,
      },
    });
  }

  return result;
}
