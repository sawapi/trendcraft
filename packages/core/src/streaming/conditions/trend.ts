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
 * A trend direction that is actually set: 1 or -1. Supertrend and Parabolic
 * SAR report 0 while they warm up, and the first defined bar after that is
 * the indicator becoming defined — not a flip from a trend.
 */
function definedDirection(raw: number | null): 1 | -1 | null {
  return raw === 1 || raw === -1 ? raw : null;
}

/**
 * Condition: Supertrend direction flipped (reversal)
 *
 * Only a change between two defined directions (1 / -1) counts; the warm-up
 * value 0 is not a direction. Supertrend seeds its first defined direction
 * as down unless the close is already above the upper band (as TradingView's
 * `ta.supertrend` does), so in an uptrend the first flip after warm-up is
 * that seed correcting itself, a few bars in.
 *
 * @param key - Snapshot key (default: "supertrend")
 */
export function supertrendFlip(key = "supertrend"): StreamingPresetCondition {
  let prevDir: number | null = null;

  return {
    type: "preset",
    name: `supertrendFlip(${key})`,
    evaluate: (snapshot) => {
      const dir = definedDirection(getField(snapshot, key, "direction"));
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
 * Only a change between two defined directions (1 / -1) counts; the warm-up
 * value 0 is not a direction.
 *
 * @param key - Snapshot key (default: "parabolicSar")
 */
export function sarFlip(key = "parabolicSar"): StreamingPresetCondition {
  let prevDir: number | null = null;

  return {
    type: "preset",
    name: `sarFlip(${key})`,
    evaluate: (snapshot) => {
      const dir = definedDirection(getField(snapshot, key, "direction"));
      const flipped = prevDir !== null && dir !== null && dir !== prevDir;
      prevDir = dir;
      return flipped;
    },
  };
}
