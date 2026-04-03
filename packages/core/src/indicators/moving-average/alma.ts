/**
 * Arnaud Legoux Moving Average (ALMA) indicator
 *
 * ALMA uses a Gaussian distribution to weight prices, providing
 * a smooth moving average with minimal lag.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * ALMA options
 */
export type AlmaOptions = {
  /** Period for ALMA calculation (default: 9) */
  period?: number;
  /** Offset for Gaussian curve (0-1, default: 0.85) */
  offset?: number;
  /** Sigma for Gaussian curve width (default: 6) */
  sigma?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Arnaud Legoux Moving Average
 *
 * ALMA applies a Gaussian distribution curve as weight to the price series.
 * The offset parameter shifts the Gaussian curve, and sigma controls its width.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - ALMA options
 * @returns Series of ALMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const alma9 = alma(candles); // Default 9-period ALMA
 * const almaCustom = alma(candles, { period: 20, offset: 0.85, sigma: 6 });
 * ```
 */
export function alma(
  candles: Candle[] | NormalizedCandle[],
  options: AlmaOptions = {},
): Series<number | null> {
  const { period = 9, offset = 0.85, sigma = 6, source = "close" } = options;

  if (period < 1) {
    throw new Error("ALMA period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("ALMA period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  // Pre-compute Gaussian weights
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights: number[] = [];
  let weightSum = 0;

  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - m) * (i - m)) / (2 * s * s));
    weights.push(w);
    weightSum += w;
  }

  // Normalize weights
  for (let i = 0; i < period; i++) {
    weights[i] /= weightSum;
  }

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let almaValue = 0;
    for (let j = 0; j < period; j++) {
      almaValue += weights[j] * getPrice(normalized[i - period + 1 + j], source);
    }

    result.push({ time: normalized[i].time, value: almaValue });
  }

  return tagSeries(result, { overlay: true, label: "ALMA" });
}
