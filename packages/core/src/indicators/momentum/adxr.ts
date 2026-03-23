/**
 * ADXR (Average Directional Movement Index Rating)
 *
 * Smoothed version of ADX: (ADX[i] + ADX[i-period]) / 2
 */

import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { dmi } from "./dmi";

/**
 * ADXR options
 */
export type AdxrOptions = {
  /** ADXR lookback period (default: 14) */
  period?: number;
  /** DMI period (default: 14) */
  dmiPeriod?: number;
  /** ADX smoothing period (default: 14) */
  adxPeriod?: number;
};

/**
 * Calculate ADXR (Average Directional Movement Index Rating)
 *
 * ADXR = (ADX[i] + ADX[i - period]) / 2
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of ADXR values
 *
 * @example
 * ```ts
 * const result = adxr(candles, { period: 14 });
 * ```
 */
export function adxr(
  candles: Candle[] | NormalizedCandle[],
  options: AdxrOptions = {},
): Series<number | null> {
  const { period = 14, dmiPeriod = 14, adxPeriod = 14 } = options;

  if (period < 1) {
    throw new Error("ADXR period must be at least 1");
  }

  // dmi() handles normalization internally
  const dmiResult = dmi(candles, { period: dmiPeriod, adxPeriod });

  if (dmiResult.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];

  // ADXR lookback is period-1 (matches TA-Lib: adx[i] + adx[i-(period-1)])
  const lookback = period - 1;

  for (let i = 0; i < dmiResult.length; i++) {
    const currentAdx = dmiResult[i].value.adx;

    if (currentAdx === null || i < lookback || dmiResult[i - lookback].value.adx === null) {
      result.push({ time: dmiResult[i].time, value: null });
    } else {
      const pastAdx = dmiResult[i - lookback].value.adx as number;
      result.push({
        time: dmiResult[i].time,
        value: (currentAdx + pastAdx) / 2,
      });
    }
  }

  return tagSeries(result, { overlay: false, label: "ADXR", yRange: [0, 100] });
}
