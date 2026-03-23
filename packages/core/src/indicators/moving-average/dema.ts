/**
 * Double Exponential Moving Average (DEMA) indicator
 *
 * DEMA reduces the lag of a traditional EMA by applying EMA twice
 * and using the difference to compensate for lag.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * DEMA options
 */
export type DemaOptions = {
  /** Period for DEMA calculation (default: 20) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Double Exponential Moving Average
 *
 * DEMA = 2 * EMA(price, period) - EMA(EMA(price, period), period)
 *
 * The result has less lag than a standard EMA while maintaining smoothness.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - DEMA options
 * @returns Series of DEMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const dema20 = dema(candles); // Default 20-period DEMA
 * const dema10 = dema(candles, { period: 10 });
 * ```
 */
export function dema(
  candles: Candle[] | NormalizedCandle[],
  options: DemaOptions = {},
): Series<number | null> {
  const { period = 20, source = "close" } = options;

  if (period < 1) {
    throw new Error("DEMA period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("DEMA period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const multiplier = 2 / (period + 1);

  function computeEma(values: (number | null)[]): (number | null)[] {
    const emaResult: (number | null)[] = [];
    let prev: number | null = null;
    let validCount = 0;
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
      if (values[i] === null) {
        emaResult.push(null);
        continue;
      }

      validCount++;
      const val = values[i] as number;

      if (validCount < period) {
        sum += val;
        emaResult.push(null);
      } else if (validCount === period) {
        sum += val;
        prev = sum / period;
        emaResult.push(prev);
      } else {
        prev = val * multiplier + (prev ?? 0) * (1 - multiplier);
        emaResult.push(prev);
      }
    }

    return emaResult;
  }

  const prices: (number | null)[] = normalized.map((c) => getPrice(c, source));
  const ema1 = computeEma(prices);
  const ema2 = computeEma(ema1);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    const e1 = ema1[i];
    const e2 = ema2[i];

    if (e1 === null || e2 === null) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      result.push({ time: normalized[i].time, value: 2 * e1 - e2 });
    }
  }

  return tagSeries(result, { pane: "main", label: "DEMA" });
}
