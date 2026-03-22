/**
 * Perfect Order Streaming Conditions
 *
 * Detects when multiple moving averages are in "perfect order" alignment.
 */

import { getField } from "../snapshot-utils";
import type { StreamingPresetCondition } from "./types";

/**
 * Condition: EMA Ribbon is in bullish perfect order
 *
 * @param key - Snapshot key for EMA ribbon (default: "emaRibbon")
 */
export function perfectOrderBullish(key = "emaRibbon"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `perfectOrderBullish(${key})`,
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
export function perfectOrderBearish(key = "emaRibbon"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `perfectOrderBearish(${key})`,
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
export function perfectOrderCollapsed(key = "emaRibbon"): StreamingPresetCondition {
  return {
    type: "preset",
    name: `perfectOrderCollapsed(${key})`,
    evaluate: (snapshot) => {
      const val = snapshot[key];
      if (val == null || typeof val !== "object") return false;
      const r = val as Record<string, unknown>;
      return r.expanding === false;
    },
  };
}
