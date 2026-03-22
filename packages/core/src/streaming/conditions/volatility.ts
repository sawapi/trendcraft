/**
 * Volatility Streaming Conditions
 */

import { getNumber } from "../snapshot-utils";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: ATR as percentage of close is above threshold
 *
 * @param threshold - ATR% threshold (default: 2.0 = 2%)
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function atrPercentAbove(threshold = 2.0, key = "atr"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `atrPercentAbove(${threshold}%)`,
    evaluate: (snapshot, candle) => {
      const atr = getNumber(snapshot, key);
      if (atr === null || candle.close === 0) return false;
      return (atr / candle.close) * 100 > threshold;
    },
  };
}

/**
 * Condition: ATR as percentage of close is below threshold
 *
 * @param threshold - ATR% threshold (default: 1.0 = 1%)
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function atrPercentBelow(threshold = 1.0, key = "atr"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `atrPercentBelow(${threshold}%)`,
    evaluate: (snapshot, candle) => {
      const atr = getNumber(snapshot, key);
      if (atr === null || candle.close === 0) return false;
      return (atr / candle.close) * 100 < threshold;
    },
  };
}

/**
 * Condition: Volatility is expanding (ATR rising)
 *
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function volatilityExpanding(key = "atr"): StreamingPresetCondition {
  let prevAtr: number | null = null;

  return {
    type: "preset",
    name: `volatilityExpanding(${key})`,
    evaluate: (snapshot) => {
      const atr = getNumber(snapshot, key);
      const expanding = prevAtr !== null && atr !== null && atr > prevAtr;
      prevAtr = atr;
      return expanding;
    },
  };
}

/**
 * Condition: Volatility is contracting (ATR falling)
 *
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function volatilityContracting(key = "atr"): StreamingPresetCondition {
  let prevAtr: number | null = null;

  return {
    type: "preset",
    name: `volatilityContracting(${key})`,
    evaluate: (snapshot) => {
      const atr = getNumber(snapshot, key);
      const contracting = prevAtr !== null && atr !== null && atr < prevAtr;
      prevAtr = atr;
      return contracting;
    },
  };
}
