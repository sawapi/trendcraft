/**
 * Keltner Channel Streaming Conditions
 */

import { getField } from "../snapshot-utils";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: Price breaks above/below Keltner Channel
 *
 * @param band - Which band ("upper" or "lower")
 * @param key - Snapshot key (default: "keltner")
 */
export function keltnerBreakout(
  band: "upper" | "lower",
  key = "keltner",
): StreamingPresetCondition {
  return {
    type: "preset",
    name: `keltnerBreakout(${band})`,
    evaluate: (snapshot, candle) => {
      const val = getField(snapshot, key, band);
      if (val === null) return false;
      return band === "upper" ? candle.close > val : candle.close < val;
    },
  };
}

/**
 * Condition: Price touches/is near Keltner Channel
 *
 * @param band - Which band ("upper" or "lower")
 * @param tolerance - Percentage tolerance (default: 0.1%)
 * @param key - Snapshot key (default: "keltner")
 */
export function keltnerTouch(
  band: "upper" | "lower",
  tolerance = 0.1,
  key = "keltner",
): StreamingPresetCondition {
  return {
    type: "preset",
    name: `keltnerTouch(${band}, ${tolerance}%)`,
    evaluate: (snapshot, candle) => {
      const val = getField(snapshot, key, band);
      if (val === null || val === 0) return false;
      const pct = Math.abs((candle.close - val) / val) * 100;
      return pct <= tolerance;
    },
  };
}

/**
 * Condition: TTM Squeeze — Bollinger Bands inside Keltner Channel
 *
 * @param bbKey - Snapshot key for Bollinger Bands (default: "bb")
 * @param keltnerKey - Snapshot key for Keltner Channel (default: "keltner")
 */
export function keltnerSqueeze(bbKey = "bb", keltnerKey = "keltner"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `keltnerSqueeze(${bbKey}, ${keltnerKey})`,
    evaluate: (snapshot) => {
      const bbUpper = getField(snapshot, bbKey, "upper");
      const bbLower = getField(snapshot, bbKey, "lower");
      const kUpper = getField(snapshot, keltnerKey, "upper");
      const kLower = getField(snapshot, keltnerKey, "lower");
      if (bbUpper === null || bbLower === null || kUpper === null || kLower === null) return false;
      return bbUpper < kUpper && bbLower > kLower;
    },
  };
}
