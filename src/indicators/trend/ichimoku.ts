/**
 * Ichimoku Kinko Hyo (一目均衡表) indicator
 *
 * A comprehensive Japanese technical analysis indicator that defines
 * support/resistance, trend direction, momentum, and trading signals.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Ichimoku options
 */
export type IchimokuOptions = {
  /** Tenkan-sen (Conversion Line) period - default: 9 */
  tenkanPeriod?: number;
  /** Kijun-sen (Base Line) period - default: 26 */
  kijunPeriod?: number;
  /** Senkou Span B period - default: 52 */
  senkouBPeriod?: number;
  /** Displacement period (for Kumo and Chikou) - default: 26 */
  displacement?: number;
};

/**
 * Ichimoku value at a single point in time
 */
export type IchimokuValue = {
  /** Tenkan-sen (転換線) - Conversion Line: (highest high + lowest low) / 2 over tenkanPeriod */
  tenkan: number | null;
  /** Kijun-sen (基準線) - Base Line: (highest high + lowest low) / 2 over kijunPeriod */
  kijun: number | null;
  /** Senkou Span A (先行スパンA) - Leading Span A: (Tenkan + Kijun) / 2, displaced forward */
  senkouA: number | null;
  /** Senkou Span B (先行スパンB) - Leading Span B: (highest high + lowest low) / 2 over senkouBPeriod, displaced forward */
  senkouB: number | null;
  /** Chikou Span (遅行スパン) - Lagging Span: Close price displaced backward */
  chikou: number | null;
};

/**
 * Calculate Ichimoku Kinko Hyo (一目均衡表)
 *
 * Components:
 * - Tenkan-sen (転換線): Short-term trend line
 * - Kijun-sen (基準線): Medium-term trend line
 * - Senkou Span A (先行スパンA): First cloud boundary (displaced forward)
 * - Senkou Span B (先行スパンB): Second cloud boundary (displaced forward)
 * - Chikou Span (遅行スパン): Lagging line (displaced backward)
 *
 * The area between Senkou Span A and B forms the "Kumo" (雲/cloud).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Ichimoku options
 * @returns Series of Ichimoku values
 *
 * @example
 * ```ts
 * // Standard Ichimoku with default parameters (9, 26, 52)
 * const ichi = ichimoku(candles);
 *
 * // Custom parameters
 * const ichi = ichimoku(candles, {
 *   tenkanPeriod: 7,
 *   kijunPeriod: 22,
 *   senkouBPeriod: 44
 * });
 *
 * // Check if price is above the cloud (bullish)
 * const current = ichi[i].value;
 * const isAboveCloud = candles[i].close > Math.max(current.senkouA, current.senkouB);
 * ```
 */
export function ichimoku(
  candles: Candle[] | NormalizedCandle[],
  options: IchimokuOptions = {},
): Series<IchimokuValue> {
  const { tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52, displacement = 26 } = options;

  // Validate options
  if (tenkanPeriod < 1 || kijunPeriod < 1 || senkouBPeriod < 1 || displacement < 1) {
    throw new Error("Ichimoku periods must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const length = normalized.length;
  const result: Series<IchimokuValue> = [];

  // Pre-calculate mid-prices for each period
  const tenkanValues: (number | null)[] = [];
  const kijunValues: (number | null)[] = [];
  const senkouBValues: (number | null)[] = [];

  for (let i = 0; i < length; i++) {
    // Calculate Tenkan-sen (Conversion Line)
    tenkanValues.push(calculateMidPrice(normalized, i, tenkanPeriod));

    // Calculate Kijun-sen (Base Line)
    kijunValues.push(calculateMidPrice(normalized, i, kijunPeriod));

    // Calculate Senkou Span B base value (before displacement)
    senkouBValues.push(calculateMidPrice(normalized, i, senkouBPeriod));
  }

  // Build result with proper displacement
  for (let i = 0; i < length; i++) {
    const tenkan = tenkanValues[i];
    const kijun = kijunValues[i];

    // Senkou Span A: (Tenkan + Kijun) / 2, plotted 'displacement' periods ahead
    // For current bar, we need the value calculated 'displacement' bars ago
    const senkouASourceIdx = i - displacement;
    let senkouA: number | null = null;
    if (senkouASourceIdx >= 0) {
      const srcTenkan = tenkanValues[senkouASourceIdx];
      const srcKijun = kijunValues[senkouASourceIdx];
      if (srcTenkan !== null && srcKijun !== null) {
        senkouA = (srcTenkan + srcKijun) / 2;
      }
    }

    // Senkou Span B: plotted 'displacement' periods ahead
    // For current bar, we need the value calculated 'displacement' bars ago
    let senkouB: number | null = null;
    if (senkouASourceIdx >= 0) {
      senkouB = senkouBValues[senkouASourceIdx];
    }

    // Chikou Span: Close price plotted 'displacement' periods back
    // For current bar, we show the close from 'displacement' bars ahead
    const chikouSourceIdx = i + displacement;
    let chikou: number | null = null;
    if (chikouSourceIdx < length) {
      chikou = normalized[chikouSourceIdx].close;
    }

    result.push({
      time: normalized[i].time,
      value: {
        tenkan,
        kijun,
        senkouA,
        senkouB,
        chikou,
      },
    });
  }

  return result;
}

/**
 * Calculate the mid-price (highest high + lowest low) / 2 over a period
 */
function calculateMidPrice(
  candles: NormalizedCandle[],
  endIndex: number,
  period: number,
): number | null {
  const startIndex = endIndex - period + 1;
  if (startIndex < 0) {
    return null;
  }

  let highestHigh = Number.NEGATIVE_INFINITY;
  let lowestLow = Number.POSITIVE_INFINITY;

  for (let i = startIndex; i <= endIndex; i++) {
    if (candles[i].high > highestHigh) {
      highestHigh = candles[i].high;
    }
    if (candles[i].low < lowestLow) {
      lowestLow = candles[i].low;
    }
  }

  return (highestHigh + lowestLow) / 2;
}
