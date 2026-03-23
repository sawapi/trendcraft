/**
 * Cumulative Volume Delta (CVD)
 *
 * A volume-based indicator that measures the cumulative difference between
 * buying and selling volume. Buy volume is estimated using the close position
 * within the bar's range.
 *
 * Calculation:
 * - buyVolume = volume * (close - low) / (high - low)
 * - sellVolume = volume - buyVolume
 * - delta = buyVolume - sellVolume
 * - CVD = running sum of delta
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Options for cvdWithSignal
 */
export type CvdWithSignalOptions = {
  /** EMA smoothing period for CVD (default: 1, no smoothing) */
  smoothing?: number;
  /** EMA period for the signal line (default: 9) */
  signalPeriod?: number;
};

/**
 * Value type for cvdWithSignal
 */
export type CvdWithSignalValue = {
  /** CVD value (optionally smoothed) */
  cvd: number;
  /** Signal line value (EMA of CVD), null when not enough data */
  signal: number | null;
};

/**
 * Compute EMA on a raw number array
 */
function computeEma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let emaValue: number | null = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      emaValue = sum / period;
      result.push(emaValue);
    } else {
      emaValue = values[i] * k + (emaValue as number) * (1 - k);
      result.push(emaValue);
    }
  }

  return result;
}

/**
 * Calculate Cumulative Volume Delta (CVD)
 *
 * Estimates buying vs selling pressure by measuring where the close
 * falls within each bar's range, then accumulates the delta.
 *
 * Interpretation:
 * - Rising CVD: Net buying pressure (accumulation)
 * - Falling CVD: Net selling pressure (distribution)
 * - CVD diverging from price signals potential reversal
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of CVD values
 *
 * @example
 * ```ts
 * const cvdData = cvd(candles);
 * const currentCvd = cvdData[i].value;
 *
 * // CVD increasing = net buying pressure
 * if (cvdData[i].value > cvdData[i - 1].value) {
 *   // Buying pressure dominant
 * }
 * ```
 */
export function cvd(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number> = [];
  let cumulative = 0;

  for (let i = 0; i < normalized.length; i++) {
    const { high, low, close, volume } = normalized[i];
    const range = high - low;

    let delta: number;
    if (range === 0) {
      delta = 0;
    } else {
      const buyVolume = volume * ((close - low) / range);
      const sellVolume = volume - buyVolume;
      delta = buyVolume - sellVolume;
    }

    cumulative += delta;
    result.push({ time: normalized[i].time, value: cumulative });
  }

  return tagSeries(result, { overlay: false, label: "CVD" });
}

/**
 * Calculate CVD with an optional smoothing EMA and a signal line
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Smoothing and signal period options
 * @returns Series of CVD + signal values
 *
 * @example
 * ```ts
 * const data = cvdWithSignal(candles, { smoothing: 5, signalPeriod: 9 });
 * const last = data[data.length - 1].value;
 *
 * // CVD crossing above signal = bullish
 * if (last.cvd > last.signal!) {
 *   // Bullish momentum
 * }
 * ```
 */
export function cvdWithSignal(
  candles: Candle[] | NormalizedCandle[],
  options: CvdWithSignalOptions = {},
): Series<CvdWithSignalValue> {
  const { smoothing = 1, signalPeriod = 9 } = options;

  const cvdData = cvd(candles);
  if (cvdData.length === 0) return [];

  // Apply smoothing to CVD if requested
  let cvdValues = cvdData.map((d) => d.value);
  if (smoothing > 1) {
    const smoothed = computeEma(cvdValues, smoothing);
    // Replace with smoothed values where available, keep raw otherwise
    cvdValues = cvdValues.map((raw, i) => smoothed[i] ?? raw);
  }

  // Compute signal line (EMA of CVD values)
  const signalValues = computeEma(cvdValues, signalPeriod);

  const result = cvdData.map((d, i) => ({
    time: d.time,
    value: {
      cvd: cvdValues[i],
      signal: signalValues[i],
    },
  }));
  return tagSeries(result, { overlay: false, label: "CVD" });
}
