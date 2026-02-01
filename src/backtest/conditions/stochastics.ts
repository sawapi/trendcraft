/**
 * Stochastics conditions
 */

import { slowStochastics } from "../../indicators/momentum/stochastics";
import type { NormalizedCandle, PresetCondition } from "../../types";

type StochData = { time: number; value: { k: number | null; d: number | null } }[];

/**
 * Get or calculate stochastics data with caching
 */
function getStochData(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  kPeriod: number,
  dPeriod: number,
): StochData {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;
  let stochData = indicators[cacheKey] as StochData | undefined;

  if (!stochData) {
    stochData = slowStochastics(candles, { kPeriod, dPeriod });
    indicators[cacheKey] = stochData;
  }

  return stochData;
}

// ============================================
// Stochastics Conditions
// ============================================

/**
 * Stochastics %K below threshold (oversold)
 * @param threshold %K threshold (default: 20)
 */
export function stochBelow(threshold = 20, kPeriod = 14, dPeriod = 3): PresetCondition {
  return {
    type: "preset",
    name: `stochBelow(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      const stochData = getStochData(indicators, candles, kPeriod, dPeriod);
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
  return {
    type: "preset",
    name: `stochAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      const stochData = getStochData(indicators, candles, kPeriod, dPeriod);
      const stoch = stochData[index]?.value;
      return stoch?.k !== null && stoch?.k !== undefined && stoch.k > threshold;
    },
  };
}

/**
 * Check if stochastics values are valid for cross detection
 */
function hasValidStochValues(
  curr: { k: number | null; d: number | null } | undefined,
  prev: { k: number | null; d: number | null } | undefined,
): curr is { k: number; d: number } {
  return (
    curr !== undefined &&
    prev !== undefined &&
    curr.k !== null &&
    curr.d !== null &&
    prev.k !== null &&
    prev.d !== null
  );
}

/**
 * Stochastics Golden Cross: %K crosses above %D
 */
export function stochCrossUp(kPeriod = 14, dPeriod = 3): PresetCondition {
  return {
    type: "preset",
    name: "stochCrossUp()",
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      const stochData = getStochData(indicators, candles, kPeriod, dPeriod);
      const curr = stochData[index]?.value;
      const prev = stochData[index - 1]?.value;

      if (!hasValidStochValues(curr, prev)) return false;

      return prev.k! <= prev.d! && curr.k! > curr.d!;
    },
  };
}

/**
 * Stochastics Dead Cross: %K crosses below %D
 */
export function stochCrossDown(kPeriod = 14, dPeriod = 3): PresetCondition {
  return {
    type: "preset",
    name: "stochCrossDown()",
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      const stochData = getStochData(indicators, candles, kPeriod, dPeriod);
      const curr = stochData[index]?.value;
      const prev = stochData[index - 1]?.value;

      if (!hasValidStochValues(curr, prev)) return false;

      return prev.k! >= prev.d! && curr.k! < curr.d!;
    },
  };
}
