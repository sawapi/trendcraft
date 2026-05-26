import {
  backtestRegistry,
  type Tunable as CoreTunable,
  listTunables as coreListTunables,
  flattenStrategyLeaves,
  type GridSearchResult,
  gridSearchFromJSON,
  normalizeCandles,
  type OptimizationMetric,
  type ParamDef,
  type ParameterRange,
  type PathParameterRange,
  type StrategyJSON,
} from "trendcraft";
import type { StudioCandle } from "./sample-data";

/**
 * One tunable parameter discovered by walking a strategy's ConditionSpec.
 * Wraps core's `Tunable` (`key` / `bucket` / `leafIndex` / `conditionName`
 * / `paramName` / `schema`) with the Studio-specific derived fields the
 * `OptimizationPanel` UI needs: the user's effective `currentValue`
 * (registry default merged with the strategy's saved overrides), the
 * `registryMin` cache, and an `isInteger` flag that falls back to a
 * heuristic when the registry entry pre-dates the `ParamDef.integer`
 * annotation.
 */
export type Tunable = CoreTunable & {
  currentValue: number;
  /**
   * Registry-declared minimum (`Number.NEGATIVE_INFINITY` when absent —
   * CMF threshold etc.). Studio never lets the search range fall below
   * this, so a CMF default 0 with no declared min still searches around
   * zero instead of degenerating to [0,0].
   */
  registryMin: number;
  /**
   * `true` when the param accepts only integer values. Source of truth:
   * `ParamDef.integer` when annotated; falls back to a heuristic
   * (`isInteger(default) && isInteger(min)`) for entries the registry
   * hasn't been annotated for yet.
   */
  isInteger: boolean;
};

/**
 * Walk a strategy JSON's `entry`/`exit` and pull out every numeric
 * tunable. Delegates to core's `listTunables` for the canonical
 * enumeration (path syntax, `tunable: false` opt-out, registry lookup)
 * and layers Studio-specific derived fields on top:
 *
 * - `currentValue`: the value `OptimizationPanel` shows centered in the
 *   range slider — registry default merged with the strategy's saved
 *   override from `leaf.params`. Core's `Tunable.schema.default` alone
 *   would miss the user's saved value.
 * - `isInteger`: falls back to a numeric heuristic for registry entries
 *   that haven't been annotated with `ParamDef.integer`. Core
 *   deliberately doesn't infer this (matches TA-Lib / freqtrade / Pine
 *   Script: integer vs float typing should be explicit at the schema
 *   level), but Studio still needs *some* answer for un-annotated
 *   entries so the range slider's step works.
 */
export function listTunables(strategy: StrategyJSON): Tunable[] {
  const leafParamsByPrefix = new Map<string, Record<string, unknown> | undefined>();
  for (const leaf of flattenStrategyLeaves(strategy)) {
    leafParamsByPrefix.set(`${leaf.bucket}.${leaf.leafIndex}`, leaf.params);
  }
  return coreListTunables(strategy).map((t): Tunable => {
    const schema = t.schema;
    const min = typeof schema.min === "number" ? schema.min : Number.NEGATIVE_INFINITY;
    const def =
      typeof schema.default === "number" ? schema.default : Number.isFinite(min) ? min : 0;
    const supplied = leafParamsByPrefix.get(`${t.bucket}.${t.leafIndex}`)?.[t.paramName];
    const currentValue = typeof supplied === "number" ? supplied : def;
    const isInteger =
      schema.integer ??
      ((min === Number.NEGATIVE_INFINITY || Number.isInteger(min)) && Number.isInteger(def));
    return {
      ...t,
      currentValue,
      registryMin: min,
      isInteger,
    };
  });
}

/**
 * Choose a sensible default range around the user's current parameter
 * value. Hybrid: prefers `ParamDef` annotations from PR-A1 when present
 * (`schema.integer` / `schema.precision` / `schema.suggestedMin/Max`)
 * and falls back to the original magnitude-based heuristic for entries
 * the registry hasn't been annotated for yet.
 *
 * - Integer params: range is integer-rounded; step is `(span / 10)`
 *   rounded up to ≥1.
 * - Float params: when `schema.precision` is set, step is
 *   `10 ** -precision` (e.g. `precision: 1` → step 0.1). Otherwise the
 *   step scales with the value's magnitude as a power-of-ten so
 *   `0.001`-scale params get `0.0001`-ish steps.
 * - `schema.suggestedMin/Max` clamp the auto-derived bounds (UI hints,
 *   not enforced by core's validator). The registry's hard `min` is
 *   always honoured.
 */
export function autoDeriveRange(
  currentValue: number,
  registryMin: number,
  isInteger = true,
  schema?: ParamDef,
): ParameterRange {
  const magnitudeSeed = Math.abs(currentValue) || 1;
  const half = magnitudeSeed * 0.5;
  // `suggestedMin` / `suggestedMax` are UI hints, not validation. They
  // narrow the auto-derived range only when the current value is
  // *inside* the hint window — otherwise the hint would clip away the
  // user's actual saved value (e.g. `threshold: -5` against
  // `suggestedMin: -1` would otherwise collapse to `[-1, -0.99]` and
  // the panel could not search around -5). registryMin (hard contract)
  // is always enforced regardless.
  const rawSuggestedMax =
    schema && typeof schema.suggestedMax === "number" ? schema.suggestedMax : undefined;
  const rawSuggestedMin =
    schema && typeof schema.suggestedMin === "number" ? schema.suggestedMin : undefined;
  const suggestedMax =
    rawSuggestedMax !== undefined && currentValue <= rawSuggestedMax ? rawSuggestedMax : undefined;
  const suggestedMin =
    rawSuggestedMin !== undefined && currentValue >= rawSuggestedMin ? rawSuggestedMin : undefined;
  const lowerFloor = (() => {
    if (suggestedMin !== undefined && registryMin !== Number.NEGATIVE_INFINITY) {
      return Math.max(registryMin, suggestedMin);
    }
    if (suggestedMin !== undefined) return suggestedMin;
    return registryMin;
  })();
  const respectMin = (v: number) =>
    lowerFloor === Number.NEGATIVE_INFINITY ? v : Math.max(lowerFloor, v);
  const respectMax = (v: number) => (suggestedMax !== undefined ? Math.min(suggestedMax, v) : v);

  if (isInteger) {
    const idealLower = respectMin(Math.floor(currentValue - half));
    const idealUpper = Math.max(idealLower + 1, Math.ceil(currentValue + half));
    const upper = respectMax(idealUpper);
    // When the suggestedMax clamp brings `upper` below the centered
    // lower (e.g. a saved `period: 500` with `suggestedMax: 200` —
    // legal because suggestedMax is only a hint), re-anchor `lower`
    // under `upper` so the result stays a valid range. registryMin
    // (hard contract) still wins over the clamp.
    const lowerCandidate = Math.min(idealLower, upper - 1);
    const lower =
      lowerFloor === Number.NEGATIVE_INFINITY
        ? lowerCandidate
        : Math.max(lowerFloor, lowerCandidate);
    const span = Math.max(1, upper - lower);
    const step = Math.max(1, Math.round(span / 10));
    return { name: "", min: lower, max: upper, step };
  }
  const lowerRaw = respectMin(currentValue - half);
  const upperRaw = Math.max(lowerRaw + Number.EPSILON, currentValue + half);
  const upper = respectMax(upperRaw);
  // Same re-anchor logic for floats: if suggestedMax clamped upper
  // below the centered lower, slide lower back to maintain `lower < upper`.
  const lowerCandidate = Math.min(lowerRaw, upper);
  const lower =
    lowerFloor === Number.NEGATIVE_INFINITY ? lowerCandidate : Math.max(lowerFloor, lowerCandidate);

  // Step granularity: annotated precision wins, otherwise scale with magnitude.
  let step: number;
  if (schema && typeof schema.precision === "number" && schema.precision > 0) {
    step = 10 ** -schema.precision;
  } else {
    const span = Math.max(upper - lower, Number.EPSILON);
    const targetStep = span / 10;
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(targetStep, Number.MIN_VALUE)));
    step = Math.max(magnitude, Number.EPSILON);
  }
  const round = (v: number) => Math.round(v / step) * step;
  let minRounded = respectMin(round(lower));
  // Cap the final max at `upper` so the `suggestedMax` clamp cannot be
  // exceeded by `minRounded + step` rounding (e.g. saved `stdDev: 20`
  // with `suggestedMax: 5` + `precision: 1` would otherwise yield
  // `5..5.1`).
  const maxRoundedRaw = Math.max(minRounded + step, round(upper));
  const maxRounded = Math.min(upper, maxRoundedRaw);
  // If the upper clamp collapses `min == max`, slide `min` down by
  // ~10 steps (clamped by registryMin) so optimization still has a
  // meaningful range to search instead of degenerating to a single
  // value. This keeps out-of-range saved strategies (current >
  // suggestedMax) usable in the panel without manual editing.
  if (minRounded >= maxRounded) {
    const slideTarget = round(maxRounded - 10 * step);
    minRounded =
      lowerFloor === Number.NEGATIVE_INFINITY ? slideTarget : Math.max(lowerFloor, slideTarget);
    if (minRounded >= maxRounded) {
      // registryMin is at or above suggestedMax — genuinely degenerate
      // search space, collapse to single-value rather than emit min > max.
      minRounded = maxRounded;
    }
  }
  return { name: "", min: minRounded, max: maxRounded, step };
}

export type OptimizationMetricUI = "returns" | "sharpe" | "profitFactor" | "winRate";

/**
 * Condition-specific parameter validators. Returns `true` when the params
 * make semantic sense for that condition. Used to drop nonsensical grid
 * cells (e.g. a `goldenCross` row with `shortPeriod=13, longPeriod=12`
 * which mathematically inverts the indicator's design) before the user
 * sees them as "best" in the top-10 table.
 *
 * Core's registry doesn't model cross-param constraints today
 * (`shortPeriod < longPeriod` would need a per-condition predicate), so
 * Studio enforces it at the UI layer. Conditions not listed are treated
 * as always valid.
 */
const CONDITION_PARAM_CONSTRAINTS: Record<string, (params: Record<string, number>) => boolean> = {
  goldenCross: (p) => p.shortPeriod < p.longPeriod,
  deadCross: (p) => p.shortPeriod < p.longPeriod,
  validatedGoldenCross: (p) => p.shortPeriod < p.longPeriod,
  validatedDeadCross: (p) => p.shortPeriod < p.longPeriod,
};

/**
 * Walk a result row's flat param map (`{ "entry.0.shortPeriod": 13,
 * "entry.0.longPeriod": 12, ... }`) and group by leaf path. Returns
 * `false` if any leaf's condition has a registered constraint that the
 * row violates. `leafBaseParams` supplies registry defaults + the
 * strategy's static values so a validator that needs a sibling param
 * the grid isn't varying (e.g. only `shortPeriod` is opened) still has
 * a value to compare against.
 */
function resultParamsAreValid(
  params: Record<string, number>,
  leafConditionByPrefix: Map<string, string>,
  leafBaseParams: Map<string, Record<string, number>>,
): boolean {
  const grouped = new Map<string, Record<string, number>>();
  for (const prefix of leafConditionByPrefix.keys()) {
    grouped.set(prefix, { ...(leafBaseParams.get(prefix) ?? {}) });
  }
  for (const [key, value] of Object.entries(params)) {
    const lastDot = key.lastIndexOf(".");
    if (lastDot <= 0) continue;
    const prefix = key.slice(0, lastDot);
    const paramName = key.slice(lastDot + 1);
    let bucket = grouped.get(prefix);
    if (!bucket) {
      bucket = {};
      grouped.set(prefix, bucket);
    }
    bucket[paramName] = value;
  }
  for (const [prefix, leafParams] of grouped) {
    const conditionName = leafConditionByPrefix.get(prefix);
    if (!conditionName) continue;
    const validator = CONDITION_PARAM_CONSTRAINTS[conditionName];
    if (!validator) continue;
    if (validator(leafParams)) continue;
    return false;
  }
  return true;
}

export const OPTIMIZATION_METRICS: ReadonlyArray<{ id: OptimizationMetricUI; label: string }> = [
  { id: "returns", label: "Return %" },
  { id: "sharpe", label: "Sharpe" },
  { id: "profitFactor", label: "Profit Factor" },
  { id: "winRate", label: "Win Rate" },
];

/**
 * Find the first range whose values violate `schema.integer === true`
 * for the addressed param. Used by the panel to disable Run + render
 * an inline warning before the user clicks, so the violation is caught
 * at edit time rather than after `gridSearchFromJSON` rejects it with
 * a generic-looking error. Returns `null` when every range is valid.
 *
 * The check is path-keyed: `range.name` must match a `Tunable.key`.
 * Ranges that don't address a tunable are ignored (they'll be flagged
 * by `gridSearchFromJSON` upfront in any case).
 */
export function findIntegerRangeViolation(
  tunables: Tunable[],
  ranges: ParameterRange[],
): { paramName: string; field: "min" | "max" | "step"; value: number } | null {
  const byKey = new Map(tunables.map((t) => [t.key, t]));
  for (const r of ranges) {
    const t = byKey.get(r.name);
    if (!t || t.schema.integer !== true) continue;
    for (const field of ["min", "max", "step"] as const) {
      const value = r[field];
      if (!Number.isInteger(value)) {
        return { paramName: t.paramName, field, value };
      }
    }
  }
  return null;
}

export type OptimizationComputation =
  | { kind: "idle" }
  | { kind: "ok"; result: GridSearchResult; metric: OptimizationMetricUI }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

/**
 * Run grid search via core's `gridSearchFromJSON` and apply Studio's
 * UX-level no-trade filter on top.
 *
 * The wrapper exists for two Studio-specific concerns that core
 * deliberately leaves to the caller:
 *
 * 1. **Empty-state handling.** Studio short-circuits with `kind:"empty"`
 *    when there are no tunables, no ranges, or the slice is too short.
 *    These are user-recoverable conditions, not errors.
 * 2. **No-trade filtering.** A backtest that emits zero trades scores 0
 *    on every metric, so zero-trade combos would otherwise tie at
 *    "score 0" and pollute the top-N table. Studio drops them and
 *    rebuilds `bestScore`/`bestParams`/`validCombinations` from what
 *    remains; if nothing remains, the panel renders an empty-state.
 *
 * Pure: same `(candles, strategy, ranges, metric)` always produces the
 * same output. Replay-aware behavior lives one layer up (the panel
 * disables the Run button while playback is running).
 */
export function runGridSearch(
  candles: StudioCandle[],
  strategy: StrategyJSON,
  ranges: ParameterRange[],
  metric: OptimizationMetricUI,
): OptimizationComputation {
  const tunables = listTunables(strategy);
  if (tunables.length === 0) {
    return { kind: "empty", message: "Strategy has no tunable parameters" };
  }
  if (ranges.length === 0) {
    return { kind: "empty", message: "No parameter ranges configured" };
  }
  if (candles.length < 20) {
    return { kind: "empty", message: "Slice too short to optimize" };
  }
  try {
    const normalized = normalizeCandles(candles);
    // `ParameterRange.name` is the path (set by the panel using
    // `Tunable.key`); convert to `PathParameterRange` shape.
    const pathRanges: PathParameterRange[] = ranges.map((r) => ({
      path: r.name,
      min: r.min,
      max: r.max,
      step: r.step,
    }));
    const result = gridSearchFromJSON(normalized, strategy, pathRanges, backtestRegistry, {
      metric: metric === "returns" ? "returns" : metric,
      keepAllResults: false,
    });
    // Build a `<bucket>.<leafIndex> → conditionName` map + the leaf's
    // resolved params (registry default merged with user-supplied) so
    // constraint validators can read params that the grid isn't varying
    // (e.g. a 1-D sweep of `shortPeriod` still needs `longPeriod` to
    // check the `short < long` invariant).
    const leafConditionByPrefix = new Map<string, string>();
    const leafBaseParams = new Map<string, Record<string, number>>();
    for (const leaf of flattenStrategyLeaves(strategy)) {
      const prefix = `${leaf.bucket}.${leaf.leafIndex}`;
      leafConditionByPrefix.set(prefix, leaf.name);
      const entry = backtestRegistry.get(leaf.name);
      const base: Record<string, number> = {};
      if (entry) {
        for (const [k, schema] of Object.entries(entry.params)) {
          if (schema.type === "number" && typeof schema.default === "number") {
            base[k] = schema.default;
          }
        }
      }
      if (leaf.params) {
        for (const [k, v] of Object.entries(leaf.params)) {
          if (typeof v === "number") base[k] = v;
        }
      }
      leafBaseParams.set(prefix, base);
    }
    // Studio UX: zero-trade backtests score 0 across every metric, so
    // they'd otherwise tie at the top of a Sharpe / returns ranking
    // when nothing actually traded. Drop them and rebuild the summary
    // fields from the surviving rows. If everything was zero-trade,
    // surface an empty-state instead of a misleading "best 0.00".
    //
    // Same dropping happens for combinations that violate a condition's
    // semantic constraint (e.g. `goldenCross` with `shortPeriod >=
    // longPeriod` — mathematically valid but the indicator's name
    // implies the opposite ordering, so presenting these as "best" is
    // misleading).
    const usableResults = result.results.filter((r) => {
      if (r.backtest.trades.length === 0) return false;
      return resultParamsAreValid(r.params, leafConditionByPrefix, leafBaseParams);
    });
    if (usableResults.length === 0) {
      return {
        kind: "empty",
        message: "No parameter combinations produced usable trades on this slice",
      };
    }
    const sorted = [...usableResults].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const filtered: GridSearchResult = {
      ...result,
      results: sorted,
      bestParams: best.params,
      bestScore: best.score,
      validCombinations: usableResults.length,
    };
    return { kind: "ok", result: filtered, metric };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Combination count, defensively. core's `countCombinations` enumerates
 * each range via `getParameterValues` — fine for the cap check inside
 * `gridSearch`, but the panel calls this on every keystroke and a wide
 * range with a small decimal step (e.g. `0.001`) builds millions of
 * entries before the `> 10_000` guard fires, freezing the UI.
 *
 * Studio computes it with math only (`floor((max - min) / step) + 1`
 * per range, multiplicative across ranges) and short-circuits at the
 * first range that already pushes the total over
 * `Number.MAX_SAFE_INTEGER`. Invalid ranges (`max < min`, `step <= 0`)
 * return `-1` so the panel can render a validation message instead of
 * unmounting on render.
 *
 * **TODO**: when core ships `countCombinationsFast` (planned PR-A1.5,
 * see memo `project_count_combinations_fast.md`), swap this for a
 * single-line re-export.
 */
export function combinationCount(ranges: ParameterRange[]): number {
  if (ranges.length === 0) return 0;
  let total = 1;
  for (const r of ranges) {
    if (r.step <= 0 || r.max < r.min) return -1;
    // Mirror core `getParameterValues`: it walks `min += step` while
    // `value <= max + epsilon`, so e.g. `0..0.3 step 0.1` produces
    // [0, 0.1, 0.2, 0.3] = 4 values, not 3 like a naive
    // `floor((max-min)/step)+1` would say (floating point makes
    // 0.3/0.1 = 2.9999...). Use the same epsilon convention so the
    // panel's count agrees with what gridSearch will actually evaluate.
    const epsilon = Math.abs(r.step) / 1_000_000;
    const count = Math.floor((r.max - r.min + epsilon) / r.step) + 1;
    if (count <= 0) return -1;
    total *= count;
    if (total > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  }
  return total;
}

export type { GridSearchResult, OptimizationMetric, ParameterRange };
