/**
 * Ehlers Super Smoother Filter (2-pole)
 *
 * A superior low-pass filter that produces less lag than a moving average
 * of equivalent smoothing. Based on John Ehlers' digital signal processing work.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Super Smoother options
 */
export type SuperSmootherOptions = {
  /** Cutoff period for the filter */
  period: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Ehlers 2-pole Super Smoother Filter
 *
 * The Super Smoother filter is an IIR (Infinite Impulse Response) filter
 * that removes high-frequency noise while preserving the underlying signal
 * with minimal lag.
 *
 * Coefficients:
 * - a1 = exp(-sqrt(2) * pi / period)
 * - b1 = 2 * a1 * cos(sqrt(2) * pi / period)
 * - c2 = b1, c3 = -a1^2, c1 = 1 - c2 - c3
 * - output[i] = c1 * (price[i] + price[i-1]) / 2 + c2 * output[i-1] + c3 * output[i-2]
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Super Smoother options (period, source)
 * @returns Series of filtered values (null for first 2 bars)
 *
 * @example
 * ```ts
 * const ss = superSmoother(candles, { period: 10 });
 * ```
 */
export function superSmoother(
  candles: Candle[] | NormalizedCandle[],
  options: SuperSmootherOptions,
): Series<number | null> {
  const { period, source = "close" } = options;

  if (period < 1) {
    throw new Error("Super Smoother period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  if (normalized.length === 0) {
    return result;
  }

  // Calculate coefficients
  const sqrt2 = Math.SQRT2;
  const piOverPeriod = Math.PI / period;
  const a1 = Math.exp(-sqrt2 * piOverPeriod);
  const b1 = 2 * a1 * Math.cos(sqrt2 * piOverPeriod);
  const c2 = b1;
  const c3 = -(a1 * a1);
  const c1 = 1 - c2 - c3;

  // First 2 bars are null (not enough history for IIR filter)
  const output: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const price = getPrice(normalized[i], source);

    if (i < 2) {
      result.push({ time: normalized[i].time, value: null });
      output.push(price); // Seed with raw price for IIR warmup
    } else {
      const prevPrice = getPrice(normalized[i - 1], source);
      const val = (c1 * (price + prevPrice)) / 2 + c2 * output[i - 1] + c3 * output[i - 2];
      output.push(val);
      result.push({ time: normalized[i].time, value: val });
    }
  }

  return result;
}
