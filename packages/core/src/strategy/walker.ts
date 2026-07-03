/**
 * Strategy walker — utilities for inspecting and rewriting StrategyJSON
 * shapes without going through hydration. Primarily used by the
 * optimization layer (`gridSearchFromJSON`) and any UI that needs to
 * deep-link or override numeric parameters at specific leaves.
 *
 * **Path syntax** (`<bucket>.<leafIndex>.<paramName>`):
 *
 * - `bucket` — `"entry"` or `"exit"`
 * - `leafIndex` — position of the leaf in depth-first order across the
 *   entire entry/exit ConditionSpec tree. AND-of-leaves uses 0,1,2,...
 *   For nested combinators (`and(or(a, b), c)`) the order is `a, b, c`.
 * - `paramName` — the parameter key inside the addressed leaf.
 *
 * The path uses `.` as the only separator, so `paramName` itself must
 * not contain `.` — that is consistent with all current registry param
 * names. Future syntax extensions for dotted param names would live
 * behind a different constructor (e.g. JSON-pointer paths).
 *
 * @example
 * ```ts
 * import { flattenStrategyLeaves, applyParamOverrides } from "trendcraft";
 *
 * const leaves = flattenStrategyLeaves(strategyJson);
 * // [{ bucket: "entry", leafIndex: 0, name: "goldenCross", params: {...} }, ...]
 *
 * const tuned = applyParamOverrides(strategyJson, {
 *   "entry.0.shortPeriod": 10,
 *   "entry.0.longPeriod": 50,
 * });
 * ```
 */

import type { ConditionSpec, StrategyJSON } from "./types";

/**
 * One enumerated leaf produced by `flattenStrategyLeaves`. The triple
 * `(bucket, leafIndex, name)` uniquely identifies the leaf within a
 * StrategyJSON; `params` is the leaf's own parameter object (or
 * `undefined` if the leaf was registered without params).
 */
export type LeafInfo = {
  bucket: "entry" | "exit";
  leafIndex: number;
  name: string;
  params?: Record<string, unknown>;
};

/**
 * Parsed leaf path. `paramName` is `null` when the path was just the
 * leaf-address portion (`bucket.leafIndex`) — exposed so callers that
 * want to address a whole leaf, not a single param, can do so.
 */
export type ParsedLeafPath = {
  bucket: "entry" | "exit";
  leafIndex: number;
  paramName: string | null;
};

function isLeafSpec(
  spec: ConditionSpec,
): spec is { name: string; params?: Record<string, unknown> } {
  return "name" in spec;
}

/**
 * Recursively collect leaves from a single ConditionSpec tree in
 * depth-first order. Combinators (`and` / `or` / `not`) are walked
 * but contribute no leaves themselves.
 */
function collectLeaves(
  spec: ConditionSpec,
): Array<{ name: string; params?: Record<string, unknown> }> {
  if (isLeafSpec(spec)) {
    return [{ name: spec.name, params: spec.params }];
  }
  // Mirror hydration semantics: `not` is unary — only `conditions[0]`
  // is hydrated and evaluated. If a malformed strategy passes more
  // children, walking them all would expose paths to leaves that never
  // affect the backtest, leading callers to optimize parameters with
  // no observable effect. (`validateConditionSpec` also catches
  // `not` with arity != 1; this is defense-in-depth for the walker.)
  // For an empty conditions array, return no leaves rather than
  // dereferencing `conditions[0]` and throwing a low-level
  // `isLeafSpec(undefined)` error — downstream
  // `validateConditionSpec` surfaces the malformed combinator.
  if (spec.op === "not") {
    if (spec.conditions.length === 0) return [];
    return collectLeaves(spec.conditions[0]);
  }
  return spec.conditions.flatMap(collectLeaves);
}

/**
 * Enumerate every leaf in a strategy's entry and exit specs, returning
 * each leaf tagged with its bucket and depth-first index. Pure: does
 * not look at the registry, does not hydrate.
 */
export function flattenStrategyLeaves(strategy: StrategyJSON): LeafInfo[] {
  const out: LeafInfo[] = [];
  for (const bucket of ["entry", "exit"] as const) {
    const leaves = collectLeaves(strategy[bucket]);
    for (let i = 0; i < leaves.length; i++) {
      // Shallow-clone `params` so a caller treating LeafInfo[] as
      // editable state (UIs, deep-link routers) can't mutate the
      // source StrategyJSON in place. The walker is presented as a
      // read-only inspection primitive; mutating overrides go
      // through `applyParamOverrides` which is explicitly pure.
      out.push({
        bucket,
        leafIndex: i,
        name: leaves[i].name,
        params: leaves[i].params ? { ...leaves[i].params } : undefined,
      });
    }
  }
  return out;
}

/**
 * Parse a path string of the form `<bucket>.<leafIndex>` or
 * `<bucket>.<leafIndex>.<paramName>`. Throws with a descriptive error
 * if the path is malformed, the bucket is not `entry` / `exit`, or
 * `leafIndex` is not a non-negative integer.
 */
export function parseLeafPath(path: string): ParsedLeafPath {
  const parts = path.split(".");
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(
      `Invalid path "${path}": expected "<bucket>.<leafIndex>" or "<bucket>.<leafIndex>.<paramName>"`,
    );
  }
  const [bucketStr, indexStr, paramName] = parts;
  if (bucketStr !== "entry" && bucketStr !== "exit") {
    throw new Error(`Invalid path "${path}": bucket must be "entry" or "exit", got "${bucketStr}"`);
  }
  // Reject zero-padded indices like `"entry.01.x"`. Allowing them
  // would let aliases for the same canonical leaf
  // (`entry.1.x` vs `entry.01.x`) bypass dedup and silently inflate
  // the grid search space while only the later override key wins.
  if (!/^(0|[1-9]\d*)$/.test(indexStr)) {
    throw new Error(
      `Invalid path "${path}": leafIndex must be a non-negative integer with no leading zeros, got "${indexStr}"`,
    );
  }
  // Reject trailing-dot paths like `"entry.0."` — `split(".")` yields
  // an empty third segment, which would otherwise sneak through as an
  // empty-string paramName and silently inject `{ "": value }`.
  if (paramName !== undefined && paramName === "") {
    throw new Error(
      `Invalid path "${path}": paramName must be non-empty (drop the trailing "." to address the leaf as a whole)`,
    );
  }
  return {
    bucket: bucketStr,
    leafIndex: Number(indexStr),
    paramName: paramName ?? null,
  };
}

/**
 * Pure: returns a new StrategyJSON with the addressed leaves' params
 * updated. Throws if any path does not resolve to an existing leaf
 * (out-of-range leafIndex, malformed path, etc.). Paths whose
 * `paramName` is `null` are rejected — overriding requires a target
 * param.
 *
 * Implementation note: the function deep-clones only the path from
 * the root to each touched leaf. Leaves that are not touched share
 * structural identity with the input. The input strategy itself is
 * never mutated.
 */
export function applyParamOverrides(
  strategy: StrategyJSON,
  overrides: Record<string, number>,
): StrategyJSON {
  // Group overrides by (bucket, leafIndex) so a single leaf rewrite
  // applies all addressed params at once.
  const byBucket: Record<"entry" | "exit", Map<number, Record<string, number>>> = {
    entry: new Map(),
    exit: new Map(),
  };
  for (const [path, value] of Object.entries(overrides)) {
    const parsed = parseLeafPath(path);
    if (parsed.paramName === null) {
      throw new Error(`Invalid override path "${path}": paramName is required`);
    }
    const map = byBucket[parsed.bucket];
    const slot = map.get(parsed.leafIndex) ?? {};
    slot[parsed.paramName] = value;
    map.set(parsed.leafIndex, slot);
  }

  const rewriteBucket = (
    spec: ConditionSpec,
    bucket: "entry" | "exit",
  ): { spec: ConditionSpec; consumed: number } => {
    // We track a running leaf index as we descend so each leaf's address
    // matches what `flattenStrategyLeaves` would assign.
    let cursor = 0;
    const visit = (s: ConditionSpec): ConditionSpec => {
      if (isLeafSpec(s)) {
        const leafIndex = cursor++;
        const slot = byBucket[bucket].get(leafIndex);
        if (!slot) return s;
        const merged: Record<string, unknown> = { ...(s.params ?? {}) };
        for (const [k, v] of Object.entries(slot)) merged[k] = v;
        return { name: s.name, params: merged };
      }
      // Mirror `flattenStrategyLeaves`: `not` is unary, only `conditions[0]`
      // participates in leaf indexing. Preserve any extra children
      // structurally so the strategy round-trips, but never assign them
      // an index — otherwise paths the flattener can never enumerate
      // would silently rewrite leaves that hydration ignores.
      if (s.op === "not") {
        const newConditions = s.conditions.map((child, i) => (i === 0 ? visit(child) : child));
        return { op: "not", conditions: newConditions };
      }
      const newConditions = s.conditions.map((child) => visit(child));
      return { op: s.op, conditions: newConditions };
    };
    const rewritten = visit(spec);
    return { spec: rewritten, consumed: cursor };
  };

  const entry = rewriteBucket(strategy.entry, "entry");
  const exit = rewriteBucket(strategy.exit, "exit");

  // After rewriting, validate that every override actually addressed a
  // real leaf. Out-of-range indices would silently no-op otherwise.
  for (const bucket of ["entry", "exit"] as const) {
    const consumed = bucket === "entry" ? entry.consumed : exit.consumed;
    for (const leafIndex of byBucket[bucket].keys()) {
      if (leafIndex >= consumed) {
        throw new Error(
          `Invalid override path "${bucket}.${leafIndex}.*": leaf index ${leafIndex} is out of range (${bucket} has ${consumed} leaves)`,
        );
      }
    }
  }

  return {
    ...strategy,
    entry: entry.spec,
    exit: exit.spec,
  };
}
