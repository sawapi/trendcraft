/**
 * Range-Bound (Box Range) conditions
 */

import {
  type RangeBoundOptions,
  type RangeBoundValue,
  rangeBound,
} from "../../signals/range-bound";
import type { NormalizedCandle, PresetCondition } from "../../types";

// ============================================
// Range-Bound (Box Range) Conditions
// ============================================

/**
 * Options for range-bound conditions
 */
export type RangeBoundConditionOptions = RangeBoundOptions;

/**
 * Generate a stable cache key from options object
 * Sorts keys to ensure consistent ordering regardless of property order
 */
function generateCacheKey(prefix: string, options: Record<string, unknown>): string {
  const sortedKeys = Object.keys(options).sort();
  const parts = sortedKeys.map((k) => `${k}:${options[k]}`);
  return `${prefix}_${parts.join("_")}`;
}

/**
 * Get cached range-bound data
 */
function getRangeBoundData(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  options: RangeBoundConditionOptions,
): { time: number; value: RangeBoundValue }[] {
  // Use stable cache key generation instead of JSON.stringify
  const cacheKey =
    Object.keys(options).length === 0
      ? "rangeBound_default"
      : generateCacheKey("rangeBound", options as Record<string, unknown>);
  let rbData = indicators[cacheKey] as { time: number; value: RangeBoundValue }[] | undefined;

  if (!rbData) {
    rbData = rangeBound(candles, options);
    indicators[cacheKey] = rbData;
  }

  return rbData;
}

/**
 * In range-bound market (RANGE_CONFIRMED or RANGE_TIGHT state)
 * Use this to filter out trend-following signals during consolidation
 */
export function inRangeBound(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "inRangeBound()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      const rb = rbData[index]?.value;
      if (!rb) return false;

      return rb.state === "RANGE_CONFIRMED" || rb.state === "RANGE_TIGHT";
    },
  };
}

/**
 * Range forming detected (event flag - fires once when range starts forming)
 */
export function rangeForming(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rangeForming()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.rangeDetected ?? false;
    },
  };
}

/**
 * Range confirmed (event flag - fires once when range is confirmed after persist bars)
 */
export function rangeConfirmed(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rangeConfirmed()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.rangeConfirmed ?? false;
    },
  };
}

/**
 * Breakout risk to upside (price near upper range boundary)
 */
export function breakoutRiskUp(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "breakoutRiskUp()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.state === "BREAKOUT_RISK_UP";
    },
  };
}

/**
 * Breakout risk to downside (price near lower range boundary)
 */
export function breakoutRiskDown(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "breakoutRiskDown()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.state === "BREAKOUT_RISK_DOWN";
    },
  };
}

/**
 * Range breakout (event flag - fires when transitioning from range to trending)
 */
export function rangeBreakout(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rangeBreakout()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.rangeBroken ?? false;
    },
  };
}

/**
 * Tight range (very low volatility, often precedes breakout)
 */
export function tightRange(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "tightRange()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.state === "RANGE_TIGHT";
    },
  };
}

/**
 * Range score above threshold
 * @param threshold Score threshold (0-100, default: 60)
 */
export function rangeScoreAbove(
  threshold = 60,
  options: RangeBoundConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `rangeScoreAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      const rb = rbData[index]?.value;
      return rb?.rangeScore !== undefined && rb.rangeScore >= threshold;
    },
  };
}
