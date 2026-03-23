/**
 * Garman-Klass Volatility estimator
 *
 * A more efficient volatility estimator that uses OHLC data instead
 * of just close prices, providing better estimates with fewer data points.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Garman-Klass options
 */
export type GarmanKlassOptions = {
  /** Period for calculation (default: 20) */
  period?: number;
  /** Trading days per year for annualization (default: 252) */
  annualFactor?: number;
};

/**
 * Calculate Garman-Klass Volatility
 *
 * GK = sqrt(1/n × sum(0.5×ln(H/L)^2 - (2ln2-1)×ln(C/O)^2)) × sqrt(annualFactor) × 100
 *
 * More efficient than close-to-close volatility (about 7.4x).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Garman-Klass options
 * @returns Series of GK volatility values (percentage, null for insufficient data)
 *
 * @example
 * ```ts
 * const gk = garmanKlass(candles); // 20-period GK volatility
 * const gk10 = garmanKlass(candles, { period: 10 });
 * ```
 */
export function garmanKlass(
  candles: Candle[] | NormalizedCandle[],
  options: GarmanKlassOptions = {},
): Series<number | null> {
  const { period = 20, annualFactor = 252 } = options;

  if (period < 1) {
    throw new Error("Garman-Klass period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  const ln2 = Math.log(2);

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let sum = 0;
    let valid = true;

    for (let j = i - period + 1; j <= i; j++) {
      const { open, high, low, close } = normalized[j];

      if (low <= 0 || open <= 0) {
        valid = false;
        break;
      }

      const logHL = Math.log(high / low);
      const logCO = Math.log(close / open);

      sum += 0.5 * logHL * logHL - (2 * ln2 - 1) * logCO * logCO;
    }

    if (!valid) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    const gk = Math.sqrt((sum / period) * annualFactor) * 100;
    result.push({ time: normalized[i].time, value: gk });
  }

  return tagSeries(result, { pane: "sub", label: "GK Vol" });
}
