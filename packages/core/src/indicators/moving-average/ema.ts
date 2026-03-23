/**
 * Exponential Moving Average (EMA) indicator
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, EmaOptions, NormalizedCandle, Series } from "../../types";

/**
 * Calculate Exponential Moving Average
 *
 * EMA gives more weight to recent prices using a smoothing factor.
 * Multiplier = 2 / (period + 1)
 * EMA = (Price * Multiplier) + (Previous EMA * (1 - Multiplier))
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - EMA options (period, source)
 * @returns Series of EMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const ema12 = ema(candles, { period: 12 });
 * const ema26 = ema(candles, { period: 26, source: 'close' });
 * ```
 */
export function ema(
  candles: Candle[] | NormalizedCandle[],
  options: EmaOptions,
): Series<number | null> {
  const { period, source = "close" } = options;

  if (period < 1) {
    throw new Error("EMA period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("EMA period must be an integer");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];
  const multiplier = 2 / (period + 1);

  let prevEma: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    const price = getPrice(normalized[i], source);

    if (i < period - 1) {
      // Not enough data yet
      result.push({ time: normalized[i].time, value: null });
    } else if (i === period - 1) {
      // First EMA is SMA of first `period` values
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += getPrice(normalized[j], source);
      }
      prevEma = sum / period;
      result.push({ time: normalized[i].time, value: prevEma });
    } else {
      // EMA = (Price * Multiplier) + (Previous EMA * (1 - Multiplier))
      prevEma = price * multiplier + (prevEma ?? 0) * (1 - multiplier);
      result.push({ time: normalized[i].time, value: prevEma });
    }
  }

  return tagSeries(result, { overlay: true, label: "EMA" });
}
