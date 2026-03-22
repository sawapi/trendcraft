/**
 * Donchian Channel Streaming Conditions
 */

import { getField } from "../snapshot-utils";
import { crossOver, crossUnder } from "./cross";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: Price breaks above Donchian upper channel
 *
 * @param key - Snapshot key (default: "donchian")
 */
export function donchianBreakoutHigh(key = "donchian"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `donchianBreakoutHigh(${key})`,
    evaluate: (snapshot, candle) => {
      const upper = getField(snapshot, key, "upper");
      return upper !== null && candle.close > upper;
    },
  };
}

/**
 * Condition: Price breaks below Donchian lower channel
 *
 * @param key - Snapshot key (default: "donchian")
 */
export function donchianBreakoutLow(key = "donchian"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `donchianBreakoutLow(${key})`,
    evaluate: (snapshot, candle) => {
      const lower = getField(snapshot, key, "lower");
      return lower !== null && candle.close < lower;
    },
  };
}

/**
 * Condition: Price crosses above Donchian middle line
 *
 * @param key - Snapshot key (default: "donchian")
 */
export function donchianMiddleCrossUp(key = "donchian"): StreamingPresetCondition {
  const cross = crossOver(
    (snap, candle) => candle.close,
    (snap) => getField(snap, key, "middle"),
  );
  return {
    type: "preset",
    name: `donchianMiddleCrossUp(${key})`,
    evaluate: cross.evaluate,
  };
}

/**
 * Condition: Price crosses below Donchian middle line
 *
 * @param key - Snapshot key (default: "donchian")
 */
export function donchianMiddleCrossDown(key = "donchian"): StreamingPresetCondition {
  const cross = crossUnder(
    (snap, candle) => candle.close,
    (snap) => getField(snap, key, "middle"),
  );
  return {
    type: "preset",
    name: `donchianMiddleCrossDown(${key})`,
    evaluate: cross.evaluate,
  };
}
