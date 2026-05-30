/**
 * walkForwardAnalysisFromJSON — JSON-first wrapper around
 * `walkForwardAnalysis`.
 *
 * The rolling-window walk-forward engine takes a `StrategyFactory` plus
 * name-keyed `ParameterRange[]`. This wrapper drives it directly from a
 * `StrategyJSON` plus path-addressed `PathParameterRange[]`, reusing the
 * exact same validation and factory construction as `gridSearchFromJSON`
 * (both delegate to `strategy-json-factory.ts`), so the two entry points
 * can't drift on how a JSON strategy is optimized.
 *
 * Only rolling walk-forward is covered here. Anchored walk-forward
 * (`anchoredWalkForwardAnalysis`) runs a condition-combination search
 * rather than a parameter sweep, so it does not share this
 * (strategy, param-range) shape.
 *
 * @example
 * ```ts
 * import { walkForwardAnalysisFromJSON, backtestRegistry } from "trendcraft";
 *
 * const wf = walkForwardAnalysisFromJSON(
 *   candles,
 *   strategyJson,
 *   [
 *     { path: "entry.0.shortPeriod", min: 3, max: 10, step: 1 },
 *     { path: "entry.0.longPeriod", min: 15, max: 40, step: 5 },
 *   ],
 *   backtestRegistry,
 *   { windowSize: 252, stepSize: 63, testSize: 63 },
 * );
 *
 * console.log(wf.aggregateMetrics.stabilityRatio);
 * ```
 */

import type { ConditionRegistry } from "../strategy/registry";
import type { StrategyJSON } from "../strategy/types";
import type { Condition, NormalizedCandle } from "../types";
import type { WalkForwardOptions, WalkForwardResult } from "../types/optimization";
import { err, ok, type Result, tcError } from "../types/result";
import {
  classifyOptimizationError,
  type PathParameterRange,
  pathRangesToParameterRanges,
  strategyFactoryFromJSON,
  validateRangePaths,
} from "./strategy-json-factory";
import { walkForwardAnalysis } from "./walkforward";

/**
 * JSON-first rolling walk-forward analysis. Drives `walkForwardAnalysis`
 * from a `StrategyJSON` plus path-addressed `PathParameterRange[]`. The
 * per-period `bestParams` keys are paths (not raw param names), matching
 * `gridSearchFromJSON`, so they can be plugged straight back into
 * `applyParamOverrides` to apply a window's optimized params.
 *
 * Throws on invalid range paths (malformed, out-of-range leaf, unknown
 * or non-numeric param) and on insufficient data (the slice can't fit
 * one train+test window). Use `walkForwardAnalysisFromJSONSafe` for a
 * `Result`-returning variant.
 *
 * The `strategy.backtest` block is forwarded into each window's backtest
 * options, so commission / direction / stops / capital from the strategy
 * JSON are honored. Caller-supplied `options` (window/step/test sizes,
 * metric, constraints) are passed through unchanged.
 */
export function walkForwardAnalysisFromJSON(
  candles: NormalizedCandle[],
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
  options?: WalkForwardOptions,
): WalkForwardResult {
  validateRangePaths(strategy, ranges, registry);
  return walkForwardAnalysis(
    candles,
    strategyFactoryFromJSON(strategy, registry),
    pathRangesToParameterRanges(ranges),
    options,
  );
}

/**
 * Safe variant of `walkForwardAnalysisFromJSON` that returns a `Result`
 * instead of throwing. Range-path validation errors map to
 * `INVALID_PARAMETER`, an over-large grid to `TOO_MANY_COMBINATIONS`, a
 * too-short slice to `INSUFFICIENT_DATA`, everything else to
 * `OPTIMIZATION_FAILED`.
 *
 * @example
 * ```ts
 * const result = walkForwardAnalysisFromJSONSafe(candles, strategy, ranges, registry);
 * if (result.ok) {
 *   console.log(result.value.recommendation);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export function walkForwardAnalysisFromJSONSafe(
  candles: NormalizedCandle[],
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
  options?: WalkForwardOptions,
): Result<WalkForwardResult> {
  try {
    return ok(walkForwardAnalysisFromJSON(candles, strategy, ranges, registry, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = classifyOptimizationError(message);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
