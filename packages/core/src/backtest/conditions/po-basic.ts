/**
 * Basic Perfect Order conditions
 */

import { type PerfectOrderValue, perfectOrder } from "../../signals/perfect-order";
import type { PresetCondition } from "../../types";

// ============================================
// Perfect Order Conditions
// ============================================

/**
 * Options for perfect order conditions
 */
export type PerfectOrderConditionOptions = {
  /** MA periods (default: [5, 25, 75]) */
  periods?: number[];
  /** MA type (default: 'sma') */
  maType?: "sma" | "ema" | "wma";
  /** Minimum strength score to trigger (default: 0) */
  minStrength?: number;
};

/**
 * Perfect Order formed (bullish)
 * Triggers when bullish perfect order is formed (short > medium > long MA)
 *
 * @example
 * ```ts
 * // Entry when bullish perfect order forms
 * const entry = perfectOrderBullish();
 *
 * // With minimum strength requirement
 * const strongEntry = perfectOrderBullish({ minStrength: 30 });
 *
 * // Custom periods
 * const customEntry = perfectOrderBullish({ periods: [10, 20, 50, 200] });
 * ```
 */
export function perfectOrderBullish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.formed && po.type === "bullish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order formed (bearish)
 * Triggers when bearish perfect order is formed (short < medium < long MA)
 *
 * @example
 * ```ts
 * // Entry when bearish perfect order forms (for short selling)
 * const entry = perfectOrderBearish();
 * ```
 */
export function perfectOrderBearish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.formed && po.type === "bearish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order collapsed
 * Triggers when a perfect order collapses (MAs no longer in order)
 *
 * Useful as an exit condition - exit when the trend structure breaks down.
 *
 * @example
 * ```ts
 * // Exit when perfect order collapses
 * const exit = perfectOrderCollapsed();
 * ```
 */
export function perfectOrderCollapsed(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma" } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderCollapsed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.collapsed;
    },
  };
}

/**
 * Perfect Order active (bullish)
 * Returns true while bullish perfect order is active (not just when it forms)
 *
 * @example
 * ```ts
 * // Hold position while perfect order is active
 * const holdCondition = perfectOrderActiveBullish();
 * ```
 */
export function perfectOrderActiveBullish(
  options: PerfectOrderConditionOptions = {},
): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderActiveBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.type === "bullish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order active (bearish)
 * Returns true while bearish perfect order is active
 */
export function perfectOrderActiveBearish(
  options: PerfectOrderConditionOptions = {},
): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderActiveBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.type === "bearish" && po.strength >= minStrength;
    },
  };
}
