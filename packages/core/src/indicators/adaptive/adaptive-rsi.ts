/**
 * Adaptive RSI indicator
 *
 * RSI whose period dynamically adapts based on market volatility.
 * Uses ATR percentile within a lookback window to determine the volatility regime,
 * then interpolates the RSI period between minPeriod and maxPeriod.
 *
 * - High volatility -> shorter period (faster response)
 * - Low volatility -> longer period (smoother, less noise)
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { rsi } from "../momentum/rsi";
import { atr } from "../volatility/atr";

/**
 * Adaptive RSI configuration options
 */
export type AdaptiveRsiOptions = {
  /** Base RSI period (default: 14) */
  basePeriod?: number;
  /** Minimum period in high-volatility regime (default: 6) */
  minPeriod?: number;
  /** Maximum period in low-volatility regime (default: 28) */
  maxPeriod?: number;
  /** ATR period for volatility measurement (default: 14) */
  atrPeriod?: number;
  /** Volatility lookback for normalization (default: 100) */
  volLookback?: number;
};

/**
 * Adaptive RSI result value
 */
export type AdaptiveRsiValue = {
  /** RSI value (0-100) or null if insufficient data */
  rsi: number | null;
  /** The effective RSI period used at this bar */
  effectivePeriod: number;
  /** Volatility percentile (0-1) or null if insufficient data */
  volatilityPercentile: number | null;
};

/**
 * Adaptive RSI that adjusts its period based on current market volatility.
 * Higher volatility -> shorter RSI period (more responsive).
 * Lower volatility -> longer RSI period (smoother, fewer false signals).
 *
 * Uses ATR percentile within a lookback window to determine the volatility regime,
 * then interpolates the RSI period between minPeriod and maxPeriod.
 *
 * @param candles - OHLCV candle data
 * @param options - Adaptive RSI configuration
 * @returns Series with RSI value and the effective period used at each bar
 *
 * @example
 * ```ts
 * const result = adaptiveRsi(candles, { basePeriod: 14, minPeriod: 6, maxPeriod: 28 });
 * result.forEach(p => console.log(`RSI: ${p.value.rsi}, Period: ${p.value.effectivePeriod}`));
 * ```
 */
export function adaptiveRsi(
  candles: Candle[] | NormalizedCandle[],
  options: AdaptiveRsiOptions = {},
): Series<AdaptiveRsiValue> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const basePeriod = options.basePeriod ?? 14;
  const minPeriod = options.minPeriod ?? 6;
  const maxPeriod = options.maxPeriod ?? 28;
  const atrPeriod = options.atrPeriod ?? 14;
  const volLookback = options.volLookback ?? 100;

  if (minPeriod < 2) {
    throw new Error("Adaptive RSI minPeriod must be at least 2");
  }
  if (maxPeriod < minPeriod) {
    throw new Error("Adaptive RSI maxPeriod must be >= minPeriod");
  }

  if (normalized.length === 0) return [];

  // Calculate ATR for volatility measurement
  const atrSeries = atr(normalized, { period: atrPeriod });

  // Pre-compute RSI for all possible periods
  const rsiCache = new Map<number, Series<number | null>>();
  for (let p = minPeriod; p <= maxPeriod; p++) {
    rsiCache.set(p, rsi(normalized, { period: p }));
  }

  const result: Series<AdaptiveRsiValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const atrValue = atrSeries[i]?.value;

    if (atrValue === null || atrValue === undefined || i < volLookback) {
      result.push({
        time: normalized[i].time,
        value: { rsi: null, effectivePeriod: basePeriod, volatilityPercentile: null },
      });
      continue;
    }

    // Calculate volatility percentile within lookback window
    const start = Math.max(0, i - volLookback + 1);
    const atrWindow: number[] = [];
    for (let j = start; j <= i; j++) {
      const v = atrSeries[j]?.value;
      if (v !== null && v !== undefined) atrWindow.push(v);
    }

    const percentile = atrWindow.filter((v) => v <= atrValue).length / atrWindow.length;

    // Map percentile to period: high vol (percentile close to 1) -> short period
    const effectivePeriod = Math.round(maxPeriod - percentile * (maxPeriod - minPeriod));
    const clampedPeriod = Math.max(minPeriod, Math.min(maxPeriod, effectivePeriod));

    // Get RSI for the effective period
    const rsiSeries = rsiCache.get(clampedPeriod);
    const rsiValue = rsiSeries?.[i]?.value ?? null;

    result.push({
      time: normalized[i].time,
      value: { rsi: rsiValue, effectivePeriod: clampedPeriod, volatilityPercentile: percentile },
    });
  }

  return result;
}
