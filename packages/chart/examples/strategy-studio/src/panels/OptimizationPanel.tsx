import { useEffect, useMemo, useState } from "react";
import type { ParameterRange, StrategyJSON } from "trendcraft";
import { NumInput } from "../components/NumInput";
import {
  autoDeriveRange,
  combinationCount,
  findIntegerRangeViolation,
  listTunables,
  OPTIMIZATION_METRICS,
  type OptimizationComputation,
  type OptimizationMetricUI,
  runGridSearch,
  runWalkForward,
  type Tunable,
  type WalkForwardComputation,
} from "../lib/optimization";
import type { StudioCandle } from "../lib/sample-data";

const MAX_COMBINATIONS = 10_000;
const WF_DEFAULT_OOS_PERCENT = 20;
const WF_DEFAULT_WINDOWS = 4;

type Props = {
  /** Last-run strategy JSON (PR10 single source of truth). */
  strategy: StrategyJSON | undefined;
  /** Playhead-aware candle slice. */
  candles: StudioCandle[];
  /** True while Replay is actively playing — disables Run button. */
  isReplayPlaying: boolean;
  /**
   * Optional notifier for the latest optimization result. Lets sibling
   * panels (e.g. StrategyDnaPanel) consume the same result without
   * duplicating the run trigger. Result state stays panel-local; this
   * is fire-and-forget broadcast on every change.
   */
  onResult?: (result: OptimizationComputation) => void;
  /**
   * Optional notifier for the latest walk-forward result. Same
   * fire-and-forget contract as `onResult` — StrategyDnaPanel consumes
   * it to feed `computeDnaGrade` and render the per-window report
   * without owning the run trigger.
   */
  onWalkForwardResult?: (result: WalkForwardComputation) => void;
};

type RangeMap = Record<string, { min: number; max: number; step: number }>;

function initRanges(tunables: Tunable[]): RangeMap {
  const out: RangeMap = {};
  for (const t of tunables) {
    const r = autoDeriveRange(t.currentValue, t.registryMin, t.isInteger, t.schema);
    out[t.key] = { min: r.min, max: r.max, step: r.step };
  }
  return out;
}

export function OptimizationPanel({
  strategy,
  candles,
  isReplayPlaying,
  onResult,
  onWalkForwardResult,
}: Props) {
  const tunables = useMemo<Tunable[]>(() => (strategy ? listTunables(strategy) : []), [strategy]);

  const [ranges, setRanges] = useState<RangeMap>(() => initRanges(tunables));
  const [metric, setMetric] = useState<OptimizationMetricUI>("returns");
  const [result, setResult] = useState<OptimizationComputation>({ kind: "idle" });

  // Walk-forward dials. The two user-facing knobs (out-of-sample % and
  // window count) derive core's window/step/test sizes in `runWalkForward`.
  const [wfOosPercent, setWfOosPercent] = useState<number>(WF_DEFAULT_OOS_PERCENT);
  const [wfWindows, setWfWindows] = useState<number>(WF_DEFAULT_WINDOWS);
  const [wfResult, setWfResult] = useState<WalkForwardComputation>({ kind: "idle" });

  // Broadcast every result change so sibling panels (StrategyDnaPanel
  // mounted in App) consume the same data without duplicating the
  // run trigger. We fire on every change including idle so consumers
  // see the empty/error state too and can clear their derived UI.
  // biome-ignore lint/correctness/useExhaustiveDependencies: onResult is a stable callback in practice; we don't want re-broadcasts when its identity changes.
  useEffect(() => {
    onResult?.(result);
  }, [result]);

  // Same broadcast contract for the walk-forward result.
  // biome-ignore lint/correctness/useExhaustiveDependencies: onWalkForwardResult is stable in practice; broadcast only when the result itself changes.
  useEffect(() => {
    onWalkForwardResult?.(wfResult);
  }, [wfResult]);

  // Anything that changes how `runGridSearch` would evaluate the strategy
  // must invalidate the panel state. Stringify the full entry/exit specs
  // (so `and` → `or` or wrapping in `not` flips the key even when leaves
  // are identical) plus the backtest settings (stops/fees/fillMode change
  // the search space). id is included for free.
  const strategyKey = strategy
    ? JSON.stringify({
        id: strategy.id,
        entry: strategy.entry,
        exit: strategy.exit,
        backtest: strategy.backtest ?? null,
      })
    : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: strategyKey hashes the relevant strategy shape; raw `strategy` reference shifts on every Run.
  useEffect(() => {
    setRanges(initRanges(tunables));
    setResult({ kind: "idle" });
    setWfResult({ kind: "idle" });
  }, [strategyKey]);

  // Any slice change → the prior optimisation was computed against different
  // candles. Drop *any* non-idle result (ok / empty / error all get cleared)
  // and key on the first/last bar's time + length so a same-length slice
  // from a different range still invalidates.
  const slicedKey =
    candles.length === 0
      ? "0"
      : `${candles.length}-${candles[0].time}-${candles[candles.length - 1].time}`;
  // Same idea for range edits: once the user changes any min/max/step the
  // displayed top-10 is from a different search space. Hash the entire
  // ranges map so any field bump invalidates.
  const rangesKey = useMemo(() => JSON.stringify(ranges), [ranges]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keys are content hashes; we don't want to depend on the `candles` reference or the `ranges` object identity.
  useEffect(() => {
    setResult((prev) => (prev.kind === "idle" ? prev : { kind: "idle" }));
    setWfResult((prev) => (prev.kind === "idle" ? prev : { kind: "idle" }));
  }, [slicedKey, rangesKey]);

  const rangeArray = useMemo<ParameterRange[]>(
    () =>
      tunables.map((t) => {
        // Fallback range used only on the first render before initRanges
        // commits. registryMin can legitimately be NEGATIVE_INFINITY (CMF
        // threshold etc.) so we anchor on the current value's magnitude
        // instead of the sentinel.
        const fallback = autoDeriveRange(t.currentValue, t.registryMin, t.isInteger, t.schema);
        const r = ranges[t.key] ?? { min: fallback.min, max: fallback.max, step: fallback.step };
        return { name: t.key, min: r.min, max: r.max, step: r.step };
      }),
    [tunables, ranges],
  );

  const totalCombinations = useMemo(
    () => (rangeArray.length === 0 ? 0 : combinationCount(rangeArray)),
    [rangeArray],
  );

  const invalidRanges = totalCombinations < 0;
  const tooManyCombinations = totalCombinations > MAX_COMBINATIONS;
  // schema.integer params reject fractional min/max/step inside
  // gridSearchFromJSON. Catch the violation at edit time so the user
  // sees an actionable inline warning before clicking Run, not a
  // generic "press-then-error" surprise.
  const integerViolation = useMemo(
    () => findIntegerRangeViolation(tunables, rangeArray),
    [tunables, rangeArray],
  );
  const runDisabled =
    !strategy ||
    tunables.length === 0 ||
    invalidRanges ||
    tooManyCombinations ||
    integerViolation !== null ||
    isReplayPlaying ||
    candles.length < 20;

  const handleRun = () => {
    if (!strategy || runDisabled) return;
    setResult(runGridSearch(candles, strategy, rangeArray, metric));
  };

  // Editing the walk-forward dials changes the window sizing, so any
  // displayed result is from a different analysis. Drop it (idle→idle is
  // a no-op so we don't re-broadcast on every keystroke) the same way the
  // metric/range edits invalidate the grid result above.
  const clearWalkForward = () =>
    setWfResult((prev) => (prev.kind === "idle" ? prev : { kind: "idle" }));

  const handleRunWalkForward = () => {
    if (!strategy || runDisabled) return;
    setWfResult(
      runWalkForward(candles, strategy, rangeArray, {
        oosPercent: wfOosPercent,
        windows: wfWindows,
        metric,
      }),
    );
  };

  if (!strategy) {
    return (
      <div className="risk-panel">
        <div className="pane-header">Optimization</div>
        <section className="risk-section">
          <div className="meta-strategy-caption">Run a backtest to enable optimization.</div>
        </section>
      </div>
    );
  }

  if (tunables.length === 0) {
    return (
      <div className="risk-panel">
        <div className="pane-header">Optimization</div>
        <section className="risk-section">
          <div className="meta-strategy-caption">
            Strategy has no tunable parameters (alwaysTrue / alwaysFalse only).
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="risk-panel">
      <div className="pane-header">Optimization</div>
      <section className="risk-section">
        <div className="optimization-header">
          <label className="optimization-metric-label">
            <span>Metric</span>
            <select
              value={metric}
              onChange={(e) => {
                // Drop any prior result — its ranking is by the *old* metric
                // and would be misread as if recomputed for the new one.
                setMetric(e.target.value as OptimizationMetricUI);
                setResult({ kind: "idle" });
                setWfResult({ kind: "idle" });
              }}
            >
              {OPTIMIZATION_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <span
            className={`optimization-combos${tooManyCombinations || invalidRanges ? " optimization-combos-warn" : ""}`}
          >
            {invalidRanges ? "invalid range" : `${totalCombinations.toLocaleString()} combos`}
          </span>
        </div>

        <div className="optimization-param-list">
          {tunables.map((t) => {
            const r = ranges[t.key];
            if (!r) return null;
            return (
              <div className="optimization-param-row" key={t.key}>
                <span className="optimization-param-name">
                  {t.bucket}.{t.conditionName}.{t.paramName}
                </span>
                {/* Inputs always accept fractional values — the registry
                    doesn't reliably mark integer-only params, and other
                    Studio panels treat these threshold params as floats.
                    `t.isInteger` only seeds the auto-derived step so
                    period-style params start at integer cadence. */}
                <NumInput
                  label="min"
                  value={r.min}
                  min={Number.isFinite(t.registryMin) ? t.registryMin : undefined}
                  step="any"
                  onChange={(v) => setRanges((prev) => ({ ...prev, [t.key]: { ...r, min: v } }))}
                />
                <NumInput
                  label="max"
                  value={r.max}
                  min={Number.isFinite(t.registryMin) ? t.registryMin : undefined}
                  step="any"
                  onChange={(v) => setRanges((prev) => ({ ...prev, [t.key]: { ...r, max: v } }))}
                />
                {/* Accept any value the user types, including a transient
                    `0` while they're working their way to `0.05`. Validation
                    happens upstream: `combinationCount` returns -1 for
                    `step <= 0` and the panel disables Run + shows
                    "invalid range" until the user finishes typing. */}
                <NumInput
                  label="step"
                  value={r.step}
                  step="any"
                  onChange={(v) => setRanges((prev) => ({ ...prev, [t.key]: { ...r, step: v } }))}
                />
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="optimization-run-btn"
          onClick={handleRun}
          disabled={runDisabled}
        >
          {isReplayPlaying ? "Run grid search (paused during replay)" : "Run grid search"}
        </button>

        {invalidRanges && (
          <div className="optimization-warning">
            One or more parameter ranges are invalid (min &gt; max, or step ≤ 0).
          </div>
        )}
        {tooManyCombinations && (
          <div className="optimization-warning">
            Too many combinations ({totalCombinations.toLocaleString()}). Reduce ranges or increase
            step (max {MAX_COMBINATIONS.toLocaleString()}).
          </div>
        )}
        {integerViolation && (
          <div className="optimization-warning">
            <strong>{integerViolation.paramName}</strong> requires integer values, but{" "}
            {integerViolation.field}={integerViolation.value} is not an integer.
          </div>
        )}

        <ResultBody result={result} tunables={tunables} />

        <div className="pane-divider" style={{ margin: "10px 0 8px" }} />

        <div className="optimization-header">
          <span className="optimization-metric-label" style={{ fontWeight: 600 }}>
            Walk-Forward
          </span>
          <span className="meta-strategy-caption">out-of-sample stability</span>
        </div>
        <div className="optimization-header" style={{ gap: 10 }}>
          <NumInput
            label="OOS %"
            value={wfOosPercent}
            min={5}
            max={50}
            step={1}
            integer
            onChange={(v) => {
              setWfOosPercent(v);
              clearWalkForward();
            }}
          />
          <NumInput
            label="Windows"
            value={wfWindows}
            min={2}
            max={12}
            step={1}
            integer
            onChange={(v) => {
              setWfWindows(v);
              clearWalkForward();
            }}
          />
        </div>
        <button
          type="button"
          className="optimization-run-btn"
          onClick={handleRunWalkForward}
          disabled={runDisabled}
        >
          {isReplayPlaying ? "Run walk-forward (paused during replay)" : "Run walk-forward"}
        </button>
        <WalkForwardStatus result={wfResult} />
      </section>
    </div>
  );
}

/**
 * One-line walk-forward status shown inside the Optimization panel. The
 * full per-window report renders in StrategyDnaPanel's Robustness tab;
 * this is just enough to confirm the run landed and point the user there.
 */
function WalkForwardStatus({ result }: { result: WalkForwardComputation }) {
  if (result.kind === "idle") return null;
  if (result.kind === "empty") {
    return <div className="meta-strategy-caption">{result.message}</div>;
  }
  if (result.kind === "error") {
    return <div className="risk-error">{result.message}</div>;
  }
  return (
    <div className="meta-strategy-caption">
      {result.windows} window(s) analyzed at {result.oosPercent}% OOS — see Strategy DNA →
      Robustness for the breakdown.
    </div>
  );
}

function ResultBody({
  result,
  tunables,
}: {
  result: OptimizationComputation;
  tunables: Tunable[];
}) {
  if (result.kind === "idle") {
    return null;
  }
  if (result.kind === "empty") {
    return <div className="meta-strategy-caption">{result.message}</div>;
  }
  if (result.kind === "error") {
    return <div className="risk-error">{result.message}</div>;
  }
  const top = result.result.results.slice(0, 10);
  return (
    <>
      <div className="meta-strategy-caption">
        {result.result.validCombinations} of {result.result.totalCombinations} combos passed
        constraints · best {result.metric}:{" "}
        {result.result.bestScore !== null ? result.result.bestScore.toFixed(2) : "—"}
      </div>
      <div className="optimization-result-scroll">
        <table className="optimization-result-table">
          <thead>
            <tr>
              <th>#</th>
              {tunables.map((t) => (
                // Prefix the bucket so a strategy with the same param name on
                // both legs (goldenCross.shortPeriod / deadCross.shortPeriod)
                // doesn't collapse to two indistinguishable columns.
                <th key={t.key} className="num">
                  {t.bucket === "entry" ? "in" : "out"}.{t.paramName}
                </th>
              ))}
              <th className="num">Score</th>
              <th className="num">Trades</th>
            </tr>
          </thead>
          <tbody>
            {top.map((entry, i) => (
              <tr key={`${i}-${entry.score}`} className={i === 0 ? "optimization-best" : undefined}>
                <td>{i + 1}</td>
                {tunables.map((t) => (
                  <td key={t.key} className="num">
                    {entry.params[t.key] ?? "—"}
                  </td>
                ))}
                <td className="num">{entry.score.toFixed(2)}</td>
                <td className="num">{entry.backtest.trades.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
