/**
 * McGinley Dynamic
 *
 * An adaptive moving average that automatically adjusts its speed
 * based on market conditions, reducing lag in fast markets.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * McGinley Dynamic options
 */
export type McGinleyDynamicOptions = {
  /** Lookback period (default: 14) */
  period?: number;
  /** Adjustment constant (default: 0.6) */
  k?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate McGinley Dynamic
 *
 * MD[i] = MD[i-1] + (Close - MD[i-1]) / (k × period × (Close / MD[i-1])^4)
 *
 * The initial seed is the SMA of the first `period` values.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of McGinley Dynamic values
 *
 * @example
 * ```ts
 * const md = mcginleyDynamic(candles, { period: 14 });
 * ```
 */
export function mcginleyDynamic(
  candles: Candle[] | NormalizedCandle[],
  options: McGinleyDynamicOptions = {},
): Series<number | null> {
  const { period = 14, k = 0.6, source = "close" } = options;

  if (period < 1) {
    throw new Error("McGinley Dynamic period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("McGinley Dynamic period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];
  let prevMd: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    const price = getPrice(normalized[i], source);

    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else if (i === period - 1) {
      // Seed with SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += getPrice(normalized[j], source);
      }
      prevMd = sum / period;
      result.push({ time: normalized[i].time, value: prevMd });
    } else {
      // McGinley Dynamic formula
      const prev = prevMd as number;
      const ratio = price / prev;
      const denominator = k * period * ratio ** 4;
      prevMd = prev + (price - prev) / denominator;
      result.push({ time: normalized[i].time, value: prevMd });
    }
  }

  return tagSeries(result, { overlay: true, label: "McGinley" });
}
