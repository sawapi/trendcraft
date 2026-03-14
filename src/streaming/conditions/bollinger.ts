/**
 * Bollinger Bands Streaming Conditions
 */

import { getField } from "../snapshot-utils";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: Price breaks above/below Bollinger Band
 *
 * @param band - Which band to check ("upper" or "lower")
 * @param key - Snapshot key for Bollinger Bands (default: "bb")
 */
export function bollingerBreakout(band: "upper" | "lower", key = "bb"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `bollingerBreakout(${band})`,
    evaluate: (snapshot, candle) => {
      const val = getField(snapshot, key, band);
      if (val === null) return false;
      return band === "upper" ? candle.close > val : candle.close < val;
    },
  };
}

/**
 * Condition: Price touches/is near a Bollinger Band
 *
 * @param band - Which band to check ("upper" or "lower")
 * @param tolerance - Percentage tolerance (default: 0.1 = 0.1%)
 * @param key - Snapshot key for Bollinger Bands (default: "bb")
 */
export function bollingerTouch(
  band: "upper" | "lower",
  tolerance = 0.1,
  key = "bb",
): StreamingPresetCondition {
  return {
    type: "preset",
    name: `bollingerTouch(${band}, ${tolerance}%)`,
    evaluate: (snapshot, candle) => {
      const val = getField(snapshot, key, band);
      if (val === null || val === 0) return false;
      const pct = Math.abs((candle.close - val) / val) * 100;
      return pct <= tolerance;
    },
  };
}

/**
 * Condition: Bollinger Bandwidth is contracting (squeeze)
 *
 * @param threshold - Bandwidth threshold (default: 0.1 = 10%)
 * @param key - Snapshot key for Bollinger Bands (default: "bb")
 */
export function bollingerSqueeze(threshold = 0.1, key = "bb"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `bollingerSqueeze(<${threshold})`,
    evaluate: (snapshot) => {
      const bw = getField(snapshot, key, "bandwidth");
      return bw !== null && bw < threshold;
    },
  };
}

/**
 * Condition: Bollinger Bandwidth is expanding
 *
 * @param threshold - Bandwidth threshold (default: 0.2 = 20%)
 * @param key - Snapshot key for Bollinger Bands (default: "bb")
 */
export function bollingerExpansion(threshold = 0.2, key = "bb"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `bollingerExpansion(>${threshold})`,
    evaluate: (snapshot) => {
      const bw = getField(snapshot, key, "bandwidth");
      return bw !== null && bw > threshold;
    },
  };
}
