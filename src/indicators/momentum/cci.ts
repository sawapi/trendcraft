/**
 * Commodity Channel Index (CCI) indicator
 *
 * CCI measures the current price level relative to an average price level
 * over a given period. Used to identify overbought/oversold conditions.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * CCI options
 */
export type CciOptions = {
  /** Period for CCI calculation (default: 20) */
  period?: number;
  /** Constant multiplier (default: 0.015) */
  constant?: number;
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
  const { period = 20, constant = 0.015 } = options;

  if (period < 1) {
    throw new Error("CCI period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  // Calculate typical prices
  const typicalPrices: number[] = normalized.map((c) => (c.high + c.low + c.close) / 3);

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

  return result;
}
