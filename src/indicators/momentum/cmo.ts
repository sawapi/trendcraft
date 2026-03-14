/**
 * Chande Momentum Oscillator (CMO) indicator
 *
 * Created by Tushar Chande, CMO measures momentum using both up and down
 * price movement, oscillating between -100 and +100.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * CMO options
 */
export type CmoOptions = {
  /** Period for CMO calculation (default: 14) */
  period?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Chande Momentum Oscillator
 *
 * CMO = 100 × (Sum of Up Changes - Sum of Down Changes) / (Sum of Up Changes + Sum of Down Changes)
 *
 * Interpretation:
 * - Above +50: Overbought
 * - Below -50: Oversold
 * - Zero-line crossovers signal trend changes
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - CMO options
 * @returns Series of CMO values (-100 to +100, null for insufficient data)
 *
 * @example
 * ```ts
 * const cmoData = cmo(candles);
 * const isOverbought = cmoData[i].value !== null && cmoData[i].value! > 50;
 * ```
 */
export function cmo(
  candles: Candle[] | NormalizedCandle[],
  options: CmoOptions = {},
): Series<number | null> {
  const { period = 14, source = "close" } = options;

  if (period < 1) {
    throw new Error("CMO period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));

  // Calculate up and down changes
  const ups: number[] = [0];
  const downs: number[] = [0];

  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    ups.push(diff > 0 ? diff : 0);
    downs.push(diff < 0 ? -diff : 0);
  }

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let sumUp = 0;
    let sumDown = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumUp += ups[j];
      sumDown += downs[j];
    }

    const total = sumUp + sumDown;
    const cmoValue = total === 0 ? 0 : (100 * (sumUp - sumDown)) / total;
    result.push({ time: normalized[i].time, value: cmoValue });
  }

  return result;
}
