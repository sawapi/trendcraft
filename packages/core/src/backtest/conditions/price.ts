/**
 * Price conditions
 */

import { sma } from "../../indicators/moving-average/sma";
import { atr } from "../../indicators/volatility/atr";
import type { PresetCondition } from "../../types";

// ============================================
// Price Conditions
// ============================================

/**
 * Price is above a specific moving average
 */
export function priceAboveSma(period: number): PresetCondition {
  return {
    type: "preset",
    name: `priceAboveSma(${period})`,
    evaluate: (indicators, candle, index, candles) => {
      let smaData = indicators[`sma${period}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!smaData) {
        smaData = sma(candles, { period });
        indicators[`sma${period}`] = smaData;
      }

      const value = smaData[index]?.value;
      return value !== null && candle.close > value;
    },
  };
}

/**
 * Price is below a specific moving average
 */
export function priceBelowSma(period: number): PresetCondition {
  return {
    type: "preset",
    name: `priceBelowSma(${period})`,
    evaluate: (indicators, candle, index, candles) => {
      let smaData = indicators[`sma${period}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!smaData) {
        smaData = sma(candles, { period });
        indicators[`sma${period}`] = smaData;
      }

      const value = smaData[index]?.value;
      return value !== null && candle.close < value;
    },
  };
}

// ============================================
// ATR-Based Conditions
// ============================================

/**
 * Price dropped by N times ATR from recent high
 *
 * Simpler stateless version - checks if current price is N*ATR below the highest
 * price in the lookback period.
 *
 * @param multiplier - ATR multiplier (e.g., 2.0 = 2x ATR below high)
 * @param lookback - Period to find the highest high (default: 10)
 * @param atrPeriod - ATR calculation period (default: 14)
 *
 * @example
 * ```ts
 * // Exit when price is 2x ATR below the 10-bar high
 * const exit = or(
 *   priceDroppedAtr(2.0, 10),
 *   inRangeBound()
 * );
 * ```
 */
export function priceDroppedAtr(multiplier = 2.0, lookback = 10, atrPeriod = 14): PresetCondition {
  return {
    type: "preset",
    name: `priceDroppedAtr(${multiplier}, ${lookback}, ${atrPeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < lookback) return false;

      // Get or calculate ATR
      let atrData = indicators[`atr${atrPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!atrData) {
        atrData = atr(candles, { period: atrPeriod });
        indicators[`atr${atrPeriod}`] = atrData;
      }

      const currentAtr = atrData[index]?.value;
      if (currentAtr === null || currentAtr === undefined) return false;

      // Find highest high in lookback period
      let highestHigh = 0;
      for (let i = index - lookback; i <= index; i++) {
        if (candles[i].high > highestHigh) {
          highestHigh = candles[i].high;
        }
      }

      // Calculate threshold
      const threshold = highestHigh - currentAtr * multiplier;

      return candle.close < threshold;
    },
  };
}
