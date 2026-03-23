/**
 * CMF (Chaikin Money Flow)
 *
 * Measures the amount of money flow volume over a specific period.
 * Developed by Marc Chaikin.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * CMF options
 */
export type CmfOptions = {
  /** Lookback period (default: 20) */
  period?: number;
};

/**
 * Calculate CMF (Chaikin Money Flow)
 *
 * Calculation:
 * 1. Money Flow Multiplier = ((close - low) - (high - close)) / (high - low)
 *    - Ranges from -1 to +1
 *    - +1 when close = high
 *    - -1 when close = low
 * 2. Money Flow Volume = Money Flow Multiplier × volume
 * 3. CMF = SUM(Money Flow Volume, period) / SUM(volume, period)
 *
 * Interpretation:
 * - CMF > 0: Buying pressure (accumulation)
 * - CMF < 0: Selling pressure (distribution)
 * - Higher absolute value = stronger pressure
 * - Divergence from price can signal reversals
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - CMF options
 * @returns Series of CMF values (range: -1 to +1)
 *
 * @example
 * ```ts
 * const cmfData = cmf(candles);
 * const cmfCustom = cmf(candles, { period: 10 });
 *
 * // Check buying/selling pressure
 * if (cmfData[i].value > 0.1) {
 *   console.log("Strong buying pressure");
 * } else if (cmfData[i].value < -0.1) {
 *   console.log("Strong selling pressure");
 * }
 * ```
 */
export function cmf(
  candles: Candle[] | NormalizedCandle[],
  options: CmfOptions = {},
): Series<number | null> {
  const { period = 20 } = options;

  if (period < 1) {
    throw new Error("CMF period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];

  // Pre-calculate Money Flow Volume for each candle
  const mfv: number[] = [];
  for (const candle of normalized) {
    const highLowDiff = candle.high - candle.low;

    // Handle case where high = low (no range)
    let mfMultiplier: number;
    if (highLowDiff === 0) {
      mfMultiplier = 0;
    } else {
      // ((close - low) - (high - close)) / (high - low)
      // Simplifies to: (2 * close - high - low) / (high - low)
      mfMultiplier = (2 * candle.close - candle.high - candle.low) / highLowDiff;
    }

    mfv.push(mfMultiplier * candle.volume);
  }

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      // Not enough data
      result.push({ time: normalized[i].time, value: null });
    } else {
      // Sum Money Flow Volume and Volume over the period
      let sumMfv = 0;
      let sumVolume = 0;

      for (let j = 0; j < period; j++) {
        sumMfv += mfv[i - j];
        sumVolume += normalized[i - j].volume;
      }

      // Calculate CMF
      const cmfValue = sumVolume === 0 ? 0 : sumMfv / sumVolume;

      result.push({ time: normalized[i].time, value: cmfValue });
    }
  }

  return tagSeries(result, { overlay: false, label: "CMF", yRange: [-1, 1], referenceLines: [0] });
}
