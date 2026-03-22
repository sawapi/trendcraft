/**
 * Ehlers Roofing Filter
 *
 * Combines a high-pass filter (removes low-frequency trends) with a
 * Super Smoother low-pass filter (removes high-frequency noise),
 * isolating the dominant cycle in price data.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Roofing Filter options
 */
export type RoofingFilterOptions = {
  /** High-pass filter period to remove low-frequency trends (default: 48) */
  highPassPeriod?: number;
  /** Low-pass (Super Smoother) period to remove high-frequency noise (default: 10) */
  lowPassPeriod?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Ehlers Roofing Filter
 *
 * The Roofing Filter is a bandpass filter that:
 * 1. Applies a 2-pole high-pass filter to remove low-frequency trend components
 * 2. Applies a Super Smoother to remove high-frequency noise
 *
 * The result oscillates around zero, making it useful for identifying
 * cyclic turning points independent of trend.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Roofing filter options
 * @returns Series of filtered values (null for first 2 bars)
 *
 * @example
 * ```ts
 * const rf = roofingFilter(candles, { highPassPeriod: 48, lowPassPeriod: 10 });
 * ```
 */
export function roofingFilter(
  candles: Candle[] | NormalizedCandle[],
  options: RoofingFilterOptions = {},
): Series<number | null> {
  const { highPassPeriod = 48, lowPassPeriod = 10, source = "close" } = options;

  if (highPassPeriod < 1) {
    throw new Error("Roofing filter highPassPeriod must be at least 1");
  }
  if (lowPassPeriod < 1) {
    throw new Error("Roofing filter lowPassPeriod must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  if (normalized.length === 0) {
    return result;
  }

  // High-pass filter coefficients (2-pole Butterworth)
  const a1HP = Math.exp((-Math.SQRT2 * Math.PI) / highPassPeriod);
  const b1HP = 2 * a1HP * Math.cos((Math.SQRT2 * Math.PI) / highPassPeriod);
  const c2HP = b1HP;
  const c3HP = -(a1HP * a1HP);
  const c1HP = (1 + c2HP - c3HP) / 4; // Coefficient for 2-pole high-pass

  // Super Smoother (low-pass) coefficients
  const a1SS = Math.exp((-Math.SQRT2 * Math.PI) / lowPassPeriod);
  const b1SS = 2 * a1SS * Math.cos((Math.SQRT2 * Math.PI) / lowPassPeriod);
  const c2SS = b1SS;
  const c3SS = -(a1SS * a1SS);
  const c1SS = 1 - c2SS - c3SS;

  const hp: number[] = []; // High-pass filtered values
  const filt: number[] = []; // Final filtered values

  for (let i = 0; i < normalized.length; i++) {
    const price = getPrice(normalized[i], source);

    if (i < 2) {
      hp.push(0);
      filt.push(0);
      result.push({ time: normalized[i].time, value: null });
    } else {
      const price1 = getPrice(normalized[i - 1], source);
      const price2 = getPrice(normalized[i - 2], source);

      // 2-pole high-pass filter
      const hpVal = c1HP * (price - 2 * price1 + price2) + c2HP * hp[i - 1] + c3HP * hp[i - 2];
      hp.push(hpVal);

      // Super Smoother applied to high-pass output
      const filtVal = (c1SS * (hpVal + hp[i - 1])) / 2 + c2SS * filt[i - 1] + c3SS * filt[i - 2];
      filt.push(filtVal);

      result.push({ time: normalized[i].time, value: filtVal });
    }
  }

  return result;
}
