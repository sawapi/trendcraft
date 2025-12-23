/**
 * Core condition evaluation and combination functions
 */

import type { Condition, ConditionFn, PresetCondition, CombinedCondition, NormalizedCandle } from "../../types";

// ============================================
// Condition Evaluation Helper
// ============================================

/**
 * Evaluate a condition (preset, combined, or custom function)
 */
export function evaluateCondition(
  condition: Condition,
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[]
): boolean {
  // Custom function
  if (typeof condition === "function") {
    return condition(indicators, candle, index, candles);
  }

  // Preset condition
  if (condition.type === "preset") {
    return condition.evaluate(indicators, candle, index, candles);
  }

  // Combined conditions
  const combined = condition as CombinedCondition;
  switch (combined.type) {
    case "and":
      return combined.conditions.every((c) => evaluateCondition(c, indicators, candle, index, candles));
    case "or":
      return combined.conditions.some((c) => evaluateCondition(c, indicators, candle, index, candles));
    case "not":
      return !evaluateCondition(combined.conditions[0], indicators, candle, index, candles);
    default:
      return false;
  }
}

// ============================================
// Combination Functions
// ============================================

/**
 * Combine conditions with AND logic
 */
export function and(...conditions: Condition[]): CombinedCondition {
  return { type: "and", conditions };
}

/**
 * Combine conditions with OR logic
 */
export function or(...conditions: Condition[]): CombinedCondition {
  return { type: "or", conditions };
}

/**
 * Negate a condition
 */
export function not(condition: Condition): CombinedCondition {
  return { type: "not", conditions: [condition] };
}
