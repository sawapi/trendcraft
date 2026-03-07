/**
 * Detrended Price Oscillator (DPO)
 *
 * DPO removes the trend from price data to identify cycles.
 * It compares price to a displaced moving average, highlighting
 * short-term cycles independent of the overall trend.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * DPO options
 */
export type DpoOptions = {
  /** Period for SMA calculation (default: 20) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Detrended Price Oscillator
 *
 * DPO = Close - SMA(period, shifted back period/2 + 1 bars)
 *
 * The SMA is shifted back by (period / 2 + 1) bars to center it,
 * effectively removing the trend component and isolating cycles.
 *
 * Interpretation:
 * - Positive DPO: Price is above the detrended average (cycle high)
 * - Negative DPO: Price is below the detrended average (cycle low)
 * - Zero crossings indicate cycle turning points
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - DPO options
 * @returns Series of DPO values
 *
 * @example
 * ```ts
 * const dpoData = dpo(candles); // Default 20-period DPO
 * const dpoCustom = dpo(candles, { period: 14 });
 *
 * // Detect cycle extremes
 * const isCycleHigh = dpoData[i].value !== null && dpoData[i].value! > 0;
 * ```
 */
export function dpo(
  candles: Candle[] | NormalizedCandle[],
  options: DpoOptions = {},
): Series<number | null> {
  const { period = 20, source = "close" } = options;

  if (period < 1) {
    throw new Error("DPO period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const shift = Math.floor(period / 2) + 1;

  // Pre-calculate SMA values
  const smaValues: (number | null)[] = new Array(normalized.length).fill(null);
  let sum = 0;
  for (let i = 0; i < normalized.length; i++) {
    sum += getPrice(normalized[i], source);
    if (i >= period) {
      sum -= getPrice(normalized[i - period], source);
    }
    if (i >= period - 1) {
      smaValues[i] = sum / period;
    }
  }

  for (let i = 0; i < normalized.length; i++) {
    // DPO[i] = Price[i] - SMA[i + shift]
    // Since SMA is "shifted back", we look at SMA at index (i + shift)
    const smaIndex = i + shift;
    if (smaIndex < normalized.length && smaValues[smaIndex] !== null) {
      const price = getPrice(normalized[i], source);
      result.push({ time: normalized[i].time, value: price - (smaValues[smaIndex] as number) });
    } else {
      result.push({ time: normalized[i].time, value: null });
    }
  }

  return result;
}
