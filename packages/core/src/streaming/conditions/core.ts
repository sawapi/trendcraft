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
import type {
  IndicatorSnapshot,
  StreamingCombinedCondition,
  StreamingCondition,
  StreamingConditionContext,
} from "./types";

const CONFIRMED: StreamingConditionContext = { mode: "next" };

/**
 * Whether a stateful condition may record this bar as its previous value:
 * true for a confirmed bar, false for a peek at a forming one.
 */
export function commitsState(context?: StreamingConditionContext): boolean {
  return context?.mode !== "peek";
}

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
 * const exit = or(rsiAbove(70), smaDeadCross());
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
 * `and`, `or` and `not` evaluate every child on every bar rather than
 * stopping at the first decisive one. A child that compares with the
 * previous bar (a cross, a rising check) must see every confirmed bar: if
 * `and(rsiBelow(30), smaGoldenCross())` skipped the cross whenever RSI was
 * above 30, the cross would later compare against values from bars ago and
 * report crosses that never happened.
 *
 * @param condition - The condition to evaluate
 * @param snapshot - Current indicator values
 * @param candle - Current candle
 * @param context - `{ mode: "peek" }` for a forming bar, so stateful
 *   conditions leave their state unchanged (default: a confirmed bar)
 * @returns Whether the condition is met
 *
 * @example
 * ```ts
 * const entryCondition = and(rsiBelow(30), smaGoldenCross());
 * const isEntry = evaluateStreamingCondition(entryCondition, snapshot, candle);
 * ```
 */
export function evaluateStreamingCondition(
  condition: StreamingCondition,
  snapshot: IndicatorSnapshot,
  candle: NormalizedCandle,
  context: StreamingConditionContext = CONFIRMED,
): boolean {
  // Function condition
  if (typeof condition === "function") {
    return condition(snapshot, candle, context);
  }

  // Preset condition
  if (condition.type === "preset") {
    return condition.evaluate(snapshot, candle, context);
  }

  // Combined conditions: evaluate every child (see above), then combine.
  const results = condition.conditions.map((c) =>
    evaluateStreamingCondition(c, snapshot, candle, context),
  );
  switch (condition.type) {
    case "and":
      return results.every(Boolean);
    case "or":
      return results.some(Boolean);
    case "not":
      return !results[0];
    default:
      return false;
  }
}
