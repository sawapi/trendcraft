/**
 * Streaming Condition Presets
 *
 * Pre-built conditions for common trading signals, designed to work
 * with the streaming pipeline's indicator snapshot.
 *
 * @example
 * ```ts
 * const entry = and(rsiBelow(30), smaGoldenCross());
 * const exit = or(rsiAbove(70), smaDeadCross());
 * ```
 */

import { getField, getNumber } from "../snapshot-utils";
import type { IndicatorSnapshot, StreamingPresetCondition } from "./types";

/**
 * Condition: RSI is below a threshold
 *
 * @param threshold - RSI level (e.g., 30 for oversold)
 * @param key - Snapshot key for RSI value (default: "rsi")
 *
 * @example
 * ```ts
 * const oversold = rsiBelow(30);
 * ```
 */
export function rsiBelow(threshold: number, key = "rsi"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `rsiBelow(${threshold})`,
    evaluate: (snapshot) => {
      const rsi = getNumber(snapshot, key);
      return rsi !== null && rsi < threshold;
    },
  };
}

/**
 * Condition: RSI is above a threshold
 *
 * @param threshold - RSI level (e.g., 70 for overbought)
 * @param key - Snapshot key for RSI value (default: "rsi")
 *
 * @example
 * ```ts
 * const overbought = rsiAbove(70);
 * ```
 */
export function rsiAbove(threshold: number, key = "rsi"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `rsiAbove(${threshold})`,
    evaluate: (snapshot) => {
      const rsi = getNumber(snapshot, key);
      return rsi !== null && rsi > threshold;
    },
  };
}

/**
 * Condition: Short SMA crosses above long SMA (golden cross)
 *
 * Requires a boolean signal key in the snapshot (typically set by a
 * CrossDetector in the pipeline signal configuration).
 *
 * @deprecated Use `crossOver("sma20", "sma50")` from `cross.ts` instead.
 * @param key - Snapshot key for golden cross signal (default: "goldenCross")
 *
 * @example
 * ```ts
 * const entry = smaGoldenCross();
 * ```
 */
export function smaGoldenCross(key = "goldenCross"): StreamingPresetCondition {
  return {
    type: "preset",
    name: "smaGoldenCross",
    evaluate: (snapshot) => snapshot[key] === true,
  };
}

/**
 * Condition: Short SMA crosses below long SMA (dead cross)
 *
 * @deprecated Use `crossUnder("sma20", "sma50")` from `cross.ts` instead.
 * @param key - Snapshot key for dead cross signal (default: "deadCross")
 *
 * @example
 * ```ts
 * const exit = smaDeadCross();
 * ```
 */
export function smaDeadCross(key = "deadCross"): StreamingPresetCondition {
  return {
    type: "preset",
    name: "smaDeadCross",
    evaluate: (snapshot) => snapshot[key] === true,
  };
}

/**
 * Condition: MACD histogram is positive
 *
 * @param key - Snapshot key for MACD value (default: "macd")
 *
 * @example
 * ```ts
 * const bullish = macdPositive();
 * ```
 */
export function macdPositive(key = "macd"): StreamingPresetCondition {
  return {
    type: "preset",
    name: "macdPositive",
    evaluate: (snapshot) => {
      const hist = getField(snapshot, key, "histogram");
      return hist !== null && hist > 0;
    },
  };
}

/**
 * Condition: MACD histogram is negative
 *
 * @param key - Snapshot key for MACD value (default: "macd")
 *
 * @example
 * ```ts
 * const bearish = macdNegative();
 * ```
 */
export function macdNegative(key = "macd"): StreamingPresetCondition {
  return {
    type: "preset",
    name: "macdNegative",
    evaluate: (snapshot) => {
      const hist = getField(snapshot, key, "histogram");
      return hist !== null && hist < 0;
    },
  };
}

/**
 * Condition: Price is above a named indicator value
 *
 * @param indicatorKey - Snapshot key for indicator value
 *
 * @example
 * ```ts
 * const aboveSma = priceAbove("sma200");
 * ```
 */
export function priceAbove(indicatorKey: string): StreamingPresetCondition {
  return {
    type: "preset",
    name: `priceAbove(${indicatorKey})`,
    evaluate: (snapshot, candle) => {
      const val = getNumber(snapshot, indicatorKey);
      return val !== null && candle.close > val;
    },
  };
}

/**
 * Condition: Price is below a named indicator value
 *
 * @param indicatorKey - Snapshot key for indicator value
 *
 * @example
 * ```ts
 * const belowSma = priceBelow("sma200");
 * ```
 */
export function priceBelow(indicatorKey: string): StreamingPresetCondition {
  return {
    type: "preset",
    name: `priceBelow(${indicatorKey})`,
    evaluate: (snapshot, candle) => {
      const val = getNumber(snapshot, indicatorKey);
      return val !== null && candle.close < val;
    },
  };
}

/**
 * Condition: An indicator value is above a threshold
 *
 * @param indicatorKey - Snapshot key
 * @param threshold - Threshold value
 *
 * @example
 * ```ts
 * const strongTrend = indicatorAbove("adx", 25);
 * ```
 */
export function indicatorAbove(indicatorKey: string, threshold: number): StreamingPresetCondition {
  return {
    type: "preset",
    name: `${indicatorKey}Above(${threshold})`,
    evaluate: (snapshot) => {
      const val = getNumber(snapshot, indicatorKey);
      return val !== null && val > threshold;
    },
  };
}

/**
 * Condition: An indicator value is below a threshold
 *
 * @param indicatorKey - Snapshot key
 * @param threshold - Threshold value
 *
 * @example
 * ```ts
 * const lowVolatility = indicatorBelow("atr", 2.0);
 * ```
 */
export function indicatorBelow(indicatorKey: string, threshold: number): StreamingPresetCondition {
  return {
    type: "preset",
    name: `${indicatorKey}Below(${threshold})`,
    evaluate: (snapshot) => {
      const val = getNumber(snapshot, indicatorKey);
      return val !== null && val < threshold;
    },
  };
}

/**
 * Condition: DMI Bullish — +DI > -DI and ADX >= threshold
 *
 * @param threshold - Minimum ADX for trend strength (default: 25)
 * @param key - Snapshot key for DMI value (default: "dmi")
 *
 * @example
 * ```ts
 * const bullishTrend = dmiBullish(25);
 * ```
 */
export function dmiBullish(threshold = 25, key = "dmi"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `dmiBullish(ADX>=${threshold})`,
    evaluate: (snapshot) => {
      const plusDi = getField(snapshot, key, "plusDi");
      const minusDi = getField(snapshot, key, "minusDi");
      const adx = getField(snapshot, key, "adx");
      if (plusDi == null || minusDi == null || adx == null) return false;
      return plusDi > minusDi && adx >= threshold;
    },
  };
}

/**
 * Condition: DMI Bearish — -DI > +DI and ADX >= threshold
 *
 * @param threshold - Minimum ADX for trend strength (default: 25)
 * @param key - Snapshot key for DMI value (default: "dmi")
 *
 * @example
 * ```ts
 * const bearishTrend = dmiBearish(25);
 * ```
 */
export function dmiBearish(threshold = 25, key = "dmi"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `dmiBearish(ADX>=${threshold})`,
    evaluate: (snapshot) => {
      const plusDi = getField(snapshot, key, "plusDi");
      const minusDi = getField(snapshot, key, "minusDi");
      const adx = getField(snapshot, key, "adx");
      if (plusDi == null || minusDi == null || adx == null) return false;
      return minusDi > plusDi && adx >= threshold;
    },
  };
}
