/**
 * Volume Streaming Conditions
 */

import { getField, getNumber } from "../snapshot-utils";
import { crossOver, crossUnder } from "./cross";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: Volume is above average by multiplier
 *
 * @param multiplier - Multiple of average volume (default: 1.5)
 * @param key - Snapshot key for volume anomaly indicator (default: "volumeAnomaly")
 */
export function volumeAboveAvg(multiplier = 1.5, key = "volumeAnomaly"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `volumeAboveAvg(${multiplier}x)`,
    evaluate: (snapshot) => {
      const ratio = getField(snapshot, key, "ratio");
      return ratio !== null && ratio >= multiplier;
    },
  };
}

/**
 * Condition: Chaikin Money Flow above threshold
 *
 * @param threshold - CMF threshold (default: 0.05)
 * @param key - Snapshot key (default: "cmf")
 */
export function cmfAbove(threshold = 0.05, key = "cmf"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `cmfAbove(${threshold})`,
    evaluate: (snapshot) => {
      const val = getNumber(snapshot, key);
      return val !== null && val > threshold;
    },
  };
}

/**
 * Condition: Chaikin Money Flow below threshold
 *
 * @param threshold - CMF threshold (default: -0.05)
 * @param key - Snapshot key (default: "cmf")
 */
export function cmfBelow(threshold = -0.05, key = "cmf"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `cmfBelow(${threshold})`,
    evaluate: (snapshot) => {
      const val = getNumber(snapshot, key);
      return val !== null && val < threshold;
    },
  };
}

/**
 * Condition: On Balance Volume is rising
 *
 * @param key - Snapshot key (default: "obv")
 */
export function obvRising(key = "obv"): StreamingPresetCondition {
  let prevObv: number | null = null;

  return {
    type: "preset",
    name: `obvRising(${key})`,
    evaluate: (snapshot) => {
      const val = getNumber(snapshot, key);
      const rising = prevObv !== null && val !== null && val > prevObv;
      prevObv = val;
      return rising;
    },
  };
}

/**
 * Condition: On Balance Volume is falling
 *
 * @param key - Snapshot key (default: "obv")
 */
export function obvFalling(key = "obv"): StreamingPresetCondition {
  let prevObv: number | null = null;

  return {
    type: "preset",
    name: `obvFalling(${key})`,
    evaluate: (snapshot) => {
      const val = getNumber(snapshot, key);
      const falling = prevObv !== null && val !== null && val < prevObv;
      prevObv = val;
      return falling;
    },
  };
}

/**
 * Condition: OBV crosses above a signal line (SMA of OBV)
 *
 * @param signalKey - Snapshot key for OBV signal line (default: "obvSignal")
 * @param key - Snapshot key for OBV (default: "obv")
 */
export function obvCrossUp(signalKey = "obvSignal", key = "obv"): StreamingPresetCondition {
  const cross = crossOver(key, signalKey);
  return {
    type: "preset",
    name: `obvCrossUp(${key}, ${signalKey})`,
    evaluate: cross.evaluate,
  };
}

/**
 * Condition: OBV crosses below a signal line (SMA of OBV)
 *
 * @param signalKey - Snapshot key for OBV signal line (default: "obvSignal")
 * @param key - Snapshot key for OBV (default: "obv")
 */
export function obvCrossDown(signalKey = "obvSignal", key = "obv"): StreamingPresetCondition {
  const cross = crossUnder(key, signalKey);
  return {
    type: "preset",
    name: `obvCrossDown(${key}, ${signalKey})`,
    evaluate: cross.evaluate,
  };
}
