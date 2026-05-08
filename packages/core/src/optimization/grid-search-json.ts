/**
 * gridSearchFromJSON — JSON-first wrapper around `gridSearch`.
 *
 * Drives `gridSearch` directly from a `StrategyJSON` plus a list of
 * path-addressed parameter ranges, eliminating the need for callers to
 * write their own strategy-walker / param-injection plumbing. Path
 * syntax is documented on `applyParamOverrides` (see
 * `strategy/walker.ts`).
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

import { loadStrategy } from "../strategy/hydrate";
import type { ConditionRegistry } from "../strategy/registry";
import type { StrategyJSON } from "../strategy/types";
import { validateConditionSpec } from "../strategy/validate";
import {
  type LeafInfo,
  applyParamOverrides,
  flattenStrategyLeaves,
  parseLeafPath,
} from "../strategy/walker";
import type { BacktestOptions, Condition, NormalizedCandle } from "../types";
import type { GridSearchOptions, GridSearchResult, ParameterRange } from "../types/optimization";
import { type Result, err, ok, tcError } from "../types/result";
import { gridSearch } from "./grid-search";

/**
 * Path-addressed parameter range. The `path` field uses the syntax
 * documented on `applyParamOverrides`: `<bucket>.<leafIndex>.<paramName>`.
 *
 * Example: `{ path: "entry.0.shortPeriod", min: 3, max: 10, step: 1 }`
 */
export type PathParameterRange = {
  path: string;
  min: number;
  max: number;
  step: number;
};

/**
 * Validate every range path against the provided registry and return
 * the resolved leaf for downstream use. Throws an `Error` (not a
 * `Result`) on invalid input — `gridSearchFromJSONSafe` wraps the
 * throw into a `Result`.
 */
function validateRangePaths(
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
): void {
  // Empty ranges are passed through to `gridSearch`, which treats them
  // as a single-combination baseline run. This matches the underlying
  // engine's behavior so dynamic UIs that end up with no tunable params
  // selected still get a result instead of an INVALID_PARAMETER throw.
  const leaves = flattenStrategyLeaves(strategy);
  const leafByAddress: Map<string, LeafInfo> = new Map();
  for (const leaf of leaves) {
    leafByAddress.set(`${leaf.bucket}.${leaf.leafIndex}`, leaf);
  }
  // Track seen paths so duplicates are rejected before they double the
  // grid: two ranges with the same path map to two ParameterRanges
  // sharing a `name`, and the later assignment in the inner factory
  // would clobber the earlier one — `bestParams` would silently reflect
  // only one range while the search space ballooned by the duplicate's
  // cardinality.
  const seenPaths = new Set<string>();
  for (const range of ranges) {
    if (seenPaths.has(range.path)) {
      throw new Error(
        `Invalid range path "${range.path}": duplicate path — each path may appear at most once in ranges`,
      );
    }
    seenPaths.add(range.path);
    // Reject NaN / ±Infinity early. `gridSearch`'s loop generates
    // `min + i * step` and `<= max + ε` comparisons that are silently
    // wrong with non-finite values (NaN comparisons are always false,
    // Infinity step generates one combination forever). Fail upfront
    // with a recognizable "Invalid" message so the safe wrapper can
    // classify it as INVALID_PARAMETER.
    for (const [field, value] of [
      ["min", range.min],
      ["max", range.max],
      ["step", range.step],
    ] as const) {
      if (!Number.isFinite(value)) {
        throw new Error(
          `Invalid range path "${range.path}": ${field} must be a finite number, got ${value}`,
        );
      }
    }
    const parsed = parseLeafPath(range.path);
    if (parsed.paramName === null) {
      throw new Error(
        `Invalid range path "${range.path}": paramName is required for parameter ranges`,
      );
    }
    const leaf = leafByAddress.get(`${parsed.bucket}.${parsed.leafIndex}`);
    if (!leaf) {
      throw new Error(
        `Invalid range path "${range.path}": leaf index ${parsed.leafIndex} is out of range for bucket "${parsed.bucket}"`,
      );
    }
    const entry = registry.get(leaf.name);
    if (!entry) {
      throw new Error(
        `Invalid range path "${range.path}": leaf condition "${leaf.name}" is not registered`,
      );
    }
    const schema = entry.params[parsed.paramName];
    if (!schema) {
      throw new Error(
        `Invalid range path "${range.path}": condition "${leaf.name}" has no param "${parsed.paramName}"`,
      );
    }
    if (schema.type !== "number") {
      throw new Error(
        `Invalid range path "${range.path}": param "${parsed.paramName}" on "${leaf.name}" is type "${schema.type}", grid search only supports "number"`,
      );
    }
    // Catch caller-side range shape errors here so the safe variant
    // can classify them as INVALID_PARAMETER. `gridSearch` itself
    // throws with a different message ("Parameter ... step must be
    // positive") that doesn't start with "Invalid", so without this
    // the safe wrapper would map a user input error to OPTIMIZATION_FAILED.
    if (range.step <= 0) {
      throw new Error(
        `Invalid range path "${range.path}": step must be positive, got ${range.step}`,
      );
    }
    if (range.max < range.min) {
      throw new Error(
        `Invalid range path "${range.path}": max (${range.max}) must be >= min (${range.min})`,
      );
    }
    // Per-range schema enforcement. Without these, ranges that
    // generate impossible values (e.g. step 0.5 on an integer-only
    // param, or values below schema.min) only fail per-combination
    // inside the factory, where `gridSearch` swallows the throw and
    // reports `validCombinations: 0` instead of an actionable error.
    if (schema.integer === true) {
      for (const [field, value] of [
        ["min", range.min],
        ["max", range.max],
        ["step", range.step],
      ] as const) {
        if (!Number.isInteger(value)) {
          throw new Error(
            `Invalid range path "${range.path}": param "${parsed.paramName}" requires integer values (schema.integer=true), but ${field}=${value} is not an integer`,
          );
        }
      }
    }
    if (typeof schema.min === "number" && range.min < schema.min) {
      throw new Error(
        `Invalid range path "${range.path}": min (${range.min}) is below schema.min (${schema.min}) for "${parsed.paramName}"`,
      );
    }
    if (typeof schema.max === "number" && range.max > schema.max) {
      throw new Error(
        `Invalid range path "${range.path}": max (${range.max}) is above schema.max (${schema.max}) for "${parsed.paramName}"`,
      );
    }
  }

  // Validate the whole strategy *after* injecting one sample point per
  // range (`range.min`). Validating the raw strategy first would reject
  // legitimate optimization scenarios where the tuned param is missing
  // or temporarily out of bounds — the entire point of the search space
  // is to supply those values. Validating the saturated strategy still
  // catches issues in untuned parts (unregistered leaves elsewhere,
  // malformed `not` arity, schema violations on params not being tuned).
  const saturationOverrides: Record<string, number> = {};
  for (const range of ranges) {
    saturationOverrides[range.path] = range.min;
  }
  const saturated = applyParamOverrides(strategy, saturationOverrides);
  for (const bucket of ["entry", "exit"] as const) {
    const result = validateConditionSpec(saturated[bucket], registry);
    if (!result.valid) {
      throw new Error(`Invalid strategy: ${bucket} validation failed: ${result.errors.join("; ")}`);
    }
  }
}

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
 * metric, constraints) are passed through to `gridSearch` unchanged.
 */
export function gridSearchFromJSON(
  candles: NormalizedCandle[],
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
  options?: GridSearchOptions,
): GridSearchResult {
  validateRangePaths(strategy, ranges, registry);

  // Convert path-addressed ranges to the engine's `name`-keyed form.
  // `gridSearch` doesn't interpret `name`, so the path string is a
  // valid identifier and round-trips through `bestParams`.
  const parameterRanges: ParameterRange[] = ranges.map((r) => ({
    name: r.path,
    min: r.min,
    max: r.max,
    step: r.step,
  }));

  return gridSearch(
    candles,
    (params) => {
      const merged = applyParamOverrides(strategy, params);
      const { entry, exit, backtestOptions } = loadStrategy(merged, registry);
      const factoryOptions: BacktestOptions = {
        capital: 100_000,
        ...backtestOptions,
      };
      return { entry, exit, options: factoryOptions };
    },
    parameterRanges,
    options,
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
 * const result = gridSearchFromJSONSafe(candles, strategy, ranges, registry);
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
    let code: "INVALID_PARAMETER" | "TOO_MANY_COMBINATIONS" | "OPTIMIZATION_FAILED";
    if (message.includes("Too many parameter combinations")) {
      code = "TOO_MANY_COMBINATIONS";
    } else if (message.startsWith("Invalid")) {
      code = "INVALID_PARAMETER";
    } else {
      code = "OPTIMIZATION_FAILED";
    }
    return err(tcError(code, message, {}, error instanceof Error ? error : undefined));
  }
}
