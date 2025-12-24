/**
 * Volume Weighted Average Price (VWAP) indicator
 *
 * VWAP is the ratio of the value traded to total volume traded over a period.
 * It is commonly used by institutional investors as a benchmark.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * VWAP options
 */
export type VwapOptions = {
  /**
   * Reset period for VWAP calculation
   * - 'session': Reset at the start of each day (default)
   * - 'rolling': Rolling VWAP over specified period
   * - number: Reset every N candles
   */
  resetPeriod?: "session" | "rolling" | number;
  /** Period for rolling VWAP (only used when resetPeriod is 'rolling') */
  period?: number;
};

/**
 * VWAP value
 */
export type VwapValue = {
  /** VWAP value */
  vwap: number | null;
  /** Upper band (VWAP + stdDev) */
  upper: number | null;
  /** Lower band (VWAP - stdDev) */
  lower: number | null;
};

/**
 * Calculate Volume Weighted Average Price
 *
 * VWAP = Cumulative(Typical Price × Volume) / Cumulative(Volume)
 * Typical Price = (High + Low + Close) / 3
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - VWAP options
 * @returns Series of VWAP values
 *
 * @example
 * ```ts
 * // Session VWAP (resets daily)
 * const sessionVwap = vwap(candles);
 *
 * // Rolling VWAP over 20 periods
 * const rollingVwap = vwap(candles, { resetPeriod: 'rolling', period: 20 });
 * ```
 */
export function vwap(
  candles: Candle[] | NormalizedCandle[],
  options: VwapOptions = {},
): Series<VwapValue> {
  const { resetPeriod = "session", period = 20 } = options;

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<VwapValue> = [];

  if (resetPeriod === "rolling") {
    // Rolling VWAP
    for (let i = 0; i < normalized.length; i++) {
      if (i < period - 1) {
        result.push({
          time: normalized[i].time,
          value: { vwap: null, upper: null, lower: null },
        });
        continue;
      }

      let cumulativeTpv = 0;
      let cumulativeVolume = 0;
      const tpValues: number[] = [];

      for (let j = i - period + 1; j <= i; j++) {
        const candle = normalized[j];
        const tp = (candle.high + candle.low + candle.close) / 3;
        tpValues.push(tp);
        cumulativeTpv += tp * candle.volume;
        cumulativeVolume += candle.volume;
      }

      const vwapValue = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null;

      // Calculate standard deviation bands
      let upper: number | null = null;
      let lower: number | null = null;

      if (vwapValue !== null && cumulativeVolume > 0) {
        let sumSquaredDiff = 0;
        for (let j = 0; j < tpValues.length; j++) {
          const diff = tpValues[j] - vwapValue;
          sumSquaredDiff += diff * diff * normalized[i - period + 1 + j].volume;
        }
        const variance = sumSquaredDiff / cumulativeVolume;
        const stdDev = Math.sqrt(variance);
        upper = vwapValue + stdDev;
        lower = vwapValue - stdDev;
      }

      result.push({
        time: normalized[i].time,
        value: { vwap: vwapValue, upper, lower },
      });
    }
  } else {
    // Session or fixed period reset
    let cumulativeTpv = 0;
    let cumulativeVolume = 0;
    let sessionStart = 0;
    let lastDayIndex = -1;
    const tpvHistory: { tp: number; volume: number }[] = [];

    // Use integer day calculation to avoid Date object creation overhead
    // This also correctly handles month/year boundaries unlike getDate()
    const MS_PER_DAY = 86400000;

    for (let i = 0; i < normalized.length; i++) {
      const candle = normalized[i];
      // Calculate day index (days since epoch) - faster than creating Date objects
      const currentDayIndex = Math.floor(candle.time / MS_PER_DAY);

      // Check if we need to reset
      let shouldReset = false;
      if (resetPeriod === "session" && currentDayIndex !== lastDayIndex && lastDayIndex !== -1) {
        shouldReset = true;
      } else if (typeof resetPeriod === "number" && i - sessionStart >= resetPeriod) {
        shouldReset = true;
      }

      if (shouldReset) {
        cumulativeTpv = 0;
        cumulativeVolume = 0;
        sessionStart = i;
        tpvHistory.length = 0;
      }

      lastDayIndex = currentDayIndex;

      const tp = (candle.high + candle.low + candle.close) / 3;
      cumulativeTpv += tp * candle.volume;
      cumulativeVolume += candle.volume;
      tpvHistory.push({ tp, volume: candle.volume });

      const vwapValue = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null;

      // Calculate standard deviation bands
      let upper: number | null = null;
      let lower: number | null = null;

      if (vwapValue !== null && cumulativeVolume > 0) {
        let sumSquaredDiff = 0;
        for (const item of tpvHistory) {
          const diff = item.tp - vwapValue;
          sumSquaredDiff += diff * diff * item.volume;
        }
        const variance = sumSquaredDiff / cumulativeVolume;
        const stdDev = Math.sqrt(variance);
        upper = vwapValue + stdDev;
        lower = vwapValue - stdDev;
      }

      result.push({
        time: candle.time,
        value: { vwap: vwapValue, upper, lower },
      });
    }
  }

  return result;
}
