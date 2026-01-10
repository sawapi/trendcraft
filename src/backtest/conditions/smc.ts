/**
 * Smart Money Concepts (SMC) conditions for backtest
 *
 * Conditions based on institutional trading patterns:
 * - Order Blocks: Support/resistance zones from institutional orders
 * - Liquidity Sweeps: False breakouts of swing levels
 */

import {
  orderBlock,
  type OrderBlockOptions,
  type OrderBlockValue,
} from "../../indicators/smc/order-block";
import {
  liquiditySweep,
  type LiquiditySweepOptions,
  type LiquiditySweepValue,
} from "../../indicators/smc/liquidity-sweep";
import type { NormalizedCandle, PresetCondition, Series } from "../../types";

// ============================================
// Helper Functions
// ============================================

/**
 * Get or create cached indicator data with a specific key prefix and calculation function
 */
function getCachedData<T>(
  indicators: Record<string, unknown>,
  cacheKey: string,
  calculate: () => T,
): T {
  let data = indicators[cacheKey] as T | undefined;
  if (!data) {
    data = calculate();
    indicators[cacheKey] = data;
  }
  return data;
}

function getOrderBlockData(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  options: OrderBlockOptions,
): Series<OrderBlockValue> {
  const cacheKey = `orderBlock_${JSON.stringify(options)}`;
  return getCachedData(indicators, cacheKey, () => orderBlock(candles, options));
}

function getLiquiditySweepData(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  options: LiquiditySweepOptions,
): Series<LiquiditySweepValue> {
  const cacheKey = `liquiditySweep_${JSON.stringify(options)}`;
  return getCachedData(indicators, cacheKey, () => liquiditySweep(candles, options));
}

// ============================================
// Order Block Conditions
// ============================================

/**
 * Options for Order Block conditions
 */
export type OrderBlockConditionOptions = OrderBlockOptions;

/**
 * Price is at a bullish order block zone (potential support)
 *
 * @param options Order Block detection options
 *
 * @example
 * ```ts
 * runBacktest(candles, {
 *   entry: and(priceAtBullishOrderBlock(), rsiBelow(30)),
 *   exit: rsiAbove(70),
 * });
 * ```
 */
export function priceAtBullishOrderBlock(
  options: OrderBlockConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: "priceAtBullishOrderBlock",
    evaluate: (indicators, _candle, index, candles) => {
      const obData = getOrderBlockData(indicators, candles, options);
      return obData[index]?.value?.atBullishOB ?? false;
    },
  };
}

/**
 * Price is at a bearish order block zone (potential resistance)
 *
 * @param options Order Block detection options
 *
 * @example
 * ```ts
 * runBacktest(candles, {
 *   entry: and(priceAtBearishOrderBlock(), rsiAbove(70)),
 *   exit: rsiBelow(30),
 * });
 * ```
 */
export function priceAtBearishOrderBlock(
  options: OrderBlockConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: "priceAtBearishOrderBlock",
    evaluate: (indicators, _candle, index, candles) => {
      const obData = getOrderBlockData(indicators, candles, options);
      return obData[index]?.value?.atBearishOB ?? false;
    },
  };
}

/**
 * Price is at any order block zone (bullish or bearish)
 *
 * @param options Order Block detection options
 */
export function priceAtOrderBlock(
  options: OrderBlockConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: "priceAtOrderBlock",
    evaluate: (indicators, _candle, index, candles) => {
      const obData = getOrderBlockData(indicators, candles, options);
      const value = obData[index]?.value;
      return (value?.atBullishOB || value?.atBearishOB) ?? false;
    },
  };
}

/**
 * A new order block was created at this bar
 *
 * @param type Order block type to filter ("bullish", "bearish", or undefined for both)
 * @param options Order Block detection options
 */
export function orderBlockCreated(
  type?: "bullish" | "bearish",
  options: OrderBlockConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `orderBlockCreated(${type ?? "any"})`,
    evaluate: (indicators, _candle, index, candles) => {
      const obData = getOrderBlockData(indicators, candles, options);
      const value = obData[index]?.value;
      if (!value?.newOrderBlock) return false;
      return type ? value.newOrderBlock.type === type : true;
    },
  };
}

/**
 * An order block was mitigated at this bar
 *
 * @param type Order block type to filter ("bullish", "bearish", or undefined for both)
 * @param options Order Block detection options
 */
export function orderBlockMitigated(
  type?: "bullish" | "bearish",
  options: OrderBlockConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `orderBlockMitigated(${type ?? "any"})`,
    evaluate: (indicators, _candle, index, candles) => {
      const obData = getOrderBlockData(indicators, candles, options);
      const value = obData[index]?.value;
      if (!value?.mitigatedThisBar.length) return false;
      return type ? value.mitigatedThisBar.some((ob) => ob.type === type) : true;
    },
  };
}

/**
 * There are active (non-mitigated) order blocks of the specified type
 *
 * @param type Order block type to filter ("bullish", "bearish", or undefined for both)
 * @param minCount Minimum number of active OBs required (default: 1)
 * @param options Order Block detection options
 */
export function hasActiveOrderBlocks(
  type?: "bullish" | "bearish",
  minCount = 1,
  options: OrderBlockConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `hasActiveOrderBlocks(${type ?? "any"}, ${minCount})`,
    evaluate: (indicators, _candle, index, candles) => {
      const obData = getOrderBlockData(indicators, candles, options);
      const value = obData[index]?.value;
      if (!value) return false;

      const activeBlocks = value.activeOrderBlocks;
      const count = type
        ? activeBlocks.filter((ob) => ob.type === type).length
        : activeBlocks.length;

      return count >= minCount;
    },
  };
}

// ============================================
// Liquidity Sweep Conditions
// ============================================

/**
 * Options for Liquidity Sweep conditions
 */
export type LiquiditySweepConditionOptions = LiquiditySweepOptions;

/**
 * A liquidity sweep was detected at this bar
 *
 * @param type Sweep type to filter ("bullish", "bearish", or undefined for both)
 * @param options Liquidity Sweep detection options
 *
 * @example
 * ```ts
 * // Enter on bullish sweep (price swept below swing low and recovered)
 * runBacktest(candles, {
 *   entry: liquiditySweepDetected("bullish"),
 *   exit: rsiAbove(70),
 * });
 * ```
 */
export function liquiditySweepDetected(
  type?: "bullish" | "bearish",
  options: LiquiditySweepConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `liquiditySweepDetected(${type ?? "any"})`,
    evaluate: (indicators, _candle, index, candles) => {
      const sweepData = getLiquiditySweepData(indicators, candles, options);
      const value = sweepData[index]?.value;
      if (!value?.isSweep) return false;
      return type ? value.sweep?.type === type : true;
    },
  };
}

/**
 * A liquidity sweep recovered at this bar (good entry signal)
 *
 * This triggers when price has:
 * 1. Broken past a swing high/low (sweep)
 * 2. Recovered back within the swing range
 *
 * @param type Sweep type to filter ("bullish", "bearish", or undefined for both)
 * @param options Liquidity Sweep detection options
 *
 * @example
 * ```ts
 * // Enter when bullish sweep recovers (price swept below and came back)
 * runBacktest(candles, {
 *   entry: liquiditySweepRecovered("bullish"),
 *   exit: priceAboveSma(50),
 * });
 * ```
 */
export function liquiditySweepRecovered(
  type?: "bullish" | "bearish",
  options: LiquiditySweepConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `liquiditySweepRecovered(${type ?? "any"})`,
    evaluate: (indicators, _candle, index, candles) => {
      const sweepData = getLiquiditySweepData(indicators, candles, options);
      const value = sweepData[index]?.value;
      if (!value?.recoveredThisBar.length) return false;
      return type ? value.recoveredThisBar.some((s) => s.type === type) : true;
    },
  };
}

/**
 * There are recent sweeps (recovered or not) of the specified type
 *
 * @param type Sweep type to filter ("bullish", "bearish", or undefined for both)
 * @param recoveredOnly Only count recovered sweeps (default: false)
 * @param minCount Minimum number of sweeps required (default: 1)
 * @param options Liquidity Sweep detection options
 */
export function hasRecentSweeps(
  type?: "bullish" | "bearish",
  recoveredOnly = false,
  minCount = 1,
  options: LiquiditySweepConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `hasRecentSweeps(${type ?? "any"}, recovered=${recoveredOnly}, ${minCount})`,
    evaluate: (indicators, _candle, index, candles) => {
      const sweepData = getLiquiditySweepData(indicators, candles, options);
      const value = sweepData[index]?.value;
      if (!value) return false;

      let sweeps = value.recentSweeps;
      if (recoveredOnly) {
        sweeps = sweeps.filter((s) => s.recovered);
      }
      if (type) {
        sweeps = sweeps.filter((s) => s.type === type);
      }

      return sweeps.length >= minCount;
    },
  };
}

/**
 * Sweep depth exceeds the specified percentage
 *
 * @param minDepth Minimum sweep depth percentage (e.g., 1 for 1%)
 * @param type Sweep type to filter ("bullish", "bearish", or undefined for both)
 * @param options Liquidity Sweep detection options
 */
export function sweepDepthAbove(
  minDepth: number,
  type?: "bullish" | "bearish",
  options: LiquiditySweepConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `sweepDepthAbove(${minDepth}%, ${type ?? "any"})`,
    evaluate: (indicators, _candle, index, candles) => {
      const sweepData = getLiquiditySweepData(indicators, candles, options);
      const value = sweepData[index]?.value;
      if (!value?.isSweep || !value.sweep) return false;
      if (type && value.sweep.type !== type) return false;
      return value.sweep.sweepDepthPercent >= minDepth;
    },
  };
}
