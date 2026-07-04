/**
 * Strategy Tunables
 *
 * Walk a `StrategyJSON` to enumerate the numeric parameters that an
 * optimizer or UI can vary. Mirrors the introspection surface every
 * mainstream TA framework exposes — TA-Lib's
 * `TA_GetOptInputParameterInfo`, backtrader's `self.params`, freqtrade's
 * `IntParameter` / `DecimalParameter`, Pine Script's `input.int` /
 * `input.float`.
 *
 * Each emitted `Tunable.key` follows the canonical path syntax
 * (`<bucket>.<leafIndex>.<paramName>`, see `parseLeafPath` /
 * `applyParamOverrides`) so the result feeds `gridSearchFromJSON`
 * without translation.
 */

import type { Condition } from "../types";
import type { ConditionRegistry } from "./registry";
import { backtestRegistry } from "./registry-backtest";
import type { ParamDef, StrategyJSON } from "./types";
import { flattenStrategyLeaves } from "./walker";

/**
 * One tunable parameter discovered by walking a strategy's ConditionSpec.
 *
 * Numeric params only — `string` / `boolean` schema entries are filtered
 * out at enumeration time (they aren't tunable on a numeric grid).
 * Params marked `schema.tunable === false` are also skipped (used by the
 * registry to opt out of enumeration when `type: "number"` is declared
 * for compactness but the runtime value is non-scalar — e.g. MA period
 * vectors).
 *
 * The full registry `ParamDef` is attached as `schema` so callers can read
 * `schema.min` / `max` / `default` / `integer` / `precision` /
 * `suggestedMin` / `suggestedMax` directly. There is deliberately **no**
 * heuristic on top — the industry standard (TA-Lib's
 * `TA_OptInput_IntegerRange` vs `TA_OptInput_RealRange`, freqtrade's
 * `IntParameter` vs `DecimalParameter`, Pine Script's `input.int` vs
 * `input.float`) is to make integer / continuous typing explicit at the
 * schema level, not infer it.
 */
export type Tunable = {
  /** Canonical path: `<bucket>.<leafIndex>.<paramName>`. */
  key: string;
  bucket: "entry" | "exit";
  leafIndex: number;
  conditionName: string;
  paramName: string;
  /** Full registry `ParamDef`. Read `.min` / `.max` / `.integer` / etc. directly. */
  schema: ParamDef;
};

/**
 * Walk a strategy JSON's `entry` / `exit` and emit one `Tunable` per
 * numeric registry-declared parameter. Wrapper around
 * `flattenStrategyLeaves` that joins each leaf against `registry`.
 *
 * Conditions whose registry entry is missing or whose params are all
 * non-numeric are silently skipped, so a strategy with `alwaysTrue` /
 * `alwaysFalse` returns `[]`. For partially-registered strategies
 * (one valid + one unknown), only the valid leaves are surfaced —
 * `gridSearchFromJSON` will reject the unknown leaf upfront when
 * actually run.
 *
 * Defaults to `backtestRegistry` so the common case is parameter-less.
 * The function reads `entry.params` only (no `.create` / `.hydrate`),
 * so any `ConditionRegistry<T>` — including the bundled
 * `streamingRegistry` or a user-defined one — is acceptable.
 *
 * @example
 * ```ts
 * const tunables = listTunables(strategyJson);
 * for (const t of tunables) {
 *   console.log(t.key, t.paramName, t.schema.default);
 * }
 * ```
 */
export function listTunables<T = Condition>(
  strategy: StrategyJSON,
  registry: ConditionRegistry<T> = backtestRegistry as unknown as ConditionRegistry<T>,
): Tunable[] {
  const out: Tunable[] = [];
  for (const leaf of flattenStrategyLeaves(strategy)) {
    const entry = registry.get(leaf.name);
    if (!entry) continue;
    for (const [paramName, schema] of Object.entries(entry.params)) {
      if (schema.type !== "number") continue;
      // `tunable: false` is an explicit opt-out for params whose JSON
      // value is not a scalar number — registry entries that declare
      // `type: "number"` for compactness but actually consume the value
      // as an array (e.g. Perfect Order MA periods). These would not
      // survive a scalar grid sweep.
      if (schema.tunable === false) continue;
      out.push({
        key: `${leaf.bucket}.${leaf.leafIndex}.${paramName}`,
        bucket: leaf.bucket,
        leafIndex: leaf.leafIndex,
        conditionName: leaf.name,
        paramName,
        schema,
      });
    }
  }
  return out;
}
