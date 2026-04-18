/**
 * Fractal Adaptive Moving Average (FRAMA) indicator
 *
 * FRAMA uses fractal geometry to dynamically adjust the smoothing factor
 * based on the fractal dimension of the price series.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { FRAMA_META } from "../indicator-meta";

/**
 * FRAMA options
 */
export type FramaOptions = {
  /** Period for FRAMA calculation (must be even, default: 16) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Fractal Adaptive Moving Average
 *
 * FRAMA dynamically adjusts its alpha based on the fractal dimension:
 * 1. Split the period into two halves
 * 2. Calculate the range (max-min) for each half and the full period
 * 3. Compute fractal dimension D
 * 4. alpha = exp(-4.6 * (D - 1))
 * 5. FRAMA = alpha * price + (1 - alpha) * prev_FRAMA
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - FRAMA options
 * @returns Series of FRAMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const frama16 = frama(candles); // Default 16-period FRAMA
 * const frama20 = frama(candles, { period: 20 });
 * ```
 */
export function frama(
  candles: Candle[] | NormalizedCandle[],
  options: FramaOptions = {},
): Series<number | null> {
  const { period = 16, source = "close" } = options;

  if (period < 4) {
    throw new Error("FRAMA period must be at least 4");
  }
  if (!Number.isInteger(period)) {
    throw new Error("FRAMA period must be an integer");
  }

  // Period must be even
  const effectivePeriod = period % 2 === 0 ? period : period + 1;
  const halfPeriod = effectivePeriod / 2;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  let prevFrama: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    if (i < effectivePeriod - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    const price = getPrice(normalized[i], source);

    if (prevFrama === null) {
      // Seed with current price
      prevFrama = price;
      result.push({ time: normalized[i].time, value: prevFrama });
      continue;
    }

    // Calculate high/low ranges for first half, second half, and full period
    let h1High = Number.NEGATIVE_INFINITY;
    let h1Low = Number.POSITIVE_INFINITY;
    let h2High = Number.NEGATIVE_INFINITY;
    let h2Low = Number.POSITIVE_INFINITY;
    let fHigh = Number.NEGATIVE_INFINITY;
    let fLow = Number.POSITIVE_INFINITY;

    for (let j = 0; j < effectivePeriod; j++) {
      const p = getPrice(normalized[i - effectivePeriod + 1 + j], source);

      if (j < halfPeriod) {
        h1High = Math.max(h1High, p);
        h1Low = Math.min(h1Low, p);
      } else {
        h2High = Math.max(h2High, p);
        h2Low = Math.min(h2Low, p);
      }

      fHigh = Math.max(fHigh, p);
      fLow = Math.min(fLow, p);
    }

    const n1 = (h1High - h1Low) / halfPeriod;
    const n2 = (h2High - h2Low) / halfPeriod;
    const n3 = (fHigh - fLow) / effectivePeriod;

    let alpha: number;

    if (n1 > 0 && n2 > 0 && n3 > 0) {
      const d = (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2);
      alpha = Math.exp(-4.6 * (d - 1));
      // Clamp alpha to [0.01, 1]
      alpha = Math.max(0.01, Math.min(1, alpha));
    } else {
      alpha = 0.01;
    }

    prevFrama = alpha * price + (1 - alpha) * prevFrama;
    result.push({ time: normalized[i].time, value: prevFrama });
  }

  return tagSeries(result, withLabelParams(FRAMA_META, [period]));
}
