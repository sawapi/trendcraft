import {
  type ConditionSpec,
  type GridSearchResult,
  type OptimizationMetric,
  type ParameterRange,
  type StrategyJSON,
  backtestRegistry,
  gridSearch,
  hydrateCondition,
  normalizeCandles,
} from "trendcraft";
import type { StudioCandle } from "./sample-data";

/**
 * One tunable parameter discovered by walking a strategy's ConditionSpec.
 * `key` is the panel-stable identifier ("entry-0.shortPeriod"), used both
 * as the React key for input rows and as the lookup key when injecting
 * grid-search params back into the strategy at evaluation time.
 */
export type Tunable = {
  key: string;
  /** Which side this leaf came from — "entry" or "exit". */
  bucket: "entry" | "exit";
  /** Index of the leaf within entry/exit (top-level AND-of-leaves only). */
  leafIndex: number;
  /** Registered condition name, e.g. "goldenCross". */
  conditionName: string;
  /** Param name within the condition, e.g. "shortPeriod". */
  paramName: string;
  /** Current value taken from the strategy JSON, falling back to registry default. */
  currentValue: number;
  /** Registry-declared minimum (>= 1 for periods, etc.). */
  registryMin: number;
  /**
   * Hint that the param "looks integer-valued" based on the registry's
   * default and min — used only to seed the auto-derived range's step.
   * Inputs are always allowed to be fractional regardless: the registry
   * doesn't carry an explicit integer/float marker, so any heuristic here
   * is fragile (RSI thresholds with `default: 20, min: 0` look integer-ish
   * but real users want `19.5`). Rest of Studio accepts fractional values
   * for these params; the panel must too.
   */
  isInteger: boolean;
};

/**
 * Walk a strategy JSON's `entry` and `exit` and pull out every tunable
 * numeric parameter. AND-of-leaves only (matches the Studio builder's UI
 * model). Conditions whose registry entry has zero `params` (e.g.
 * `alwaysTrue`) are silently skipped.
 */
export function extractTunableParams(strategy: StrategyJSON): Tunable[] {
  const out: Tunable[] = [];
  for (const bucket of ["entry", "exit"] as const) {
    const spec = strategy[bucket];
    const leaves = flattenLeaves(spec);
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const entry = backtestRegistry.get(leaf.name);
      if (!entry) continue;
      for (const [paramName, schema] of Object.entries(entry.params)) {
        if (schema.type !== "number") continue;
        // `min` may legitimately be 0 or negative (CMF threshold etc.) or
        // omitted entirely. Negative-infinity-equivalent (`Number.NEGATIVE_INFINITY`)
        // means "no lower bound" so the auto-derived range can include the
        // current value even when it's 0 or negative.
        const min = typeof schema.min === "number" ? schema.min : Number.NEGATIVE_INFINITY;
        const def =
          typeof schema.default === "number" ? schema.default : Number.isFinite(min) ? min : 0;
        const supplied = leaf.params?.[paramName];
        const currentValue = typeof supplied === "number" ? supplied : def;
        const isInteger =
          (min === Number.NEGATIVE_INFINITY || Number.isInteger(min)) && Number.isInteger(def);
        out.push({
          key: `${bucket}-${i}.${paramName}`,
          bucket,
          leafIndex: i,
          conditionName: leaf.name,
          paramName,
          currentValue,
          registryMin: min,
          isInteger,
        });
      }
    }
  }
  return out;
}

/**
 * Studio's builder UI only models AND-of-leaves. Anything more complex
 * (OR / NOT) is collapsed to its leaves with no logical meaning preserved
 * — fine for parameter discovery, since the leaves still drive backtest
 * indicators.
 */
function flattenLeaves(
  spec: ConditionSpec,
): Array<{ name: string; params?: Record<string, unknown> }> {
  if ("name" in spec) return [{ name: spec.name, params: spec.params }];
  return spec.conditions.flatMap(flattenLeaves);
}

/**
 * Choose a sensible default range around the user's current parameter
 * value. Centres on `currentValue`, expanded by ±half the value's
 * magnitude, targeting ~10 grid buckets. Step granularity scales with
 * the magnitude so `0.001`-scale tolerances stay reachable. The registry
 * minimum is always honoured (may be `Number.NEGATIVE_INFINITY` for
 * params with no declared lower bound — CMF threshold etc.).
 */
export function autoDeriveRange(
  currentValue: number,
  registryMin: number,
  isInteger = true,
): ParameterRange {
  // `span` is the half-width of the search range. Use the absolute value's
  // magnitude so threshold=0 and threshold=-50 both expand to a visible
  // range instead of degenerating to [0, 0].
  const magnitudeSeed = Math.abs(currentValue) || 1;
  const half = magnitudeSeed * 0.5;
  const respectMin = (v: number) =>
    registryMin === Number.NEGATIVE_INFINITY ? v : Math.max(registryMin, v);

  if (isInteger) {
    const lower = respectMin(Math.floor(currentValue - half));
    const upper = Math.max(lower + 1, Math.ceil(currentValue + half));
    const step = Math.max(1, Math.round((upper - lower) / 10));
    return { name: "", min: lower, max: upper, step };
  }
  const lower = respectMin(currentValue - half);
  const upper = Math.max(lower + Number.EPSILON, currentValue + half);
  const span = upper - lower;
  const targetStep = span / 10;
  // Power-of-ten grid keeps the visible numbers clean and scales with the
  // value's magnitude so `0.001`-scale params get `0.0001`-ish steps.
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(targetStep, Number.MIN_VALUE)));
  const step = Math.max(magnitude, Number.EPSILON);
  const round = (v: number) => Math.round(v / magnitude) * magnitude;
  const minRounded = respectMin(round(lower));
  const maxRounded = Math.max(minRounded + step, round(upper));
  return { name: "", min: minRounded, max: maxRounded, step };
}

export type OptimizationMetricUI = "returns" | "sharpe" | "profitFactor" | "winRate";

export const OPTIMIZATION_METRICS: ReadonlyArray<{ id: OptimizationMetricUI; label: string }> = [
  { id: "returns", label: "Return %" },
  { id: "sharpe", label: "Sharpe" },
  { id: "profitFactor", label: "Profit Factor" },
  { id: "winRate", label: "Win Rate" },
];

export type OptimizationComputation =
  | { kind: "idle" }
  | { kind: "ok"; result: GridSearchResult; metric: OptimizationMetricUI }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

/** Inject grid-search params into a strategy JSON's leaves at runtime. */
function buildFactoryStrategy(
  base: StrategyJSON,
  tunables: Tunable[],
  params: Record<string, number>,
): { entry: ConditionSpec; exit: ConditionSpec } {
  const tunableByKey = new Map(tunables.map((t) => [t.key, t]));
  const apply = (spec: ConditionSpec, bucket: "entry" | "exit", index: number): ConditionSpec => {
    if ("name" in spec) {
      const updated: Record<string, unknown> = { ...(spec.params ?? {}) };
      for (const [paramName, value] of Object.entries(spec.params ?? {})) {
        updated[paramName] = value;
      }
      // Override only the params present in `params` and addressed at this leaf.
      for (const t of tunables) {
        if (t.bucket === bucket && t.leafIndex === index) {
          const v = params[t.key];
          if (v !== undefined) updated[t.paramName] = v;
        }
      }
      // Also fill in defaults for any tunable that didn't have an existing value.
      for (const t of tunables) {
        if (t.bucket === bucket && t.leafIndex === index && updated[t.paramName] === undefined) {
          updated[t.paramName] = tunableByKey.get(t.key)?.currentValue;
        }
      }
      return { name: spec.name, params: updated };
    }
    // For combined specs we map each child positionally; flattenLeaves uses
    // the same depth-first order so leaf indices align.
    let leafCount = 0;
    const newConditions: ConditionSpec[] = [];
    for (const child of spec.conditions) {
      const childLeaves = flattenLeaves(child).length;
      newConditions.push(apply(child, bucket, index + leafCount));
      leafCount += childLeaves;
    }
    return { op: spec.op, conditions: newConditions };
  };
  return {
    entry: apply(base.entry, "entry", 0),
    exit: apply(base.exit, "exit", 0),
  };
}

/**
 * Run gridSearch over the user-supplied parameter ranges. The strategy
 * JSON is the source of truth for shape (entry/exit conditions); the
 * factory only swaps numeric values keyed by the tunable's `key`.
 *
 * Pure: same `(candles, strategy, ranges, metric)` always produces the
 * same output. Replay-aware behavior lives one layer up (panel disables
 * the Run button while playback is running).
 */
export function runGridSearch(
  candles: StudioCandle[],
  strategy: StrategyJSON,
  ranges: ParameterRange[],
  metric: OptimizationMetricUI,
): OptimizationComputation {
  const tunables = extractTunableParams(strategy);
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
    // Forward the *full* strategy.backtest config — silently dropping
    // direction / stops / fees / fillMode would optimise against assumptions
    // that don't match the user's solo backtest, so the "best" params would
    // disagree with what the user gets re-running the strategy. capital
    // defaults if missing; everything else is passthrough.
    const baseOptions = {
      capital: 100_000,
      ...(strategy.backtest ?? {}),
    };
    const result = gridSearch(
      normalized,
      (params) => {
        const { entry, exit } = buildFactoryStrategy(strategy, tunables, params);
        return {
          entry: hydrateCondition(entry, backtestRegistry),
          exit: hydrateCondition(exit, backtestRegistry),
          options: baseOptions,
        };
      },
      ranges,
      { metric: metric === "returns" ? "returns" : metric, keepAllResults: false },
    );
    // `validCombinations` only reflects constraint passes — with no
    // constraints (our default) every combo "passes" even when the backtest
    // emits zero trades. Worse, a no-trade backtest scores 0 on every
    // metric, so zero-trade entries can rank above real losing configs in
    // the top-N table. Filter them out entirely and rebuild the summary
    // fields (bestScore/bestParams/validCombinations) so they reference
    // a row that's actually still in the table — otherwise the caption can
    // claim "best 0.00" while the displayed top-N has no such row.
    const tradingResults = result.results.filter((r) => r.backtest.trades.length > 0);
    if (tradingResults.length === 0) {
      return {
        kind: "empty",
        message: "No parameter combinations produced any trades on this slice",
      };
    }
    const sorted = [...tradingResults].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const filtered = {
      ...result,
      results: sorted,
      bestParams: best.params,
      bestScore: best.score,
      validCombinations: tradingResults.length,
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
 * We compute it with math only (`floor((max - min) / step) + 1` per
 * range, multiplicative across ranges) and short-circuit at the first
 * range that already pushes the total over `Number.MAX_SAFE_INTEGER` —
 * that's "too many" by any practical definition. Invalid ranges
 * (`max < min`, `step <= 0`) return `-1` so the panel can render a
 * validation message instead of unmounting on render.
 */
export function combinationCount(ranges: ParameterRange[]): number {
  if (ranges.length === 0) return 0;
  let total = 1;
  for (const r of ranges) {
    if (r.step <= 0 || r.max < r.min) return -1;
    // Mirror core `getParameterValues`: it walks `min += step` while
    // `value <= max + epsilon`, so e.g. `0..0.3 step 0.1` produces
    // [0, 0.1, 0.2, 0.3] = 4 values, not 3 like a naive `floor((max-min)/step)+1`
    // would say (floating point makes 0.3/0.1 = 2.9999...). Use the same
    // epsilon convention so the panel's count agrees with what gridSearch
    // will actually evaluate.
    const epsilon = Math.abs(r.step) / 1_000_000;
    const count = Math.floor((r.max - r.min + epsilon) / r.step) + 1;
    if (count <= 0) return -1;
    total *= count;
    if (total > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  }
  return total;
}

export type { ParameterRange, OptimizationMetric, GridSearchResult };
