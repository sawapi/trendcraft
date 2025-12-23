/**
 * RSI conditions
 */

import type { PresetCondition } from "../../types";
import { rsi } from "../../indicators/momentum/rsi";

// ============================================
// RSI Conditions
// ============================================

/**
 * RSI below threshold (oversold)
 * @param threshold RSI threshold (default: 30)
 * @param period RSI period (default: 14)
 */
export function rsiBelow(threshold = 30, period = 14): PresetCondition {
  return {
    type: "preset",
    name: `rsiBelow(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let rsiData = indicators[`rsi${period}`] as { time: number; value: number | null }[] | undefined;

      if (!rsiData) {
        rsiData = rsi(candles, { period });
        indicators[`rsi${period}`] = rsiData;
      }

      const value = rsiData[index]?.value;
      return value !== null && value < threshold;
    },
  };
}

/**
 * RSI above threshold (overbought)
 * @param threshold RSI threshold (default: 70)
 * @param period RSI period (default: 14)
 */
export function rsiAbove(threshold = 70, period = 14): PresetCondition {
  return {
    type: "preset",
    name: `rsiAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let rsiData = indicators[`rsi${period}`] as { time: number; value: number | null }[] | undefined;

      if (!rsiData) {
        rsiData = rsi(candles, { period });
        indicators[`rsi${period}`] = rsiData;
      }

      const value = rsiData[index]?.value;
      return value !== null && value > threshold;
    },
  };
}
