/**
 * Awesome Oscillator (AO) indicator
 *
 * Created by Bill Williams, the AO measures market momentum by comparing
 * a 5-period SMA to a 34-period SMA of the median price.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Awesome Oscillator options
 */
export type AwesomeOscillatorOptions = {
  /** Fast period (default: 5) */
  fastPeriod?: number;
  /** Slow period (default: 34) */
  slowPeriod?: number;
};

/**
 * Calculate Awesome Oscillator
 *
 * AO = SMA(Median Price, fast) - SMA(Median Price, slow)
 * Median Price = (High + Low) / 2
 *
 * Interpretation:
 * - Positive AO: Bullish momentum
 * - Negative AO: Bearish momentum
 * - Zero-line crossover signals trend changes
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Awesome Oscillator options
 * @returns Series of AO values (null for insufficient data)
 *
 * @example
 * ```ts
 * const ao = awesomeOscillator(candles);
 * const isBullish = ao[i].value !== null && ao[i].value! > 0;
 * ```
 */
export function awesomeOscillator(
  candles: Candle[] | NormalizedCandle[],
  options: AwesomeOscillatorOptions = {},
): Series<number | null> {
  const { fastPeriod = 5, slowPeriod = 34 } = options;

  if (fastPeriod < 1 || slowPeriod < 1) {
    throw new Error("Awesome Oscillator periods must be at least 1");
  }
  if (fastPeriod >= slowPeriod) {
    throw new Error("Fast period must be less than slow period");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  // Calculate median prices
  const medianPrices = normalized.map((c) => (c.high + c.low) / 2);

  for (let i = 0; i < normalized.length; i++) {
    if (i < slowPeriod - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Fast SMA
    let fastSum = 0;
    for (let j = i - fastPeriod + 1; j <= i; j++) {
      fastSum += medianPrices[j];
    }
    const fastSma = fastSum / fastPeriod;

    // Slow SMA
    let slowSum = 0;
    for (let j = i - slowPeriod + 1; j <= i; j++) {
      slowSum += medianPrices[j];
    }
    const slowSma = slowSum / slowPeriod;

    result.push({ time: normalized[i].time, value: fastSma - slowSma });
  }

  return tagSeries(result, { pane: "sub", label: "AO", referenceLines: [0] });
}
