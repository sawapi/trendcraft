/**
 * MACD Streaming Conditions
 */

import { getField } from "../snapshot-utils";
import { crossOver, crossUnder } from "./cross";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: MACD line crosses above signal line (bullish)
 *
 * @param key - Snapshot key (default: "macd")
 */
export function macdCrossUp(key = "macd"): StreamingPresetCondition {
  const cross = crossOver(
    (snap) => getField(snap, key, "macd"),
    (snap) => getField(snap, key, "signal"),
  );
  return {
    type: "preset",
    name: `macdCrossUp(${key})`,
    evaluate: cross.evaluate,
  };
}

/**
 * Condition: MACD line crosses below signal line (bearish)
 *
 * @param key - Snapshot key (default: "macd")
 */
export function macdCrossDown(key = "macd"): StreamingPresetCondition {
  const cross = crossUnder(
    (snap) => getField(snap, key, "macd"),
    (snap) => getField(snap, key, "signal"),
  );
  return {
    type: "preset",
    name: `macdCrossDown(${key})`,
    evaluate: cross.evaluate,
  };
}

/**
 * Condition: MACD histogram is rising (momentum increasing)
 *
 * @param key - Snapshot key (default: "macd")
 */
export function macdHistogramRising(key = "macd"): StreamingPresetCondition {
  let prevHist: number | null = null;

  return {
    type: "preset",
    name: `macdHistogramRising(${key})`,
    evaluate: (snapshot) => {
      const hist = getField(snapshot, key, "histogram");
      const rising = prevHist !== null && hist !== null && hist > prevHist;
      prevHist = hist;
      return rising;
    },
  };
}

/**
 * Condition: MACD histogram is falling (momentum decreasing)
 *
 * @param key - Snapshot key (default: "macd")
 */
export function macdHistogramFalling(key = "macd"): StreamingPresetCondition {
  let prevHist: number | null = null;

  return {
    type: "preset",
    name: `macdHistogramFalling(${key})`,
    evaluate: (snapshot) => {
      const hist = getField(snapshot, key, "histogram");
      const falling = prevHist !== null && hist !== null && hist < prevHist;
      prevHist = hist;
      return falling;
    },
  };
}
