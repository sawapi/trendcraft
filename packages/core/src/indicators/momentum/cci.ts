/**
 * Commodity Channel Index (CCI) indicator
 *
 * CCI measures the current price level relative to an average price level
 * over a given period. Used to identify overbought/oversold conditions.
 */

import { getPriceSeries, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { CCI_META } from "../indicator-meta";

/**
 * CCI options
 */
export type CciOptions = {
  /** Period for CCI calculation (default: 20) */
  period?: number;
  /** Constant multiplier (default: 0.015) */
  constant?: number;
  /** Price source (default: 'hlc3' — typical price) */
  source?: PriceSource;
};

/**
 * Calculate Commodity Channel Index
 *
 * CCI = (Typical Price - SMA of Typical Price) / (constant × Mean Deviation)
 * Typical Price = (High + Low + Close) / 3
 *
 * Interpretation:
 * - Above +100: Overbought
 * - Below -100: Oversold
 * - Crossing above/below these levels can signal trend changes
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - CCI options
 * @returns Series of CCI values
 *
 * @example
 * ```ts
 * const cciData = cci(candles); // Default 20-period CCI
 * const cciCustom = cci(candles, { period: 14 });
 *
 * // Check for overbought/oversold
 * const isOverbought = cciData[i].value > 100;
 * const isOversold = cciData[i].value < -100;
 * ```
 */
export function cci(
  candles: Candle[] | NormalizedCandle[],
  options: CciOptions = {},
): Series<number | null> {
  const { period = 20, constant = 0.015, source = "hlc3" } = options;

  if (period < 1) {
    throw new Error("CCI period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  // Calculate source prices (default: typical price hlc3)
  const typicalPrices: number[] = getPriceSeries(normalized, source);

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Calculate SMA of typical prices
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += typicalPrices[j];
    }
    const smaTP = sum / period;

    // Calculate mean deviation
    let meanDeviation = 0;
    for (let j = i - period + 1; j <= i; j++) {
      meanDeviation += Math.abs(typicalPrices[j] - smaTP);
    }
    meanDeviation /= period;

    // Calculate CCI
    let cciValue: number | null = null;
    if (meanDeviation !== 0) {
      cciValue = (typicalPrices[i] - smaTP) / (constant * meanDeviation);
    } else {
      cciValue = 0;
    }

    result.push({ time: normalized[i].time, value: cciValue });
  }

  return tagSeries(result, withLabelParams(CCI_META, [period]));
}
