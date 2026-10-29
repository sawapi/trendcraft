/**
 * Volatility Streaming Conditions
 */

import { DEFAULT_ATR_THRESHOLD } from "../../indicators/volatility/atr-filter";
import { getNumber } from "../snapshot-utils";
import { commitsState } from "./core";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: ATR as percentage of close is above threshold
 *
 * @param threshold - ATR% threshold (default: {@link DEFAULT_ATR_THRESHOLD})
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function atrPercentAbove(
  threshold = DEFAULT_ATR_THRESHOLD,
  key = "atr",
): StreamingPresetCondition {
  return {
    type: "preset",
    name: `atrPercentAbove(${threshold}%)`,
    evaluate: (snapshot, candle) => {
      const atr = getNumber(snapshot, key);
      if (atr === null || candle.close === 0) return false;
      return (atr / candle.close) * 100 > threshold;
    },
  };
}

/**
 * Condition: ATR as percentage of close is below threshold
 *
 * @param threshold - ATR% threshold (default: 1.0 = 1%)
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function atrPercentBelow(threshold = 1.0, key = "atr"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `atrPercentBelow(${threshold}%)`,
    evaluate: (snapshot, candle) => {
      const atr = getNumber(snapshot, key);
      if (atr === null || candle.close === 0) return false;
      return (atr / candle.close) * 100 < threshold;
    },
  };
}

/**
 * Condition: Volatility is expanding (ATR rising)
 *
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function atrRising(key = "atr"): StreamingPresetCondition {
  let prevAtr: number | null = null;

  return {
    type: "preset",
    name: `atrRising(${key})`,
    evaluate: (snapshot, _candle, context) => {
      const atr = getNumber(snapshot, key);
      const expanding = prevAtr !== null && atr !== null && atr > prevAtr;
      if (commitsState(context)) {
        prevAtr = atr;
      }
      return expanding;
    },
  };
}

/**
 * Condition: Volatility is contracting (ATR falling)
 *
 * @param key - Snapshot key for ATR (default: "atr")
 */
export function atrFalling(key = "atr"): StreamingPresetCondition {
  let prevAtr: number | null = null;

  return {
    type: "preset",
    name: `atrFalling(${key})`,
    evaluate: (snapshot, _candle, context) => {
      const atr = getNumber(snapshot, key);
      const contracting = prevAtr !== null && atr !== null && atr < prevAtr;
      if (commitsState(context)) {
        prevAtr = atr;
      }
      return contracting;
    },
  };
}

/**
 * @deprecated Renamed to {@link atrRising}, which says what it tests: ATR is above the previous bar.
 * The backtest condition named `volatilityExpanding` is a different rule. This alias will
 * be removed in a future release.
 */
export const volatilityExpanding = atrRising;

/**
 * @deprecated Renamed to {@link atrFalling}, which says what it tests: ATR is below the previous bar.
 * The backtest condition named `volatilityContracting` is a different rule. This alias will
 * be removed in a future release.
 */
export const volatilityContracting = atrFalling;
