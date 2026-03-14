/**
 * Trend Streaming Conditions
 *
 * Supertrend, Ichimoku, Parabolic SAR conditions.
 */

import { getField } from "../snapshot-utils";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: Supertrend is bullish (price above supertrend)
 *
 * @param key - Snapshot key (default: "supertrend")
 */
export function supertrendBullish(key = "supertrend"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `supertrendBullish(${key})`,
    evaluate: (snapshot) => {
      const dir = getField(snapshot, key, "direction");
      return dir !== null && dir === 1;
    },
  };
}

/**
 * Condition: Supertrend is bearish (price below supertrend)
 *
 * @param key - Snapshot key (default: "supertrend")
 */
export function supertrendBearish(key = "supertrend"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `supertrendBearish(${key})`,
    evaluate: (snapshot) => {
      const dir = getField(snapshot, key, "direction");
      return dir !== null && dir === -1;
    },
  };
}

/**
 * Condition: Supertrend direction flipped (reversal)
 *
 * @param key - Snapshot key (default: "supertrend")
 */
export function supertrendFlip(key = "supertrend"): StreamingPresetCondition {
  let prevDir: number | null = null;

  return {
    type: "preset",
    name: `supertrendFlip(${key})`,
    evaluate: (snapshot) => {
      const dir = getField(snapshot, key, "direction");
      const flipped = prevDir !== null && dir !== null && dir !== prevDir;
      prevDir = dir;
      return flipped;
    },
  };
}

/**
 * Condition: Ichimoku bullish — price above kumo (cloud)
 *
 * @param key - Snapshot key (default: "ichimoku")
 */
export function ichimokuBullish(key = "ichimoku"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `ichimokuBullish(${key})`,
    evaluate: (snapshot, candle) => {
      const senkouA = getField(snapshot, key, "senkouA");
      const senkouB = getField(snapshot, key, "senkouB");
      if (senkouA === null || senkouB === null) return false;
      const cloudTop = Math.max(senkouA, senkouB);
      return candle.close > cloudTop;
    },
  };
}

/**
 * Condition: Ichimoku bearish — price below kumo (cloud)
 *
 * @param key - Snapshot key (default: "ichimoku")
 */
export function ichimokuBearish(key = "ichimoku"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `ichimokuBearish(${key})`,
    evaluate: (snapshot, candle) => {
      const senkouA = getField(snapshot, key, "senkouA");
      const senkouB = getField(snapshot, key, "senkouB");
      if (senkouA === null || senkouB === null) return false;
      const cloudBottom = Math.min(senkouA, senkouB);
      return candle.close < cloudBottom;
    },
  };
}

/**
 * Condition: Parabolic SAR flipped direction
 *
 * @param key - Snapshot key (default: "parabolicSar")
 */
export function sarFlip(key = "parabolicSar"): StreamingPresetCondition {
  let prevDir: number | null = null;

  return {
    type: "preset",
    name: `sarFlip(${key})`,
    evaluate: (snapshot) => {
      const dir = getField(snapshot, key, "direction");
      const flipped = prevDir !== null && dir !== null && dir !== prevDir;
      prevDir = dir;
      return flipped;
    },
  };
}
