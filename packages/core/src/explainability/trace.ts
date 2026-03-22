/**
 * Core condition tracing logic
 *
 * Traces the evaluation of backtest conditions, capturing indicator values
 * and building a tree of condition results for explainability.
 */

import type { ExtendedCondition } from "../backtest/conditions/core";
import type { CombinedCondition, MtfContext, NormalizedCandle } from "../types";
import type { ConditionTrace, ExplainOptions } from "../types/explainability";

/**
 * Trace a condition evaluation, capturing indicator values and pass/fail status
 *
 * Recursively traces combined conditions (and/or/not) and captures
 * indicator cache state for preset and custom conditions.
 *
 * @param condition - Condition to trace
 * @param indicators - Shared indicator cache (mutated during evaluation)
 * @param candle - Current candle being evaluated
 * @param index - Current candle index in the array
 * @param candles - Full array of normalized candles
 * @param mtfContext - Optional multi-timeframe context
 * @param options - Explain options (includeValues, maxDepth)
 * @param depth - Current recursion depth (internal use)
 * @returns Condition trace with evaluation result and indicator values
 *
 * @example
 * ```ts
 * import { traceCondition } from "trendcraft";
 * import { rsiBelow } from "trendcraft";
 *
 * const indicators: Record<string, unknown> = {};
 * const trace = traceCondition(
 *   rsiBelow(30),
 *   indicators,
 *   candles[50],
 *   50,
 *   candles,
 * );
 * console.log(trace.passed, trace.indicatorValues);
 * ```
 */
export function traceCondition(
  condition: ExtendedCondition,
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[],
  mtfContext?: MtfContext,
  options: ExplainOptions = {},
  depth = 0,
): ConditionTrace {
  const maxDepth = options.maxDepth ?? 10;
  const includeValues = options.includeValues !== false;

  // Custom function condition
  if (typeof condition === "function") {
    const keysBefore = new Set(Object.keys(indicators));
    const passed = condition(indicators, candle, index, candles);
    const newValues: Record<string, unknown> = {};
    if (includeValues) {
      for (const key of Object.keys(indicators)) {
        if (!keysBefore.has(key)) {
          const series = indicators[key] as Array<{ value: unknown }> | undefined;
          if (series?.[index]) {
            newValues[key] = series[index].value;
          }
        }
      }
    }
    return {
      name: "custom function",
      passed,
      indicatorValues: newValues,
      reason: passed ? "Custom condition passed" : "Custom condition failed",
      type: "function",
    };
  }

  // MTF preset condition
  if (condition.type === "mtf-preset") {
    let passed = false;
    if (mtfContext) {
      passed = condition.evaluate(mtfContext, indicators, candle, index, candles);
    }
    const values = extractIndicatorValues(indicators, index, includeValues);
    return {
      name: condition.name,
      passed,
      indicatorValues: values,
      reason: passed
        ? `${condition.name}: passed`
        : mtfContext
          ? `${condition.name}: failed`
          : `${condition.name}: no MTF context`,
      type: "mtf-preset",
    };
  }

  // Preset condition
  if (condition.type === "preset") {
    const passed = condition.evaluate(indicators, candle, index, candles);
    const capturedValues: Record<string, unknown> = {};
    if (includeValues) {
      // Capture all indicator values (both new and pre-existing)
      for (const key of Object.keys(indicators)) {
        const series = indicators[key] as Array<{ value: unknown }> | undefined;
        if (series?.[index]) {
          capturedValues[key] = series[index].value;
        }
      }
    }
    return {
      name: condition.name,
      passed,
      indicatorValues: capturedValues,
      reason: passed ? `${condition.name}: passed` : `${condition.name}: failed`,
      type: "preset",
    };
  }

  // Combined conditions (and/or/not) - check depth limit
  if (depth >= maxDepth) {
    return {
      name: `${condition.type}(...)`,
      passed: false,
      indicatorValues: {},
      reason: "Max trace depth reached",
      type: "combined",
    };
  }

  const combined = condition as CombinedCondition;
  const children = combined.conditions.map((c) =>
    traceCondition(
      c as ExtendedCondition,
      indicators,
      candle,
      index,
      candles,
      mtfContext,
      options,
      depth + 1,
    ),
  );

  let passed: boolean;
  switch (combined.type) {
    case "and":
      passed = children.every((c) => c.passed);
      break;
    case "or":
      passed = children.some((c) => c.passed);
      break;
    case "not":
      passed = !children[0].passed;
      break;
    default:
      passed = false;
  }

  // Merge indicator values from children
  const mergedValues: Record<string, unknown> = {};
  if (includeValues) {
    for (const child of children) {
      Object.assign(mergedValues, child.indicatorValues);
    }
  }

  return {
    name: `${combined.type}(${children.map((c) => c.name).join(", ")})`,
    passed,
    indicatorValues: mergedValues,
    reason: formatCombinedReason(combined.type, children),
    children,
    type: "combined",
  };
}

/**
 * Extract all indicator values at a given index from the indicator cache
 */
function extractIndicatorValues(
  indicators: Record<string, unknown>,
  index: number,
  includeValues: boolean,
): Record<string, unknown> {
  if (!includeValues) return {};
  const values: Record<string, unknown> = {};
  for (const [key, series] of Object.entries(indicators)) {
    const arr = series as Array<{ value: unknown }> | undefined;
    if (arr?.[index]) {
      values[key] = arr[index].value;
    }
  }
  return values;
}

/**
 * Format a human-readable reason string for a combined condition
 */
function formatCombinedReason(type: string, children: ConditionTrace[]): string {
  const passedNames = children.filter((c) => c.passed).map((c) => c.name);
  const failedNames = children.filter((c) => !c.passed).map((c) => c.name);

  switch (type) {
    case "and":
      if (failedNames.length === 0) return `All conditions passed: ${passedNames.join(", ")}`;
      return `Failed: ${failedNames.join(", ")}`;
    case "or":
      if (passedNames.length > 0) return `Passed: ${passedNames.join(", ")}`;
      return "All conditions failed";
    case "not":
      return children[0].passed
        ? "Negated condition was true -> result: false"
        : "Negated condition was false -> result: true";
    default:
      return "";
  }
}
