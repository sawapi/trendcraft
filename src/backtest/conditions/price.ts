/**
 * Price conditions
 */

import type { PresetCondition } from "../../types";
import { sma } from "../../indicators/moving-average/sma";

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
      let smaData = indicators[`sma${period}`] as { time: number; value: number | null }[] | undefined;

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
      let smaData = indicators[`sma${period}`] as { time: number; value: number | null }[] | undefined;

      if (!smaData) {
        smaData = sma(candles, { period });
        indicators[`sma${period}`] = smaData;
      }

      const value = smaData[index]?.value;
      return value !== null && candle.close < value;
    },
  };
}
