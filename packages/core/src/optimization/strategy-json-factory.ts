/**
 * Shared JSON-first optimization plumbing.
 *
 * Both `gridSearchFromJSON` and `walkForwardAnalysisFromJSON` drive an
 * engine (`gridSearch` / `walkForwardAnalysis`) that takes a
 * `StrategyFactory` plus name-keyed `ParameterRange[]`. The translation
 * from a `StrategyJSON` + path-addressed `PathParameterRange[]` is
 * identical for both: validate the paths, build a factory that injects
 * the swept params via `applyParamOverrides`, and convert the ranges to
 * the engine's `name`-keyed shape. This module is the single owner of
 * that translation so the two entry points can't drift on validation
 * rules or factory construction.
 */

import { loadStrategy } from "../strategy/hydrate";
import type { ConditionRegistry } from "../strategy/registry";
import type { StrategyJSON } from "../strategy/types";
import { validateConditionSpec } from "../strategy/validate";
import {
  applyParamOverrides,
  flattenStrategyLeaves,
  type LeafInfo,
  parseLeafPath,
} from "../strategy/walker";
import type { BacktestOptions, Condition } from "../types";
import type { ParameterRange } from "../types/optimization";
import type { StrategyFactory } from "./grid-search";

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
 * Validate every range path against the provided registry. Throws an
 * `Error` (not a `Result`) on invalid input — the `*Safe` wrappers map
 * the throw into a `Result`. All "Invalid…"-prefixed messages are
 * classified as `INVALID_PARAMETER` by those wrappers.
 */
export function validateRangePaths(
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
): void {
  // Empty ranges are passed through to the engine, which treats them as
  // a single-combination baseline run. This matches the underlying
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
    // Reject NaN / ±Infinity early. The engine's loop generates
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
        `Invalid range path "${range.path}": param "${parsed.paramName}" on "${leaf.name}" is type "${schema.type}", optimization only supports "number"`,
      );
    }
    // Catch caller-side range shape errors here so the safe variant can
    // classify them as INVALID_PARAMETER. The engine itself throws with
    // a different message ("Parameter ... step must be positive") that
    // doesn't start with "Invalid", so without this the safe wrapper
    // would map a user input error to OPTIMIZATION_FAILED.
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
    // Per-range schema enforcement. Without these, ranges that generate
    // impossible values (e.g. step 0.5 on an integer-only param, or
    // values below schema.min) only fail per-combination inside the
    // factory, where the engine swallows the throw and reports
    // `validCombinations: 0` instead of an actionable error.
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
 * Build a `StrategyFactory` that injects the swept params into the JSON
 * strategy via `applyParamOverrides`, then hydrates entry / exit
 * conditions and backtest options. The `strategy.backtest` block is
 * forwarded so commission / direction / stops / capital from the
 * strategy JSON are honored; capital defaults to 100,000 when unset.
 *
 * The factory receives the engine's name-keyed params, where each
 * `name` is a range path string (see {@link pathRangesToParameterRanges}),
 * so it can pass them straight to `applyParamOverrides`.
 */
export function strategyFactoryFromJSON(
  strategy: StrategyJSON,
  registry: ConditionRegistry<Condition>,
): StrategyFactory {
  return (params) => {
    const merged = applyParamOverrides(strategy, params);
    const { entry, exit, backtestOptions } = loadStrategy(merged, registry);
    const factoryOptions: BacktestOptions = {
      capital: 100_000,
      ...backtestOptions,
    };
    return { entry, exit, options: factoryOptions };
  };
}

/**
 * Convert path-addressed ranges to the engine's `name`-keyed
 * `ParameterRange[]`. The engine doesn't interpret `name`, so the path
 * string is a valid identifier and round-trips through `bestParams` /
 * `bestEntryConditions` keys.
 */
export function pathRangesToParameterRanges(ranges: PathParameterRange[]): ParameterRange[] {
  return ranges.map((r) => ({
    name: r.path,
    min: r.min,
    max: r.max,
    step: r.step,
  }));
}

/**
 * Classify a thrown optimization error into the safe-variant error code.
 * Shared so every `*FromJSONSafe` wrapper maps messages identically.
 */
export function classifyOptimizationError(
  message: string,
): "INVALID_PARAMETER" | "TOO_MANY_COMBINATIONS" | "INSUFFICIENT_DATA" | "OPTIMIZATION_FAILED" {
  if (message.includes("Too many parameter combinations")) {
    return "TOO_MANY_COMBINATIONS";
  }
  if (message.startsWith("Invalid")) {
    return "INVALID_PARAMETER";
  }
  // Walk-forward throws "Insufficient data for walk-forward analysis…"
  // when the slice can't fit even one train+test window.
  if (message.includes("Insufficient data")) {
    return "INSUFFICIENT_DATA";
  }
  return "OPTIMIZATION_FAILED";
}
