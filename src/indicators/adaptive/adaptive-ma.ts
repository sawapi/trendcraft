/**
 * Adaptive Moving Average indicator
 *
 * An MA that adjusts its smoothing speed based on the Efficiency Ratio (ER).
 * Similar to KAMA but additionally exposes the efficiency ratio and
 * smoothing constant for analysis.
 *
 * - Trending market (ER close to 1) -> fast smoothing (follows price closely)
 * - Choppy market (ER close to 0) -> slow smoothing (filters noise)
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Adaptive Moving Average configuration options
 */
export type AdaptiveMaOptions = {
  /** Efficiency ratio lookback period (default: 10) */
  erPeriod?: number;
  /** Fast smoothing constant (default: 2/(2+1) = 0.6667) */
  fastConstant?: number;
  /** Slow smoothing constant (default: 2/(30+1) = 0.0645) */
  slowConstant?: number;
};

/**
 * Adaptive Moving Average result value
 */
export type AdaptiveMaValue = {
  /** Adaptive MA value or null if insufficient data */
  value: number | null;
  /** Efficiency ratio at this bar (0-1, 1 = strong trend), or null */
  efficiencyRatio: number | null;
  /** Smoothing constant used at this bar, or null */
  smoothingConstant: number | null;
};

/**
 * Adaptive Moving Average that adjusts smoothing based on the Efficiency Ratio.
 *
 * Algorithm:
 * 1. ER = |Price - Price[erPeriod]| / Sum(|Price[i] - Price[i-1]|, erPeriod)
 * 2. SC = (ER * (fastConstant - slowConstant) + slowConstant)^2
 * 3. AMA = AMA[prev] + SC * (Price - AMA[prev])
 *
 * The computation is similar to KAMA, but this function also exposes the
 * efficiency ratio and smoothing constant at each bar for analysis.
 *
 * @param candles - OHLCV candle data
 * @param options - Adaptive MA configuration
 * @returns Series with MA value, efficiency ratio, and smoothing constant
 *
 * @example
 * ```ts
 * const result = adaptiveMa(candles, { erPeriod: 10 });
 * result.forEach(p => {
 *   if (p.value.efficiencyRatio !== null && p.value.efficiencyRatio > 0.6) {
 *     console.log("Strong trend, MA follows price closely");
 *   }
 * });
 * ```
 */
export function adaptiveMa(
  candles: Candle[] | NormalizedCandle[],
  options: AdaptiveMaOptions = {},
): Series<AdaptiveMaValue> {
  const erPeriod = options.erPeriod ?? 10;
  const fastConstant = options.fastConstant ?? 2 / (2 + 1);
  const slowConstant = options.slowConstant ?? 2 / (30 + 1);

  if (erPeriod < 1) {
    throw new Error("Adaptive MA erPeriod must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  if (normalized.length === 0) return [];

  const result: Series<AdaptiveMaValue> = [];
  let prevAma: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    if (i < erPeriod) {
      result.push({
        time: normalized[i].time,
        value: { value: null, efficiencyRatio: null, smoothingConstant: null },
      });
      // Seed with the price at erPeriod - 1
      if (i === erPeriod - 1) {
        prevAma = getPrice(normalized[i], "close");
      }
      continue;
    }

    const price = getPrice(normalized[i], "close");

    // Direction: absolute price change over the period
    const direction = Math.abs(price - getPrice(normalized[i - erPeriod], "close"));

    // Volatility: sum of absolute bar-to-bar changes over the period
    let volatility = 0;
    for (let j = i - erPeriod + 1; j <= i; j++) {
      volatility += Math.abs(
        getPrice(normalized[j], "close") - getPrice(normalized[j - 1], "close"),
      );
    }

    // Efficiency Ratio
    const er = volatility === 0 ? 0 : direction / volatility;

    // Smoothing Constant
    const sc = (er * (fastConstant - slowConstant) + slowConstant) ** 2;

    // AMA value
    const prev: number = prevAma ?? price;
    const amaValue: number = prev + sc * (price - prev);
    prevAma = amaValue;

    result.push({
      time: normalized[i].time,
      value: { value: amaValue, efficiencyRatio: er, smoothingConstant: sc },
    });
  }

  return result;
}
