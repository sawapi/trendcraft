/**
 * Returns calculation indicator
 */

import { normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, ReturnsOptions, Series } from "../../types";

/**
 * Calculate price returns
 *
 * Simple Return = (Current Price - Previous Price) / Previous Price
 * Log Return = ln(Current Price / Previous Price)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Returns options (period=1, type='simple')
 * @returns Series of return values
 *
 * @example
 * ```ts
 * const dailyReturns = returns(candles); // 1-period simple returns
 * const weeklyReturns = returns(candles, { period: 5 }); // 5-period returns
 * const logReturns = returns(candles, { type: 'log' }); // Log returns
 * ```
 */
export function returns(
  candles: Candle[] | NormalizedCandle[],
  options: ReturnsOptions = {}
): Series<number | null> {
  const { period = 1, type = "simple" } = options;

  if (period < 1) {
    throw new Error("Returns period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      // Not enough data for n-period return
      result.push({ time: normalized[i].time, value: null });
    } else {
      const currentPrice = normalized[i].close;
      const previousPrice = normalized[i - period].close;

      if (previousPrice === 0) {
        result.push({ time: normalized[i].time, value: null });
      } else if (type === "log") {
        // Log return
        const logReturn = Math.log(currentPrice / previousPrice);
        result.push({ time: normalized[i].time, value: logReturn });
      } else {
        // Simple return
        const simpleReturn = (currentPrice - previousPrice) / previousPrice;
        result.push({ time: normalized[i].time, value: simpleReturn });
      }
    }
  }

  return result;
}

/**
 * Calculate cumulative returns from a starting point
 *
 * @param candles - Array of candles
 * @param type - Return type ('simple' or 'log')
 * @returns Series of cumulative return values
 */
export function cumulativeReturns(
  candles: Candle[] | NormalizedCandle[],
  type: "simple" | "log" = "simple"
): Series<number | null> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];
  const startPrice = normalized[0].close;

  if (startPrice === 0) {
    return normalized.map((c) => ({ time: c.time, value: null }));
  }

  for (let i = 0; i < normalized.length; i++) {
    const currentPrice = normalized[i].close;

    if (type === "log") {
      const cumReturn = Math.log(currentPrice / startPrice);
      result.push({ time: normalized[i].time, value: cumReturn });
    } else {
      const cumReturn = (currentPrice - startPrice) / startPrice;
      result.push({ time: normalized[i].time, value: cumReturn });
    }
  }

  return result;
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
