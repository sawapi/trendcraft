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
 * Volatility level classification for regime filter
 */
export type VolatilityLevel = "low" | "normal" | "high";

/**
 * Options for regimeFilter condition
 */
export type RegimeFilterOptions = {
  /** Allowed volatility levels (default: all) */
  allowedVolatility?: VolatilityLevel[];
  /** Minimum trend strength (0-100, default: 0) */
  minTrendStrength?: number;
  /** Allowed trend directions */
  allowedTrends?: ("bullish" | "bearish" | "sideways")[];
  /** Snapshot key for regime data (default: "regime") */
  key?: string;
};

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

/**
 * Condition: Market regime filter
 *
 * Filters trading signals based on the current market regime
 * (volatility level, trend direction, trend strength).
 * Requires a regime indicator in the pipeline snapshot.
 *
 * The regime snapshot value should have shape:
 * `{ volatility: "low"|"normal"|"high", trend: "bullish"|"bearish"|"sideways", trendStrength: number }`
 *
 * @param options - Filter configuration
 *
 * @example
 * ```ts
 * // Only trade in normal/low volatility with bullish trend
 * const filter = regimeFilter({
 *   allowedVolatility: ["low", "normal"],
 *   allowedTrends: ["bullish"],
 *   minTrendStrength: 30,
 * });
 * ```
 */
export function regimeFilter(options: RegimeFilterOptions = {}): StreamingPresetCondition {
  const key = options.key ?? "regime";
  return {
    type: "preset",
    name: `regimeFilter(${key})`,
    evaluate: (snapshot) => {
      const regime = snapshot[key];
      if (regime == null || typeof regime !== "object") return false;

      const r = regime as Record<string, unknown>;

      // Check volatility
      if (options.allowedVolatility && options.allowedVolatility.length > 0) {
        const vol = r.volatility as string | undefined;
        if (vol && !options.allowedVolatility.includes(vol as VolatilityLevel)) {
          return false;
        }
      }

      // Check trend direction
      if (options.allowedTrends && options.allowedTrends.length > 0) {
        const trend = r.trend as string | undefined;
        if (trend && !options.allowedTrends.includes(trend as "bullish" | "bearish" | "sideways")) {
          return false;
        }
      }

      // Check trend strength
      if (options.minTrendStrength !== undefined) {
        const strength = r.trendStrength;
        if (typeof strength === "number" && strength < options.minTrendStrength) {
          return false;
        }
      }

      return true;
    },
  };
}

/**
 * Regime-adjusted position sizing multiplier configuration
 */
export type RegimeMultipliers = {
  /** Multiplier for low volatility regime (default: 1.0) */
  low?: number;
  /** Multiplier for normal volatility regime (default: 1.0) */
  normal?: number;
  /** Multiplier for high volatility regime (default: 0.5) */
  high?: number;
};

/**
 * Get a position sizing multiplier based on the current market regime.
 *
 * Returns a multiplier (0-N) that can be applied to position size.
 * Useful for reducing position size in high-volatility regimes.
 *
 * @param snapshot - Current indicator snapshot
 * @param multipliers - Multipliers per volatility level
 * @param key - Snapshot key for regime data (default: "regime")
 * @returns Position sizing multiplier (default: 1.0 if regime not available)
 *
 * @example
 * ```ts
 * const multiplier = getRegimeSizeMultiplier(snapshot, {
 *   low: 1.2,     // increase size in calm markets
 *   normal: 1.0,  // standard size
 *   high: 0.5,    // halve size in volatile markets
 * });
 * const adjustedShares = Math.floor(baseShares * multiplier);
 * ```
 */
export function getRegimeSizeMultiplier(
  snapshot: IndicatorSnapshot,
  multipliers: RegimeMultipliers = {},
  key = "regime",
): number {
  const defaults: Required<RegimeMultipliers> = {
    low: multipliers.low ?? 1.0,
    normal: multipliers.normal ?? 1.0,
    high: multipliers.high ?? 0.5,
  };

  const regime = snapshot[key];
  if (regime == null || typeof regime !== "object") return 1.0;

  const vol = (regime as Record<string, unknown>).volatility as string | undefined;
  if (!vol) return 1.0;

  switch (vol) {
    case "low":
      return defaults.low;
    case "normal":
      return defaults.normal;
    case "high":
      return defaults.high;
    default:
      return 1.0;
  }
}
