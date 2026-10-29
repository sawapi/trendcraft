/**
 * Perfect Order Streaming Conditions
 *
 * Detects when multiple moving averages are in "perfect order" alignment.
 */

import type { StreamingPresetCondition } from "./types";

/**
 * Condition: EMA Ribbon is in bullish perfect order
 *
 * @param key - Snapshot key for EMA ribbon (default: "emaRibbon")
 */
export function emaRibbonBullish(key = "emaRibbon"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `emaRibbonBullish(${key})`,
    evaluate: (snapshot) => {
      const val = snapshot[key];
      if (val == null || typeof val !== "object") return false;
      return (val as Record<string, unknown>).bullish === true;
    },
  };
}

/**
 * Condition: EMA Ribbon is in bearish perfect order (reversed)
 *
 * @param key - Snapshot key for EMA ribbon (default: "emaRibbon")
 */
export function emaRibbonBearish(key = "emaRibbon"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `emaRibbonBearish(${key})`,
    evaluate: (snapshot) => {
      const val = snapshot[key];
      if (val == null || typeof val !== "object") return false;
      const r = val as Record<string, unknown>;
      const values = r.values;
      if (!Array.isArray(values) || values.some((v) => v === null)) return false;
      // Bearish: longest EMA > shorter EMA (reversed order)
      for (let i = 0; i < values.length - 1; i++) {
        if (values[i] >= values[i + 1]) return false;
      }
      return true;
    },
  };
}

/**
 * Condition: Perfect order is forming (expanding ribbon)
 *
 * @param key - Snapshot key for EMA ribbon (default: "emaRibbon")
 */
export function perfectOrderForming(key = "emaRibbon"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `perfectOrderForming(${key})`,
    evaluate: (snapshot) => {
      const val = snapshot[key];
      if (val == null || typeof val !== "object") return false;
      const r = val as Record<string, unknown>;
      return r.expanding === true;
    },
  };
}

/**
 * Condition: Perfect order collapsed (ribbon contracting)
 *
 * @param key - Snapshot key for EMA ribbon (default: "emaRibbon")
 */
export function emaRibbonContracting(key = "emaRibbon"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `emaRibbonContracting(${key})`,
    evaluate: (snapshot) => {
      const val = snapshot[key];
      if (val == null || typeof val !== "object") return false;
      const r = val as Record<string, unknown>;
      return r.expanding === false;
    },
  };
}

/**
 * @deprecated Renamed to {@link emaRibbonBullish}, which says what it tests: the EMA ribbon is in bullish order on this bar (a state, not the bar it forms).
 * The backtest condition named `perfectOrderBullish` is a different rule. This alias will
 * be removed in a future release.
 */
export const perfectOrderBullish = emaRibbonBullish;

/**
 * @deprecated Renamed to {@link emaRibbonBearish}, which says what it tests: the EMA ribbon is in bearish order on this bar (a state, not the bar it forms).
 * The backtest condition named `perfectOrderBearish` is a different rule. This alias will
 * be removed in a future release.
 */
export const perfectOrderBearish = emaRibbonBearish;

/**
 * @deprecated Renamed to {@link emaRibbonContracting}, which says what it tests: the EMA ribbon spread is not expanding (it may still be in order).
 * The backtest condition named `perfectOrderCollapsed` is a different rule. This alias will
 * be removed in a future release.
 */
export const perfectOrderCollapsed = emaRibbonContracting;
