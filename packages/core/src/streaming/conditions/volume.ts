/**
 * Volume Streaming Conditions
 */

import { getField, getNumber } from "../snapshot-utils";
import { commitsState } from "./core";
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
 * @param threshold - CMF threshold (default: 0, the CMF zero-line)
 * @param key - Snapshot key (default: "cmf")
 */
export function cmfAbove(threshold = 0, key = "cmf"): StreamingPresetCondition {
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
 * @param threshold - CMF threshold (default: 0, the CMF zero-line)
 * @param key - Snapshot key (default: "cmf")
 */
export function cmfBelow(threshold = 0, key = "cmf"): StreamingPresetCondition {
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
export function obvUpTick(key = "obv"): StreamingPresetCondition {
  let prevObv: number | null = null;

  return {
    type: "preset",
    name: `obvUpTick(${key})`,
    evaluate: (snapshot, _candle, context) => {
      const val = getNumber(snapshot, key);
      const rising = prevObv !== null && val !== null && val > prevObv;
      if (commitsState(context)) {
        prevObv = val;
      }
      return rising;
    },
  };
}

/**
 * Condition: On Balance Volume is falling
 *
 * @param key - Snapshot key (default: "obv")
 */
export function obvDownTick(key = "obv"): StreamingPresetCondition {
  let prevObv: number | null = null;

  return {
    type: "preset",
    name: `obvDownTick(${key})`,
    evaluate: (snapshot, _candle, context) => {
      const val = getNumber(snapshot, key);
      const falling = prevObv !== null && val !== null && val < prevObv;
      if (commitsState(context)) {
        prevObv = val;
      }
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
export function obvSignalCrossUp(signalKey = "obvSignal", key = "obv"): StreamingPresetCondition {
  const cross = crossOver(key, signalKey);
  return {
    type: "preset",
    name: `obvSignalCrossUp(${key}, ${signalKey})`,
    evaluate: cross.evaluate,
  };
}

/**
 * Condition: OBV crosses below a signal line (SMA of OBV)
 *
 * @param signalKey - Snapshot key for OBV signal line (default: "obvSignal")
 * @param key - Snapshot key for OBV (default: "obv")
 */
export function obvSignalCrossDown(signalKey = "obvSignal", key = "obv"): StreamingPresetCondition {
  const cross = crossUnder(key, signalKey);
  return {
    type: "preset",
    name: `obvSignalCrossDown(${key}, ${signalKey})`,
    evaluate: cross.evaluate,
  };
}

/**
 * @deprecated Renamed to {@link obvUpTick}, which says what it tests: OBV is above the previous bar.
 * The backtest condition named `obvRising` is a different rule. This alias will
 * be removed in a future release.
 */
export const obvRising = obvUpTick;

/**
 * @deprecated Renamed to {@link obvDownTick}, which says what it tests: OBV is below the previous bar.
 * The backtest condition named `obvFalling` is a different rule. This alias will
 * be removed in a future release.
 */
export const obvFalling = obvDownTick;

/**
 * @deprecated Renamed to {@link obvSignalCrossUp}, which says what it tests: OBV crosses above its signal line.
 * The backtest condition named `obvCrossUp` is a different rule. This alias will
 * be removed in a future release.
 */
export const obvCrossUp = obvSignalCrossUp;

/**
 * @deprecated Renamed to {@link obvSignalCrossDown}, which says what it tests: OBV crosses below its signal line.
 * The backtest condition named `obvCrossDown` is a different rule. This alias will
 * be removed in a future release.
 */
export const obvCrossDown = obvSignalCrossDown;
