/**
 * Streaming Condition Evaluation and Combinators
 *
 * Provides and/or/not combinators and evaluation logic for streaming conditions.
 * These mirror the batch backtest condition system but are simplified for
 * streaming: they take (snapshot, candle) instead of (indicators, candle, index, candles).
 *
 * @example
 * ```ts
 * const condition = and(
 *   rsiBelow(30),
 *   smaGoldenCross(),
 * );
 * const result = evaluateStreamingCondition(condition, snapshot, candle);
 * ```
 */

import type { NormalizedCandle } from "../../types";
import type { IndicatorSnapshot, StreamingCombinedCondition, StreamingCondition } from "./types";

/**
 * Combine conditions with AND logic (all must be true)
 *
 * @param conditions - Conditions to combine
 * @returns A combined AND condition
 *
 * @example
 * ```ts
 * const entry = and(rsiBelow(30), smaGoldenCross());
 * ```
 */
export function and(...conditions: StreamingCondition[]): StreamingCombinedCondition {
  return { type: "and", conditions };
}

/**
 * Combine conditions with OR logic (any must be true)
 *
 * @param conditions - Conditions to combine
 * @returns A combined OR condition
 *
 * @example
 * ```ts
 * const exit = or(rsiAbove(70), smaCrossUnder());
 * ```
 */
export function or(...conditions: StreamingCondition[]): StreamingCombinedCondition {
  return { type: "or", conditions };
}

/**
 * Negate a condition
 *
 * @param condition - Condition to negate
 * @returns A NOT condition
 *
 * @example
 * ```ts
 * const notOverbought = not(rsiAbove(70));
 * ```
 */
export function not(condition: StreamingCondition): StreamingCombinedCondition {
  return { type: "not", conditions: [condition] };
}

/**
 * Evaluate a streaming condition against a snapshot and candle.
 *
 * @param condition - The condition to evaluate
 * @param snapshot - Current indicator values
 * @param candle - Current candle
 * @returns Whether the condition is met
 *
 * @example
 * ```ts
 * const isEntry = evaluateStreamingCondition(entryCondition, snapshot, candle);
 * ```
 */
export function evaluateStreamingCondition(
  condition: StreamingCondition,
  snapshot: IndicatorSnapshot,
  candle: NormalizedCandle,
): boolean {
  // Function condition
  if (typeof condition === "function") {
    return condition(snapshot, candle);
  }

  // Preset condition
  if (condition.type === "preset") {
    return condition.evaluate(snapshot, candle);
  }

  // Combined conditions
  switch (condition.type) {
    case "and":
      return condition.conditions.every((c) => evaluateStreamingCondition(c, snapshot, candle));
    case "or":
      return condition.conditions.some((c) => evaluateStreamingCondition(c, snapshot, candle));
    case "not":
      return !evaluateStreamingCondition(condition.conditions[0], snapshot, candle);
    default:
      return false;
  }
}
