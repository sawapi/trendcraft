import {
  backtestRegistry,
  type Tunable as CoreTunable,
  calculatePeriodCount,
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
  type WalkForwardResult,
  walkForwardAnalysisFromJSON,
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
 * Cross-parameter constraints (e.g. `goldenCross` requiring
 * `shortPeriod < longPeriod`) are no longer filtered here: core's
 * `gridSearchFromJSON` builds a `paramFilter` from each condition's
 * registered `validateParams`, so structurally-invalid combos never
 * appear in `result.results` in the first place.
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
    // Studio UX: zero-trade backtests score 0 across every metric, so
    // they'd otherwise tie at the top of a Sharpe / returns ranking
    // when nothing actually traded. Drop them and rebuild the summary
    // fields from the surviving rows. If everything was zero-trade,
    // surface an empty-state instead of a misleading "best 0.00".
    // (Structurally-invalid combos are already excluded upstream by
    // core's `validateParams`-derived `paramFilter`.)
    const usableResults = result.results.filter((r) => r.backtest.trades.length > 0);
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
 * The (windowSize, testSize, stepSize) triple core's walk-forward engine
 * actually consumes, derived from the two dials the panel exposes.
 */
export type WalkForwardSizing = {
  /** Training (in-sample) window length in candles. */
  windowSize: number;
  /** Test (out-of-sample) window length in candles. */
  testSize: number;
  /** Advance between successive windows. Equals `testSize` here so the
   * out-of-sample slices tile the data without gaps or overlap. */
  stepSize: number;
};

/**
 * Derive core's `(windowSize, testSize, stepSize)` from the two
 * user-facing dials the panel exposes: out-of-sample fraction and the
 * desired number of walk-forward windows.
 *
 * Uses non-overlapping out-of-sample windows (`stepSize === testSize`) —
 * the standard "rolling" walk-forward layout where each period's test
 * slice picks up exactly where the previous one ended, so the stitched
 * out-of-sample series has no gaps or double-counting. Under that layout
 * the engine yields `floor((N − windowSize − testSize) / testSize) + 1`
 * periods, so solving `windowSize + windows·testSize = N` together with
 * `windowSize / testSize = (1 − oosFrac) / oosFrac` lands on `windows`
 * periods (±1 once the sizes are rounded to whole candles).
 *
 * `oosPercent` is clamped to `[5, 90]` and `windows` to `≥ 1` so a
 * mistyped dial can't produce a zero/negative window. Callers should
 * still check `calculatePeriodCount` against the result before running —
 * a short slice can leave room for fewer windows than requested.
 */
export function deriveWalkForwardSizing(
  totalCandles: number,
  oosPercent: number,
  windows: number,
): WalkForwardSizing {
  const oosFrac = Math.min(0.9, Math.max(0.05, oosPercent / 100));
  const trainPerTest = (1 - oosFrac) / oosFrac;
  const w = Math.max(1, Math.floor(windows));
  const testSize = Math.max(1, Math.floor(totalCandles / (trainPerTest + w)));
  const windowSize = Math.max(1, Math.round(testSize * trainPerTest));
  return { windowSize, testSize, stepSize: testSize };
}

export type WalkForwardComputation =
  | { kind: "idle" }
  | { kind: "ok"; result: WalkForwardResult; windows: number; oosPercent: number }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

export type WalkForwardRunOptions = {
  /** Out-of-sample fraction per cycle, as a percent (e.g. `20`). */
  oosPercent: number;
  /** Requested number of walk-forward windows. */
  windows: number;
  /** Metric optimized within each training window. */
  metric: OptimizationMetricUI;
};

/**
 * Run rolling walk-forward analysis via core's
 * `walkForwardAnalysisFromJSON`, sharing the exact ranges the grid
 * search uses so the two views describe the same search space.
 *
 * Mirrors {@link runGridSearch}'s contract: user-recoverable conditions
 * (no tunables, no ranges, a slice too short to fit even one window)
 * short-circuit to `kind:"empty"` with an actionable message rather than
 * surfacing as errors. The window sizing is derived from the panel's
 * out-of-sample % and window-count dials by {@link deriveWalkForwardSizing};
 * because integer rounding can leave room for fewer periods than
 * requested, the resulting `windows` field reports the count core
 * actually produced, not the requested one.
 *
 * Pure: same `(candles, strategy, ranges, opts)` always produces the
 * same output. Replay-awareness lives one layer up (the panel disables
 * Run during playback).
 *
 * Cross-parameter constraints (e.g. `goldenCross` requiring
 * `shortPeriod < longPeriod`) are enforced by core: `walkForwardAnalysisFromJSON`
 * builds a `paramFilter` from each condition's registered `validateParams`,
 * so a structurally-invalid combo can't be chosen as any window's best
 * parameters (and a fully-invalid search space surfaces as an error rather
 * than a filtered-out fallback). The no-trade half of the grid filter is
 * mirrored here — a run where no window trades out-of-sample returns
 * `kind:"empty"` below.
 */
export function runWalkForward(
  candles: StudioCandle[],
  strategy: StrategyJSON,
  ranges: ParameterRange[],
  opts: WalkForwardRunOptions,
): WalkForwardComputation {
  const tunables = listTunables(strategy);
  if (tunables.length === 0) {
    return { kind: "empty", message: "Strategy has no tunable parameters" };
  }
  if (ranges.length === 0) {
    return { kind: "empty", message: "No parameter ranges configured" };
  }
  const sizing = deriveWalkForwardSizing(candles.length, opts.oosPercent, opts.windows);
  const periodCount = calculatePeriodCount(
    candles.length,
    sizing.windowSize,
    sizing.stepSize,
    sizing.testSize,
  );
  if (periodCount < 1) {
    return {
      kind: "empty",
      message: `Slice too short for ${opts.windows} window(s) at ${opts.oosPercent}% OOS (need ≥ ${sizing.windowSize + sizing.testSize} candles, have ${candles.length})`,
    };
  }
  try {
    const normalized = normalizeCandles(candles);
    const pathRanges: PathParameterRange[] = ranges.map((r) => ({
      path: r.name,
      min: r.min,
      max: r.max,
      step: r.step,
    }));
    const result = walkForwardAnalysisFromJSON(normalized, strategy, pathRanges, backtestRegistry, {
      windowSize: sizing.windowSize,
      stepSize: sizing.stepSize,
      testSize: sizing.testSize,
      metric: opts.metric,
    });
    // A window that never trades out-of-sample still yields finite-but-zero
    // metrics (returns/tradeCount = 0), so a run where *no* window traded
    // would otherwise report `kind:"ok"` and feed an all-zero stability
    // grade into Strategy DNA — the same misleading "best 0.00" that
    // `runGridSearch`'s no-trade filter guards against. Mirror that guard
    // at the run level: if zero windows produced an out-of-sample trade,
    // there's nothing to grade, so surface an empty-state. Partial
    // no-trade windows are kept — core's aggregate already counts a
    // non-trading window as unstable (`outOfSampleMetrics.returns > 0`)
    // and `wfeRatio` skips it, so removing periods here would only desync
    // the aggregate metrics the result already carries.
    const tradedPeriods = result.periods.filter((p) => p.testBacktest.trades.length > 0).length;
    if (tradedPeriods === 0) {
      return {
        kind: "empty",
        message: "Walk-forward produced no out-of-sample trades on any window",
      };
    }
    return { kind: "ok", result, windows: result.periods.length, oosPercent: opts.oosPercent };
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

export type { GridSearchResult, OptimizationMetric, ParameterRange, WalkForwardResult };
