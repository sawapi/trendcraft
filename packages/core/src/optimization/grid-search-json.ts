/**
 * gridSearchFromJSON — JSON-first wrapper around `gridSearch`.
 *
 * Drives `gridSearch` directly from a `StrategyJSON` plus a list of
 * path-addressed parameter ranges, eliminating the need for callers to
 * write their own strategy-walker / param-injection plumbing. Path
 * syntax is documented on `applyParamOverrides` (see
 * `strategy/walker.ts`). The shared JSON→factory translation lives in
 * `strategy-json-factory.ts` so this and `walkForwardAnalysisFromJSON`
 * can't drift on validation or factory construction.
 *
 * @example
 * ```ts
 * import { gridSearchFromJSON, backtestRegistry } from "trendcraft";
 *
 * const result = gridSearchFromJSON(
 *   candles,
 *   strategyJson,
 *   [
 *     { path: "entry.0.shortPeriod", min: 3, max: 10, step: 1 },
 *     { path: "entry.0.longPeriod", min: 15, max: 40, step: 5 },
 *   ],
 *   backtestRegistry,
 * );
 *
 * if (result.bestParams !== null) {
 *   console.log(result.bestParams["entry.0.shortPeriod"]);
 * }
 * ```
 */

import type { ConditionRegistry } from "../strategy/registry";
import type { StrategyJSON } from "../strategy/types";
import type { Condition, NormalizedCandle } from "../types";
import type { GridSearchOptions, GridSearchResult } from "../types/optimization";
import { err, ok, type Result, tcError } from "../types/result";
import { gridSearch } from "./grid-search";
import {
  classifyOptimizationError,
  composeParamFilter,
  type PathParameterRange,
  pathRangesToParameterRanges,
  strategyFactoryFromJSON,
  validateRangePaths,
} from "./strategy-json-factory";

export type { PathParameterRange } from "./strategy-json-factory";

/**
 * JSON-first grid search. Drives the existing `gridSearch` engine from
 * a `StrategyJSON` plus path-addressed `PathParameterRange[]`. The
 * resulting `GridSearchResult.bestParams` keys are paths (not raw
 * param names) so callers can plug them straight back into
 * `applyParamOverrides` to apply the result.
 *
 * Throws if any range path fails to resolve (malformed, out-of-range
 * leaf, unknown param, non-numeric param). Use
 * `gridSearchFromJSONSafe` for a `Result`-returning variant.
 *
 * The `strategy.backtest` block is forwarded into the underlying
 * backtest options, so commission / direction / stops / capital from
 * the strategy JSON are honored. Caller-supplied `options` (e.g.
 * metric, constraints) are passed through to `gridSearch`; any
 * registered cross-parameter constraints (`validateParams`, e.g.
 * `goldenCross` requiring `shortPeriod < longPeriod`) are AND'd into
 * `paramFilter` so structurally-invalid combinations are skipped before
 * backtesting rather than ranked as results.
 */
export function gridSearchFromJSON(
  candles: NormalizedCandle[],
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
  options?: GridSearchOptions,
): GridSearchResult {
  validateRangePaths(strategy, ranges, registry);
  return gridSearch(
    candles,
    strategyFactoryFromJSON(strategy, registry),
    pathRangesToParameterRanges(ranges),
    {
      ...options,
      paramFilter: composeParamFilter(strategy, registry, options?.paramFilter),
    },
  );
}

/**
 * Safe variant of `gridSearchFromJSON` that returns a `Result` instead
 * of throwing on invalid input. Validation errors map to
 * `INVALID_PARAMETER`, capacity errors to `TOO_MANY_COMBINATIONS`,
 * everything else to `OPTIMIZATION_FAILED`.
 *
 * @example
 * ```ts
 * const result = gridSearchFromJSONSafe(candles, strategyJson, pathRanges, backtestRegistry);
 * if (result.ok) {
 *   console.log(result.value.bestParams);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export function gridSearchFromJSONSafe(
  candles: NormalizedCandle[],
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
  options?: GridSearchOptions,
): Result<GridSearchResult> {
  try {
    return ok(gridSearchFromJSON(candles, strategy, ranges, registry, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = classifyOptimizationError(message);
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
