/**
 * Triple Exponential Moving Average (TEMA) indicator
 *
 * TEMA further reduces lag compared to DEMA by applying EMA three times
 * and using a correction formula.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * TEMA options
 */
export type TemaOptions = {
  /** Period for TEMA calculation (default: 20) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Triple Exponential Moving Average
 *
 * TEMA = 3 * EMA1 - 3 * EMA2 + EMA3
 * Where:
 *   EMA1 = EMA(price, period)
 *   EMA2 = EMA(EMA1, period)
 *   EMA3 = EMA(EMA2, period)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - TEMA options
 * @returns Series of TEMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const tema20 = tema(candles); // Default 20-period TEMA
 * const tema10 = tema(candles, { period: 10 });
 * ```
 */
export function tema(
  candles: Candle[] | NormalizedCandle[],
  options: TemaOptions = {},
): Series<number | null> {
  const { period = 20, source = "close" } = options;

  if (period < 1) {
    throw new Error("TEMA period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("TEMA period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const multiplier = 2 / (period + 1);

  // Helper to compute EMA series from an array of values
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

  // Extract prices
  const prices: (number | null)[] = normalized.map((c) => getPrice(c, source));

  // Three cascaded EMAs
  const ema1 = computeEma(prices);
  const ema2 = computeEma(ema1);
  const ema3 = computeEma(ema2);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    const e1 = ema1[i];
    const e2 = ema2[i];
    const e3 = ema3[i];

    if (e1 === null || e2 === null || e3 === null) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      result.push({ time: normalized[i].time, value: 3 * e1 - 3 * e2 + e3 });
    }
  }

  return tagSeries(result, { overlay: true, label: "TEMA" });
}
