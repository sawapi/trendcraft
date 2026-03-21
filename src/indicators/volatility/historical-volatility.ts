/**
 * Historical Volatility (HV) indicator
 *
 * Measures the annualized standard deviation of logarithmic returns,
 * providing a statistical measure of price volatility.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Historical Volatility options
 */
export type HistoricalVolatilityOptions = {
  /** Period for calculation (default: 20) */
  period?: number;
  /** Trading days per year for annualization (default: 252) */
  annualFactor?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Historical Volatility
 *
 * 1. Calculate log returns: ln(close_t / close_{t-1})
 * 2. Calculate standard deviation of log returns over period
 * 3. Annualize: HV = StdDev × sqrt(annualFactor) × 100
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Historical Volatility options
 * @returns Series of HV values (percentage, null for insufficient data)
 *
 * @example
 * ```ts
 * const hv = historicalVolatility(candles); // 20-day HV
 * const hv10 = historicalVolatility(candles, { period: 10 });
 * ```
 */
export function historicalVolatility(
  candles: Candle[] | NormalizedCandle[],
  options: HistoricalVolatilityOptions = {},
): Series<number | null> {
  const { period = 20, annualFactor = 252, source = "close" } = options;

  if (period < 2) {
    throw new Error("Historical Volatility period must be at least 2");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));

  // Calculate log returns
  const logReturns: (number | null)[] = [null];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      logReturns.push(null);
    }
  }

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Collect log returns for the period
    let sum = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (logReturns[j] === null) {
        valid = false;
        break;
      }
      sum += logReturns[j] as number;
    }

    if (!valid) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    const mean = sum / period;

    // Calculate variance
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = (logReturns[j] as number) - mean;
      sumSqDiff += diff * diff;
    }

    const variance = sumSqDiff / (period - 1); // Sample variance
    const stdDev = Math.sqrt(variance);
    const hv = stdDev * Math.sqrt(annualFactor) * 100;

    result.push({ time: normalized[i].time, value: hv });
  }

  return result;
}
