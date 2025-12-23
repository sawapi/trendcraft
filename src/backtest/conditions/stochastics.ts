/**
 * Stochastics conditions
 */

import type { PresetCondition } from "../../types";
import { slowStochastics } from "../../indicators/momentum/stochastics";

// ============================================
// Stochastics Conditions
// ============================================

/**
 * Stochastics %K below threshold (oversold)
 * @param threshold %K threshold (default: 20)
 */
export function stochBelow(threshold = 20, kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochBelow(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const stoch = stochData[index]?.value;
      return stoch?.k !== null && stoch?.k !== undefined && stoch.k < threshold;
    },
  };
}

/**
 * Stochastics %K above threshold (overbought)
 * @param threshold %K threshold (default: 80)
 */
export function stochAbove(threshold = 80, kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const stoch = stochData[index]?.value;
      return stoch?.k !== null && stoch?.k !== undefined && stoch.k > threshold;
    },
  };
}

/**
 * Stochastics Golden Cross: %K crosses above %D
 */
export function stochCrossUp(kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochCrossUp()`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const curr = stochData[index]?.value;
      const prev = stochData[index - 1]?.value;

      if (!curr || !prev || curr.k === null || curr.d === null || prev.k === null || prev.d === null) {
        return false;
      }

      return prev.k <= prev.d && curr.k > curr.d;
    },
  };
}

/**
 * Stochastics Dead Cross: %K crosses below %D
 */
export function stochCrossDown(kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochCrossDown()`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const curr = stochData[index]?.value;
      const prev = stochData[index - 1]?.value;

      if (!curr || !prev || curr.k === null || curr.d === null || prev.k === null || prev.d === null) {
        return false;
      }

      return prev.k >= prev.d && curr.k < curr.d;
    },
  };
}
