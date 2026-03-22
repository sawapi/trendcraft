/**
 * RSI conditions
 */

import { rsi } from "../../indicators/momentum/rsi";
import type { PresetCondition } from "../../types";

// ============================================
// RSI Conditions
// ============================================

/**
 * RSI below threshold (oversold)
 * @param threshold RSI threshold (default: 30)
 * @param period RSI period (default: 14)
 * @example
 * ```ts
 * import { runBacktest, rsiBelow, rsiAbove } from "trendcraft";
 *
 * // Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)
 * const result = runBacktest(candles, rsiBelow(30), rsiAbove(70), {
 *   capital: 1_000_000,
 * });
 * ```
 */
export function rsiBelow(threshold = 30, period = 14): PresetCondition {
  return {
    type: "preset",
    name: `rsiBelow(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let rsiData = indicators[`rsi${period}`] as
        | { time: number; value: number | null }[]
        | undefined;

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
 * @example
 * ```ts
 * import { runBacktest, rsiAbove, rsiBelow, and, goldenCrossCondition } from "trendcraft";
 *
 * // Combine: golden cross + RSI filter
 * const entry = and(goldenCrossCondition(), rsiBelow(40));
 * const exit = rsiAbove(70);
 * const result = runBacktest(candles, entry, exit, { capital: 1_000_000 });
 * ```
 */
export function rsiAbove(threshold = 70, period = 14): PresetCondition {
  return {
    type: "preset",
    name: `rsiAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let rsiData = indicators[`rsi${period}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!rsiData) {
        rsiData = rsi(candles, { period });
        indicators[`rsi${period}`] = rsiData;
      }

      const value = rsiData[index]?.value;
      return value !== null && value > threshold;
    },
  };
}
