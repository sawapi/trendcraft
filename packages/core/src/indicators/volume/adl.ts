/**
 * Accumulation/Distribution Line (ADL)
 *
 * A volume-based indicator that measures the cumulative flow of money
 * into and out of a security. Created by Marc Chaikin.
 *
 * Calculation:
 * - CLV (Close Location Value) = ((Close - Low) - (High - Close)) / (High - Low)
 * - Money Flow Volume = CLV × Volume
 * - ADL = cumulative sum of Money Flow Volume
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Calculate Accumulation/Distribution Line
 *
 * Interpretation:
 * - Rising ADL: Accumulation (buying pressure)
 * - Falling ADL: Distribution (selling pressure)
 * - Divergence from price signals potential reversal
 * - ADL rising while price falling: Bullish divergence
 * - ADL falling while price rising: Bearish divergence
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of ADL values
 *
 * @example
 * ```ts
 * const adlData = adl(candles);
 * const currentAdl = adlData[i].value;
 *
 * // ADL increasing = accumulation
 * if (adlData[i].value > adlData[i - 1].value) {
 *   // Buying pressure
 * }
 * ```
 */
export function adl(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number> = [];
  let cumulativeAdl = 0;

  for (let i = 0; i < normalized.length; i++) {
    const { high, low, close, volume } = normalized[i];
    const range = high - low;

    let clv: number;
    if (range === 0) {
      clv = 0;
    } else {
      clv = (close - low - (high - close)) / range;
    }

    const moneyFlowVolume = clv * volume;
    cumulativeAdl += moneyFlowVolume;

    result.push({ time: normalized[i].time, value: cumulativeAdl });
  }

  return tagSeries(result, { overlay: false, label: "ADL" });
}
