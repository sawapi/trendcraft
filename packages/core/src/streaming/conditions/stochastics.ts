/**
 * Stochastics Streaming Conditions
 */

import { getField } from "../snapshot-utils";
import { crossOver, crossUnder } from "./cross";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: Stochastic %K is below a threshold (oversold)
 *
 * @param threshold - Stochastic level (default: 20)
 * @param key - Snapshot key (default: "stochastics")
 */
export function stochBelow(threshold = 20, key = "stochastics"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `stochBelow(${threshold})`,
    evaluate: (snapshot) => {
      const k = getField(snapshot, key, "k");
      return k !== null && k < threshold;
    },
  };
}

/**
 * Condition: Stochastic %K is above a threshold (overbought)
 *
 * @param threshold - Stochastic level (default: 80)
 * @param key - Snapshot key (default: "stochastics")
 */
export function stochAbove(threshold = 80, key = "stochastics"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `stochAbove(${threshold})`,
    evaluate: (snapshot) => {
      const k = getField(snapshot, key, "k");
      return k !== null && k > threshold;
    },
  };
}

/**
 * Condition: Stochastic %K crosses above %D (bullish)
 *
 * @param key - Snapshot key (default: "stochastics")
 */
export function stochCrossUp(key = "stochastics"): StreamingPresetCondition {
  const cross = crossOver(
    (snap) => getField(snap, key, "k"),
    (snap) => getField(snap, key, "d"),
  );
  return {
    type: "preset",
    name: `stochCrossUp(${key})`,
    evaluate: cross.evaluate,
  };
}

/**
 * Condition: Stochastic %K crosses below %D (bearish)
 *
 * @param key - Snapshot key (default: "stochastics")
 */
export function stochCrossDown(key = "stochastics"): StreamingPresetCondition {
  const cross = crossUnder(
    (snap) => getField(snap, key, "k"),
    (snap) => getField(snap, key, "d"),
  );
  return {
    type: "preset",
    name: `stochCrossDown(${key})`,
    evaluate: cross.evaluate,
  };
}
