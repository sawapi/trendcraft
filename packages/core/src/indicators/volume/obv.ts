/**
 * OBV (On Balance Volume)
 * Measures buying and selling pressure as a cumulative indicator
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Calculate OBV (On Balance Volume)
 *
 * OBV adds volume on up days and subtracts volume on down days.
 * It's used to confirm price trends and detect divergences.
 *
 * Calculation:
 * - If close > previous close: OBV = previous OBV + volume
 * - If close < previous close: OBV = previous OBV - volume
 * - If close = previous close: OBV = previous OBV
 *
 * Trading signals:
 * - Rising OBV confirms uptrend
 * - Falling OBV confirms downtrend
 * - OBV divergence from price may signal reversal
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of OBV values
 *
 * @example
 * ```ts
 * const obvData = obv(candles);
 * // Rising OBV with rising price = strong uptrend
 * // Falling OBV with rising price = potential reversal
 * ```
 */
export function obv(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number> = [];

  // First candle: OBV starts at volume (or 0, depending on convention)
  // We'll start at 0 and add/subtract from there
  let currentObv = 0;

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];

    if (i === 0) {
      // First bar: OBV starts at 0
      result.push({ time: current.time, value: currentObv });
      continue;
    }

    const prev = normalized[i - 1];

    if (current.close > prev.close) {
      // Price went up: add volume
      currentObv += current.volume;
    } else if (current.close < prev.close) {
      // Price went down: subtract volume
      currentObv -= current.volume;
    }
    // If close === prev.close: OBV stays the same

    result.push({ time: current.time, value: currentObv });
  }

  return tagSeries(result, { overlay: false, label: "OBV" });
}
