/**
 * Price Streaming Conditions
 *
 * ATR-based price movement and new high/low detection.
 */

import { getField, getNumber } from "../snapshot-utils";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: Price dropped by more than N ATRs from previous close
 *
 * @param multiplier - ATR multiplier (default: 1.0)
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function priceDroppedAtr(multiplier = 1.0, key = "atr"): StreamingPresetCondition {
  let prevClose: number | null = null;

  return {
    type: "preset",
    name: `priceDroppedAtr(${multiplier}x)`,
    evaluate: (snapshot, candle) => {
      const atr = getNumber(snapshot, key);
      const dropped =
        prevClose !== null && atr !== null && prevClose - candle.close > atr * multiplier;
      prevClose = candle.close;
      return dropped;
    },
  };
}

/**
 * Condition: Price gained by more than N ATRs from previous close
 *
 * @param multiplier - ATR multiplier (default: 1.0)
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function priceGainedAtr(multiplier = 1.0, key = "atr"): StreamingPresetCondition {
  let prevClose: number | null = null;

  return {
    type: "preset",
    name: `priceGainedAtr(${multiplier}x)`,
    evaluate: (snapshot, candle) => {
      const atr = getNumber(snapshot, key);
      const gained =
        prevClose !== null && atr !== null && candle.close - prevClose > atr * multiplier;
      prevClose = candle.close;
      return gained;
    },
  };
}

/**
 * Condition: Price made a new high (above Donchian upper)
 *
 * @param key - Snapshot key for Donchian channel (default: "donchian")
 */
export function newHigh(key = "donchian"): StreamingPresetCondition {
  let prevUpper: number | null = null;

  return {
    type: "preset",
    name: `newHigh(${key})`,
    evaluate: (snapshot, candle) => {
      const upper = getNumber(snapshot, key) ?? getField(snapshot, key, "upper");
      const isNew = prevUpper !== null && candle.high > prevUpper;
      if (upper !== null) prevUpper = upper;
      return isNew;
    },
  };
}

/**
 * Condition: Price made a new low (below Donchian lower)
 *
 * @param key - Snapshot key for Donchian channel (default: "donchian")
 */
export function newLow(key = "donchian"): StreamingPresetCondition {
  let prevLower: number | null = null;

  return {
    type: "preset",
    name: `newLow(${key})`,
    evaluate: (snapshot, candle) => {
      const lower = getNumber(snapshot, key) ?? getField(snapshot, key, "lower");
      const isNew = prevLower !== null && candle.low < prevLower;
      if (lower !== null) prevLower = lower;
      return isNew;
    },
  };
}
