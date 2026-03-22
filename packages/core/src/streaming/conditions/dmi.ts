/**
 * DMI/ADX Streaming Conditions
 */

import { getField } from "../snapshot-utils";
import { crossOver, crossUnder } from "./cross";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: ADX above threshold (strong trend)
 *
 * @param threshold - ADX level (default: 25)
 * @param key - Snapshot key (default: "dmi")
 */
export function adxStrong(threshold = 25, key = "dmi"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `adxStrong(>${threshold})`,
    evaluate: (snapshot) => {
      const adx = getField(snapshot, key, "adx");
      return adx !== null && adx >= threshold;
    },
  };
}

/**
 * Condition: ADX is rising (trend strengthening)
 *
 * @param key - Snapshot key (default: "dmi")
 */
export function adxRising(key = "dmi"): StreamingPresetCondition {
  let prevAdx: number | null = null;

  return {
    type: "preset",
    name: `adxRising(${key})`,
    evaluate: (snapshot) => {
      const adx = getField(snapshot, key, "adx");
      const rising = prevAdx !== null && adx !== null && adx > prevAdx;
      prevAdx = adx;
      return rising;
    },
  };
}

/**
 * Condition: +DI crosses above -DI (bullish)
 *
 * @param key - Snapshot key (default: "dmi")
 */
export function dmiCrossUp(key = "dmi"): StreamingPresetCondition {
  const cross = crossOver(
    (snap) => getField(snap, key, "plusDi"),
    (snap) => getField(snap, key, "minusDi"),
  );
  return {
    type: "preset",
    name: `dmiCrossUp(${key})`,
    evaluate: cross.evaluate,
  };
}

/**
 * Condition: -DI crosses above +DI (bearish)
 *
 * @param key - Snapshot key (default: "dmi")
 */
export function dmiCrossDown(key = "dmi"): StreamingPresetCondition {
  const cross = crossUnder(
    (snap) => getField(snap, key, "plusDi"),
    (snap) => getField(snap, key, "minusDi"),
  );
  return {
    type: "preset",
    name: `dmiCrossDown(${key})`,
    evaluate: cross.evaluate,
  };
}
