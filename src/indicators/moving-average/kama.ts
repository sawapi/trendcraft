/**
 * Kaufman Adaptive Moving Average (KAMA)
 *
 * KAMA adapts its smoothing speed based on the Efficiency Ratio (ER),
 * which measures the ratio of price direction to price volatility.
 * In trending markets, KAMA follows price closely; in choppy markets,
 * it becomes more smoothed.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * KAMA options
 */
export type KamaOptions = {
  /** Efficiency ratio lookback period (default: 10) */
  period?: number;
  /** Fast EMA period for the smoothing constant (default: 2) */
  fastPeriod?: number;
  /** Slow EMA period for the smoothing constant (default: 30) */
  slowPeriod?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Kaufman Adaptive Moving Average
 *
 * Algorithm:
 * 1. ER = |Price - Price[period]| / Sum(|Price[i] - Price[i-1]|, period)
 * 2. SC = (ER * (fastSC - slowSC) + slowSC)^2
 *    where fastSC = 2/(fastPeriod+1), slowSC = 2/(slowPeriod+1)
 * 3. KAMA = KAMA[prev] + SC * (Price - KAMA[prev])
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - KAMA options
 * @returns Series of KAMA values
 *
 * @example
 * ```ts
 * const kamaData = kama(candles); // Default KAMA(10, 2, 30)
 * const kamaCustom = kama(candles, { period: 20, fastPeriod: 2, slowPeriod: 30 });
 * ```
 */
export function kama(
  candles: Candle[] | NormalizedCandle[],
  options: KamaOptions = {},
): Series<number | null> {
  const { period = 10, fastPeriod = 2, slowPeriod = 30, source = "close" } = options;

  if (period < 1) {
    throw new Error("KAMA period must be at least 1");
  }
  if (fastPeriod < 1) {
    throw new Error("KAMA fastPeriod must be at least 1");
  }
  if (slowPeriod < 1) {
    throw new Error("KAMA slowPeriod must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  const fastSC = 2 / (fastPeriod + 1);
  const slowSC = 2 / (slowPeriod + 1);

  let prevKama: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      result.push({ time: normalized[i].time, value: null });
      if (i === period - 1) {
        // Seed KAMA with SMA of first period prices (TA-Lib compatible)
        let seedSum = 0;
        for (let j = 0; j <= i; j++) {
          seedSum += getPrice(normalized[j], source);
        }
        prevKama = seedSum / period;
      }
      continue;
    }

    const price = getPrice(normalized[i], source);

    // Direction: absolute price change over the period
    const direction = Math.abs(price - getPrice(normalized[i - period], source));

    // Volatility: sum of absolute day-to-day changes over the period
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++) {
      volatility += Math.abs(getPrice(normalized[j], source) - getPrice(normalized[j - 1], source));
    }

    // Efficiency Ratio
    const er = volatility === 0 ? 0 : direction / volatility;

    // Smoothing Constant
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);

    // KAMA value
    const kamaValue = prevKama! + sc * (price - prevKama!);
    prevKama = kamaValue;

    result.push({ time: normalized[i].time, value: kamaValue });
  }

  return result;
}
