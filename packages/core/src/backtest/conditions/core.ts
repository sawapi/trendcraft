/**
 * Core condition evaluation and combination functions
 */

import type {
  CombinedCondition,
  Condition,
  ConditionFn,
  MtfContext,
  MtfPresetCondition,
  NormalizedCandle,
  PresetCondition,
} from "../../types";

/**
 * Extended condition type that includes MTF conditions
 */
export type ExtendedCondition = Condition | MtfPresetCondition;

/**
 * Options for condition evaluation
 */
export type EvaluateConditionOptions = {
  /**
   * When true, throws an error if MTF condition is evaluated without MTF context.
   * When false (default), returns false and logs a warning.
   */
  strictMtf?: boolean;
};

/**
 * Error thrown when MTF context is required but not provided
 */
export class MtfContextRequiredError extends Error {
  constructor(conditionName: string) {
    super(
      `MTF condition "${conditionName}" requires MTF context. Use withMtf() to enable multi-timeframe support, or set strictMtf: false to silently skip.`,
    );
    this.name = "MtfContextRequiredError";
  }
}

// ============================================
// Condition Evaluation Helper
// ============================================

/**
 * Evaluate a condition (preset, combined, MTF, or custom function)
 *
 * @param condition - Condition to evaluate
 * @param indicators - Cached indicators
 * @param candle - Current candle
 * @param index - Current candle index
 * @param candles - All candles
 * @param mtfContext - Optional MTF context for multi-timeframe conditions
 * @param options - Evaluation options (e.g., strictMtf)
 */
export function evaluateCondition(
  condition: ExtendedCondition,
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[],
  mtfContext?: MtfContext,
  options: EvaluateConditionOptions = {},
): boolean {
  const { strictMtf = false } = options;

  // Custom function
  if (typeof condition === "function") {
    return condition(indicators, candle, index, candles);
  }

  // MTF preset condition
  if (condition.type === "mtf-preset") {
    if (!mtfContext) {
      // MTF condition without context - cannot evaluate
      if (strictMtf) {
        throw new MtfContextRequiredError(condition.name);
      }
      console.warn(
        `MTF condition "${condition.name}" requires MTF context. Use withMtf() to enable.`,
      );
      return false;
    }
    return condition.evaluate(mtfContext, indicators, candle, index, candles);
  }

  // Preset condition
  if (condition.type === "preset") {
    return condition.evaluate(indicators, candle, index, candles);
  }

  // Combined conditions (and/or/not)
  const combined = condition as CombinedCondition;
  switch (combined.type) {
    case "and":
      return combined.conditions.every((c) =>
        evaluateCondition(
          c as ExtendedCondition,
          indicators,
          candle,
          index,
          candles,
          mtfContext,
          options,
        ),
      );
    case "or":
      return combined.conditions.some((c) =>
        evaluateCondition(
          c as ExtendedCondition,
          indicators,
          candle,
          index,
          candles,
          mtfContext,
          options,
        ),
      );
    case "not":
      return !evaluateCondition(
        combined.conditions[0] as ExtendedCondition,
        indicators,
        candle,
        index,
        candles,
        mtfContext,
        options,
      );
    default:
      return false;
  }
}

/**
 * Check if a condition or any of its nested conditions require MTF context
 */
export function requiresMtf(condition: ExtendedCondition): boolean {
  if (typeof condition === "function") {
    return false;
  }

  if (condition.type === "mtf-preset") {
    return true;
  }

  if (condition.type === "preset") {
    return false;
  }

  // Check combined conditions recursively
  const combined = condition as CombinedCondition;
  return combined.conditions.some((c) => requiresMtf(c as ExtendedCondition));
}

/**
 * Get all required timeframes from a condition
 */
export function getRequiredTimeframes(condition: ExtendedCondition): Set<string> {
  const timeframes = new Set<string>();

  if (typeof condition === "function") {
    return timeframes;
  }

  if (condition.type === "mtf-preset") {
    for (const tf of condition.requiredTimeframes) {
      timeframes.add(tf);
    }
    return timeframes;
  }

  if (condition.type === "preset") {
    return timeframes;
  }

  // Check combined conditions recursively
  const combined = condition as CombinedCondition;
  for (const c of combined.conditions) {
    const nested = getRequiredTimeframes(c as ExtendedCondition);
    for (const tf of nested) {
      timeframes.add(tf);
    }
  }

  return timeframes;
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
