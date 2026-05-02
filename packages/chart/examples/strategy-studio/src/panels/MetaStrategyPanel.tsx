import { useEffect, useMemo, useState } from "react";
import type { BacktestResult, EquityCurveFilterType, StrategyPerformanceMetric } from "trendcraft";
import { NumInput } from "../components/NumInput";
import { DEMO_STRATEGIES } from "../lib/demo-strategies";
import {
  type AllocationMethod,
  DEFAULT_FILTER_INPUTS,
  DEFAULT_ROTATION_INPUTS,
  type DemoBacktest,
  type FilterInputs,
  type RotationInputs,
  type RotationSlot,
  buildRotation,
  computeFilter,
  overridesFromResult,
  runDemoBacktests,
} from "../lib/meta-strategy";
import type { StudioCandle } from "../lib/sample-data";

type Props = {
  /** User's most recent backtest result (Slot 1 source when present). */
  lastResult: BacktestResult | undefined;
  /** Playhead-aware candle slice; same source the StrategyBuilder runs on. */
  candles: StudioCandle[];
  /** True while Replay is actively playing — used to freeze rotation work. */
  isReplayPlaying: boolean;
};

const FILTER_TYPES: ReadonlyArray<{ id: EquityCurveFilterType; label: string }> = [
  { id: "ma", label: "MA" },
  { id: "drawdown", label: "Drawdown" },
  { id: "winRate", label: "Win Rate" },
  { id: "combined", label: "Combined" },
];

const ROTATION_METRICS: ReadonlyArray<{ id: StrategyPerformanceMetric; label: string }> = [
  { id: "returnPercent", label: "Return" },
  { id: "sharpeRatio", label: "Sharpe" },
  { id: "profitFactor", label: "PF" },
  { id: "winRate", label: "Win %" },
];

const ALLOCATIONS: ReadonlyArray<{ id: AllocationMethod; label: string }> = [
  { id: "proportional", label: "Proportional" },
  { id: "equal", label: "Equal" },
  { id: "topN", label: "Top N" },
];

export function MetaStrategyPanel({ lastResult, candles, isReplayPlaying }: Props) {
  const [filter, setFilter] = useState<FilterInputs>(DEFAULT_FILTER_INPUTS);
  const [rotation, setRotation] = useState<RotationInputs>(DEFAULT_ROTATION_INPUTS);

  const filterResult = useMemo(() => computeFilter(lastResult, filter), [lastResult, filter]);

  // Demo backtests are heavy (3 backtests over up to 1000 bars). The freeze-
  // during-playback gate keeps Max-speed Replay (~125 ticks/sec) responsive;
  // the user gets fresh results the moment they pause/step/exit. We keep the
  // results in `useState` (not `useRef`) so the recompute is committed via
  // `setState` — writing to a ref inside `useMemo` would be StrictMode-unsafe
  // (memos can run, get discarded, and re-run during concurrent rendering).
  const candlesKey = candles.length;
  // Use the user's actual backtest assumptions (stops, fill mode, commission,
  // etc.) for the demos too — otherwise the rotation ranking measures the
  // settings difference, not the strategy edge. When the user hasn't run yet
  // the demos use their own JSON defaults, which is fine because there's no
  // user strategy to compare against.
  const overridesKey = lastResult
    ? `${lastResult.initialCapital}|${lastResult.settings.stopLoss ?? ""}|${lastResult.settings.takeProfit ?? ""}|${lastResult.settings.trailingStop ?? ""}|${lastResult.settings.direction ?? ""}|${lastResult.settings.fillMode}|${lastResult.settings.slTpMode}|${lastResult.settings.slippage}|${lastResult.settings.commission}|${lastResult.settings.commissionRate}|${lastResult.settings.taxRate}`
    : "";
  const [demoResults, setDemoResults] = useState<DemoBacktest[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: candlesKey + overridesKey are the deliberate triggers; `candles` (the array reference) and `lastResult` (a new object every Run) churn every Replay tick / re-render but their content-hashes don't, so we key off the hashes instead. Safe because Replay extends the slice monotonically.
  useEffect(() => {
    if (isReplayPlaying) return;
    const overrides = lastResult ? overridesFromResult(lastResult) : {};
    setDemoResults(runDemoBacktests(candles, DEMO_STRATEGIES, overrides));
  }, [candlesKey, isReplayPlaying, overridesKey]);

  // Slots pair the user's result (when present) with the surviving demos.
  // We iterate `demoResults` (not `DEMO_STRATEGIES`) so a failed demo just
  // produces a shorter list — labels never drift to a different strategy.
  const slots = useMemo<RotationSlot[]>(() => {
    const out: RotationSlot[] = [];
    if (lastResult) {
      out.push({ label: "Slot 1: your strategy", source: "user", result: lastResult });
      for (const demo of demoResults) {
        out.push({
          label: `Slot ${out.length + 1}: ${demo.strategy.name} (demo)`,
          source: "demo",
          result: demo.result,
        });
      }
    } else {
      for (const demo of demoResults) {
        out.push({
          label: `Slot ${out.length + 1}: ${demo.strategy.name} (demo)`,
          source: "demo",
          result: demo.result,
        });
      }
    }
    return out;
  }, [lastResult, demoResults]);

  const rotationResult = useMemo(() => buildRotation(slots, rotation), [slots, rotation]);

  return (
    <div className="risk-panel">
      <div className="pane-header">Meta-Strategy</div>

      <section className="risk-section">
        <div className="risk-section-title">Equity Curve Filter</div>

        <div className="risk-tabs">
          {FILTER_TYPES.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`risk-tab${filter.type === t.id ? " active" : ""}`}
              onClick={() => setFilter((prev) => ({ ...prev, type: t.id }))}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="risk-inputs">
          {(filter.type === "ma" || filter.type === "combined") && (
            <NumInput
              label="MA period"
              value={filter.maPeriod}
              min={2}
              max={100}
              step={1}
              integer
              onChange={(v) => setFilter((prev) => ({ ...prev, maPeriod: v }))}
            />
          )}
          {(filter.type === "drawdown" || filter.type === "combined") && (
            <NumInput
              label="Max DD %"
              value={filter.maxDrawdown}
              min={1}
              max={95}
              step={1}
              onChange={(v) => setFilter((prev) => ({ ...prev, maxDrawdown: v }))}
            />
          )}
          {(filter.type === "winRate" || filter.type === "combined") && (
            <NumInput
              label="Min WR %"
              value={filter.minWinRate}
              min={0}
              max={100}
              step={5}
              onChange={(v) => setFilter((prev) => ({ ...prev, minWinRate: v }))}
            />
          )}
          <NumInput
            label="Size factor"
            value={filter.filteredSizeFactor}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setFilter((prev) => ({ ...prev, filteredSizeFactor: v }))}
          />
        </div>

        <FilterResult result={filterResult} />
      </section>

      <section className="risk-section">
        <div className="risk-section-title">Strategy Rotation</div>

        <div className="risk-tabs">
          {ROTATION_METRICS.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`risk-tab${rotation.metric === m.id ? " active" : ""}`}
              onClick={() => setRotation((prev) => ({ ...prev, metric: m.id }))}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="risk-inputs">
          <NumInput
            label="Lookback"
            value={rotation.lookbackTrades}
            min={1}
            max={500}
            step={1}
            integer
            onChange={(v) => setRotation((prev) => ({ ...prev, lookbackTrades: v }))}
          />
          <NumInput
            label="Max active"
            value={rotation.maxActive}
            min={1}
            max={Math.max(1, slots.length)}
            step={1}
            integer
            onChange={(v) => setRotation((prev) => ({ ...prev, maxActive: v }))}
          />
        </div>

        <div className="risk-tabs">
          {ALLOCATIONS.map((a) => (
            <button
              type="button"
              key={a.id}
              className={`risk-tab${rotation.allocation === a.id ? " active" : ""}`}
              onClick={() => setRotation((prev) => ({ ...prev, allocation: a.id }))}
            >
              {a.label}
            </button>
          ))}
        </div>

        <RotationResult
          result={rotationResult}
          metric={rotation.metric}
          isReplayPlaying={isReplayPlaying}
        />
      </section>
    </div>
  );
}

function FilterResult({ result }: { result: ReturnType<typeof computeFilter> }) {
  if (result.kind === "empty") {
    return <div className="meta-strategy-caption">Run a backtest to see filter improvement.</div>;
  }
  if (result.kind === "error") {
    return <div className="risk-error">{result.message}</div>;
  }
  const { analysis, health } = result;
  return (
    <>
      <div className="risk-result">
        <DeltaMetric label="Δ Sharpe" delta={analysis.improvement.sharpeRatio} digits={2} />
        <DeltaMetric label="Δ MaxDD" delta={analysis.improvement.maxDrawdown} digits={2} unit="%" />
        <DeltaMetric
          label="Δ Return"
          delta={analysis.improvement.returnPercent}
          digits={2}
          unit="%"
        />
        <DeltaMetric label="Δ PF" delta={analysis.improvement.profitFactor} digits={2} />
      </div>
      <div className="meta-strategy-caption">
        Skipped {analysis.tradesSkipped}/{analysis.original.trades.length} trades · health{" "}
        {health.healthScore}/100
        {health.aboveMa ? " · above MA" : " · below MA"} · DD {health.currentDrawdown.toFixed(1)}%
      </div>
    </>
  );
}

function RotationResult({
  result,
  metric,
  isReplayPlaying,
}: {
  result: ReturnType<typeof buildRotation>;
  metric: StrategyPerformanceMetric;
  isReplayPlaying: boolean;
}) {
  if (result.kind === "empty") {
    return <div className="meta-strategy-caption">Computing rotation…</div>;
  }
  if (result.kind === "error") {
    return <div className="risk-error">{result.message}</div>;
  }
  const { slots, rotation } = result;
  const allocByIdx = new Map(rotation.allocations.map((a) => [a.strategyIndex, a]));
  return (
    <>
      <table className="rotation-table">
        <tbody>
          {slots.map((slot, idx) => {
            const alloc = allocByIdx.get(idx);
            const weight = alloc?.weight ?? 0;
            return (
              <tr key={slot.label}>
                <td className="rotation-name">{slot.label}</td>
                <td className="rotation-metric">{formatMetric(alloc?.metricValue, metric)}</td>
                <td className="rotation-weight">
                  <div className="weight-bar">
                    <div
                      className="weight-bar-fill"
                      style={{ width: `${(weight * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <span className="weight-label">{(weight * 100).toFixed(0)}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="meta-strategy-caption">
        {rotation.activeCount} active of {slots.length}
        {isReplayPlaying ? " · frozen during playback" : ""}
      </div>
    </>
  );
}

function DeltaMetric({
  label,
  delta,
  digits,
  unit = "",
}: {
  label: string;
  delta: number;
  digits: number;
  unit?: string;
}) {
  if (!Number.isFinite(delta)) {
    return (
      <div className="metric">
        <div className="metric-label">{label}</div>
        <div className="metric-value">—</div>
      </div>
    );
  }
  // For Δ MaxDD, lower drawdown is "good"; the wrapper passes the delta as
  // `original - filtered` (so a positive delta means the filter reduced DD).
  // Color all positive deltas green for consistency.
  const tone = delta > 0 ? "good" : delta < 0 ? "bad" : undefined;
  const sign = delta > 0 ? "+" : "";
  return (
    <div className={`metric${tone ? ` ${tone}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {sign}
        {delta.toFixed(digits)}
        {unit}
      </div>
    </div>
  );
}

function formatMetric(value: number | undefined, metric: StrategyPerformanceMetric): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (metric === "winRate") return `${(value * 100).toFixed(0)}%`;
  if (metric === "returnPercent") return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}
