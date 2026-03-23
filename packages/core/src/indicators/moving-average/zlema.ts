/**
 * Zero-Lag Exponential Moving Average (ZLEMA) indicator
 *
 * ZLEMA attempts to eliminate the inherent lag of EMA by adjusting
 * the input data before applying the EMA calculation.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * ZLEMA options
 */
export type ZlemaOptions = {
  /** Period for ZLEMA calculation (default: 20) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Zero-Lag Exponential Moving Average
 *
 * ZLEMA = EMA(adjusted_price, period)
 * Where: adjusted_price = price + (price - price[lag])
 * And: lag = floor((period - 1) / 2)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - ZLEMA options
 * @returns Series of ZLEMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const zlema20 = zlema(candles); // Default 20-period ZLEMA
 * const zlema10 = zlema(candles, { period: 10 });
 * ```
 */
export function zlema(
  candles: Candle[] | NormalizedCandle[],
  options: ZlemaOptions = {},
): Series<number | null> {
  const { period = 20, source = "close" } = options;

  if (period < 1) {
    throw new Error("ZLEMA period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("ZLEMA period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const lag = Math.floor((period - 1) / 2);
  const multiplier = 2 / (period + 1);

  let prevZlema: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    const price = getPrice(normalized[i], source);

    if (i < lag) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Adjusted price to compensate for lag
    const lagPrice = getPrice(normalized[i - lag], source);
    const adjustedPrice = price + (price - lagPrice);

    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else if (i === period - 1) {
      // Seed with SMA of adjusted prices
      let sum = 0;
      for (let j = lag; j <= i; j++) {
        const p = getPrice(normalized[j], source);
        const lp = getPrice(normalized[j - lag], source);
        sum += p + (p - lp);
      }
      prevZlema = sum / (i - lag + 1);
      result.push({ time: normalized[i].time, value: prevZlema });
    } else {
      prevZlema = adjustedPrice * multiplier + (prevZlema ?? 0) * (1 - multiplier);
      result.push({ time: normalized[i].time, value: prevZlema });
    }
  }

  return tagSeries(result, { pane: "main", label: "ZLEMA" });
}
