/**
 * High-level signal explanation API
 *
 * Provides functions to explain why a signal fired or didn't fire,
 * with full condition traces and human-readable narratives.
 */

import type { ExtendedCondition } from "../backtest/conditions/core";
import type { MtfContext, NormalizedCandle } from "../types";
import type { ConditionTrace, ExplainOptions, SignalExplanation } from "../types/explainability";
import { generateNarrative } from "./narrative";
import { traceCondition } from "./trace";

/**
 * Explain a signal evaluation at a specific candle index
 *
 * Traces both entry and exit conditions, returning a full explanation
 * of which conditions passed/failed and why.
 *
 * If the entry condition fires, the explanation describes the entry signal.
 * If it does not fire, the exit condition is also traced. If the exit fires,
 * the explanation describes the exit signal. Otherwise, the explanation
 * reports that the entry signal did not fire.
 *
 * @param candles - Full array of normalized candles
 * @param index - Index of the candle to evaluate
 * @param entryCondition - Entry condition to trace
 * @param exitCondition - Exit condition to trace
 * @param options - Explain options (includeValues, maxDepth, language)
 * @param mtfContext - Optional multi-timeframe context
 * @returns Full signal explanation with trace, contributions, and narrative
 *
 * @example
 * ```ts
 * import { explainSignal, rsiBelow, rsiAbove } from "trendcraft";
 *
 * const explanation = explainSignal(candles, 50, rsiBelow(30), rsiAbove(70));
 * console.log(explanation.fired);     // true/false
 * console.log(explanation.narrative); // Human-readable explanation
 * console.log(explanation.contributions); // Leaf condition details
 * ```
 */
export function explainSignal(
  candles: NormalizedCandle[],
  index: number,
  entryCondition: ExtendedCondition,
  exitCondition: ExtendedCondition,
  options: ExplainOptions = {},
  mtfContext?: MtfContext,
): SignalExplanation {
  const candle = candles[index];
  const indicators: Record<string, unknown> = {};
  const candleSnapshot = {
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };

  // Trace entry condition
  const entryTrace = traceCondition(
    entryCondition,
    indicators,
    candle,
    index,
    candles,
    mtfContext,
    options,
  );

  let signalType: "entry" | "exit";
  let fired: boolean;
  let trace: ConditionTrace;

  if (entryTrace.passed) {
    signalType = "entry";
    fired = true;
    trace = entryTrace;
  } else {
    // Entry did not fire - trace exit condition
    const exitTrace = traceCondition(
      exitCondition,
      indicators,
      candle,
      index,
      candles,
      mtfContext,
      options,
    );
    signalType = exitTrace.passed ? "exit" : "entry";
    fired = exitTrace.passed;
    trace = exitTrace.passed ? exitTrace : entryTrace;
  }

  const contributions = flattenContributions(trace);
  const narrative = generateNarrative(trace, signalType, fired, candle, options.language);

  return {
    signalType,
    fired,
    time: candle.time,
    candle: candleSnapshot,
    trace,
    contributions,
    narrative,
  };
}

/**
 * Explain a single condition evaluation at a specific candle index
 *
 * Simpler API than explainSignal when you only need to trace one condition.
 *
 * @param candles - Full array of normalized candles
 * @param index - Index of the candle to evaluate
 * @param condition - Condition to trace
 * @param options - Explain options (includeValues, maxDepth)
 * @param mtfContext - Optional multi-timeframe context
 * @returns Condition trace with evaluation result
 *
 * @example
 * ```ts
 * import { explainCondition, rsiBelow } from "trendcraft";
 *
 * const trace = explainCondition(candles, 50, rsiBelow(30));
 * console.log(trace.passed);          // true/false
 * console.log(trace.indicatorValues); // { rsi14: 28.5 }
 * ```
 */
export function explainCondition(
  candles: NormalizedCandle[],
  index: number,
  condition: ExtendedCondition,
  options: ExplainOptions = {},
  mtfContext?: MtfContext,
): ConditionTrace {
  const indicators: Record<string, unknown> = {};
  return traceCondition(condition, indicators, candles[index], index, candles, mtfContext, options);
}

/**
 * Flatten a condition trace tree into a list of leaf contributions
 *
 * Extracts only preset, mtf-preset, and function conditions (leaf nodes),
 * skipping combined condition wrappers.
 */
function flattenContributions(trace: ConditionTrace): SignalExplanation["contributions"] {
  const result: SignalExplanation["contributions"] = [];

  function walk(t: ConditionTrace): void {
    if (t.type === "preset" || t.type === "mtf-preset" || t.type === "function") {
      result.push({
        name: t.name,
        passed: t.passed,
        indicatorValues: t.indicatorValues,
      });
    }
    if (t.children) {
      for (const child of t.children) {
        walk(child);
      }
    }
  }

  walk(trace);
  return result;
}
