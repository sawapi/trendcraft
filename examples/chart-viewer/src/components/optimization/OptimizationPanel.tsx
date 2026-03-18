/**
 * Optimization Panel - Grid Search and Walk-Forward Analysis UI
 */

import type { OptimizationMetric } from "trendcraft";
import { ENTRY_CONDITIONS, EXIT_CONDITIONS } from "../../hooks/useBacktest";
import {
  type GridSearchConfig,
  type OptimizationTab,
  PARAMETER_TEMPLATES,
  type ParameterRangeConfig,
  type WalkForwardConfig,
  useOptimization,
} from "../../hooks/useOptimization";
import { useChartStore } from "../../store/chartStore";
import { renderGroupedOptions } from "../BacktestPanel";
import { ResultsTable } from "./ResultsTable";

// ── Metric options ────────────────────────────────────────────────

const METRIC_OPTIONS: { value: OptimizationMetric; label: string }[] = [
  { value: "sharpe", label: "Sharpe Ratio" },
  { value: "returns", label: "Total Return" },
  { value: "profitFactor", label: "Profit Factor" },
  { value: "winRate", label: "Win Rate" },
  { value: "calmar", label: "Calmar Ratio" },
  { value: "maxDrawdown", label: "Max Drawdown" },
  { value: "recoveryFactor", label: "Recovery Factor" },
];

// ── Helper: format date from timestamp ────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ── Sub-components ────────────────────────────────────────────────

function TabBar({
  tab,
  setTab,
}: {
  tab: OptimizationTab;
  setTab: (t: OptimizationTab) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setTab("gridSearch")}
        style={{
          ...tabButtonStyle,
          ...(tab === "gridSearch" ? tabActiveStyle : {}),
          borderRadius: "4px 0 0 4px",
        }}
      >
        Grid Search
      </button>
      <button
        type="button"
        onClick={() => setTab("walkForward")}
        style={{
          ...tabButtonStyle,
          ...(tab === "walkForward" ? tabActiveStyle : {}),
          borderRadius: "0 4px 4px 0",
        }}
      >
        Walk-Forward
      </button>
    </div>
  );
}

function ParameterRangeEditor({
  ranges,
  onChange,
}: {
  ranges: ParameterRangeConfig[];
  onChange: (ranges: ParameterRangeConfig[]) => void;
}) {
  const updateRange = (idx: number, field: keyof ParameterRangeConfig, value: string | number) => {
    const updated = [...ranges];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const addRange = () => {
    onChange([
      ...ranges,
      {
        id: `p${Date.now()}`,
        name: "param",
        min: 1,
        max: 10,
        step: 1,
      },
    ]);
  };

  const removeRange = (idx: number) => {
    onChange(ranges.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)" }}>
          Parameter Ranges
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {/* Template buttons */}
          {Object.entries(PARAMETER_TEMPLATES).map(([key, tmpl]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(tmpl.ranges.map((r) => ({ ...r })))}
              style={templateBtnStyle}
              title={tmpl.label}
            >
              {tmpl.label}
            </button>
          ))}
        </div>
      </div>

      {ranges.map((range, idx) => (
        <div key={range.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="text"
            value={range.name}
            onChange={(e) => updateRange(idx, "name", e.target.value)}
            style={{ ...inputStyle, width: 70 }}
            placeholder="name"
          />
          <input
            type="number"
            value={range.min}
            onChange={(e) => updateRange(idx, "min", Number(e.target.value))}
            style={{ ...inputStyle, width: 45 }}
            placeholder="min"
          />
          <span style={{ color: "var(--text-secondary)", fontSize: "var(--font-xs)" }}>-</span>
          <input
            type="number"
            value={range.max}
            onChange={(e) => updateRange(idx, "max", Number(e.target.value))}
            style={{ ...inputStyle, width: 45 }}
            placeholder="max"
          />
          <span style={{ color: "var(--text-secondary)", fontSize: "var(--font-xs)" }}>step</span>
          <input
            type="number"
            value={range.step}
            onChange={(e) => updateRange(idx, "step", Number(e.target.value))}
            style={{ ...inputStyle, width: 40 }}
            placeholder="step"
          />
          <button
            type="button"
            onClick={() => removeRange(idx)}
            style={removeBtnStyle}
            title="Remove"
          >
            x
          </button>
        </div>
      ))}

      <button type="button" onClick={addRange} style={addBtnStyle}>
        + Add Parameter
      </button>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div style={{ width: "100%", marginTop: 4 }}>
      <div
        style={{
          height: 4,
          background: "var(--bg-tertiary)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--accent-primary)",
            transition: "width 0.1s",
          }}
        />
      </div>
      <div
        style={{
          fontSize: "var(--font-xs)",
          color: "var(--text-secondary)",
          textAlign: "center",
          marginTop: 2,
        }}
      >
        {current} / {total}
      </div>
    </div>
  );
}

function WalkForwardResults({
  result,
}: {
  result: import("trendcraft").WalkForwardResult;
}) {
  const { periods, aggregateMetrics, recommendation } = result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Recommendation */}
      <div
        style={{
          padding: 8,
          borderRadius: 4,
          background: recommendation.useOptimizedParams
            ? "rgba(0, 255, 136, 0.1)"
            : "rgba(255, 68, 68, 0.1)",
          border: `1px solid ${recommendation.useOptimizedParams ? "var(--success)" : "var(--error)"}`,
        }}
      >
        <div
          style={{
            fontSize: "var(--font-sm)",
            fontWeight: 600,
            color: recommendation.useOptimizedParams ? "var(--success)" : "var(--error)",
            marginBottom: 4,
          }}
        >
          {recommendation.useOptimizedParams ? "Recommended" : "Not Recommended"}
        </div>
        <div style={{ fontSize: "var(--font-xs)", color: "var(--text-secondary)" }}>
          {recommendation.reason}
        </div>
        {recommendation.suggestedParams && (
          <div style={{ fontSize: "var(--font-xs)", color: "var(--warning)", marginTop: 4 }}>
            Suggested: {JSON.stringify(recommendation.suggestedParams)}
          </div>
        )}
      </div>

      {/* Aggregate Metrics */}
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: 6,
          padding: 8,
        }}
      >
        <div
          style={{
            fontSize: "var(--font-sm)",
            color: "var(--text-secondary)",
            marginBottom: 6,
            fontWeight: 600,
          }}
        >
          Aggregate Metrics
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <MetricCell
            label="Stability"
            value={`${(aggregateMetrics.stabilityRatio * 100).toFixed(1)}%`}
            color={
              aggregateMetrics.stabilityRatio >= 0.5
                ? "var(--success)"
                : aggregateMetrics.stabilityRatio >= 0.3
                  ? "var(--warning)"
                  : "var(--error)"
            }
          />
          <MetricCell
            label="Avg IS Return"
            value={`${aggregateMetrics.avgInSample.returns >= 0 ? "+" : ""}${aggregateMetrics.avgInSample.returns.toFixed(1)}%`}
            color={aggregateMetrics.avgInSample.returns >= 0 ? "var(--success)" : "var(--error)"}
          />
          <MetricCell
            label="Avg OOS Return"
            value={`${aggregateMetrics.avgOutOfSample.returns >= 0 ? "+" : ""}${aggregateMetrics.avgOutOfSample.returns.toFixed(1)}%`}
            color={aggregateMetrics.avgOutOfSample.returns >= 0 ? "var(--success)" : "var(--error)"}
          />
          <MetricCell label="IS Sharpe" value={aggregateMetrics.avgInSample.sharpe.toFixed(2)} />
          <MetricCell
            label="OOS Sharpe"
            value={aggregateMetrics.avgOutOfSample.sharpe.toFixed(2)}
          />
          <MetricCell label="Periods" value={String(periods.length)} />
        </div>
      </div>

      {/* Period Details */}
      <details style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)" }}>
        <summary style={{ cursor: "pointer", padding: "4px 0", userSelect: "none" }}>
          Period Details ({periods.length})
        </summary>
        <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
          {periods.map((period, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
                borderBottom: "1px solid rgba(51, 51, 51, 0.5)",
                fontSize: "var(--font-xs)",
              }}
            >
              <div>
                <span style={{ color: "var(--text-secondary)" }}>
                  {formatDate(period.trainStart)}-{formatDate(period.trainEnd)}
                </span>
                <span style={{ color: "var(--text-secondary)", margin: "0 4px" }}>/</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {formatDate(period.testStart)}-{formatDate(period.testEnd)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    color: period.inSampleMetrics.returns >= 0 ? "var(--success)" : "var(--error)",
                  }}
                >
                  IS: {period.inSampleMetrics.returns >= 0 ? "+" : ""}
                  {period.inSampleMetrics.returns.toFixed(1)}%
                </span>
                <span
                  style={{
                    color:
                      period.outOfSampleMetrics.returns >= 0 ? "var(--success)" : "var(--error)",
                  }}
                >
                  OOS: {period.outOfSampleMetrics.returns >= 0 ? "+" : ""}
                  {period.outOfSampleMetrics.returns.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function MetricCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "center" }}>
      <span style={{ fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "var(--font-md)",
          fontWeight: 600,
          color: color ?? "var(--text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export function OptimizationPanel() {
  const currentCandles = useChartStore((state) => state.currentCandles);

  const {
    tab,
    isRunning,
    progress,
    gridSearchResult,
    walkForwardResult,
    error,
    gridConfig,
    wfConfig,
    setTab,
    setGridConfig,
    setWfConfig,
    runGridSearch,
    runWalkForward,
    clearResults,
  } = useOptimization(currentCandles);

  const updateGridConfig = (partial: Partial<GridSearchConfig>) => {
    setGridConfig({ ...gridConfig, ...partial });
  };

  const updateWfConfig = (partial: Partial<WalkForwardConfig>) => {
    setWfConfig({ ...wfConfig, ...partial });
  };

  // Active config based on tab
  const activeConfig = tab === "gridSearch" ? gridConfig : wfConfig;
  const updateActiveConfig = tab === "gridSearch" ? updateGridConfig : updateWfConfig;

  return (
    <div className="optimization-panel" style={panelStyle}>
      <details>
        <summary style={headerStyle}>Optimization</summary>

        <div style={{ marginTop: 8 }}>
          <TabBar tab={tab} setTab={setTab} />

          {/* Strategy Selection */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            <div className="condition-row">
              <label>Entry</label>
              <select
                value={activeConfig.entryCondition}
                onChange={(e) => updateActiveConfig({ entryCondition: e.target.value })}
              >
                {renderGroupedOptions(ENTRY_CONDITIONS)}
              </select>
            </div>
            <div className="condition-row">
              <label>Exit</label>
              <select
                value={activeConfig.exitCondition}
                onChange={(e) => updateActiveConfig({ exitCondition: e.target.value })}
              >
                {renderGroupedOptions(EXIT_CONDITIONS)}
              </select>
            </div>
            <div className="condition-row">
              <label>Metric</label>
              <select
                value={activeConfig.metric}
                onChange={(e) =>
                  updateActiveConfig({ metric: e.target.value as OptimizationMetric })
                }
              >
                {METRIC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Parameter Ranges */}
          <ParameterRangeEditor
            ranges={activeConfig.parameterRanges}
            onChange={(ranges) => updateActiveConfig({ parameterRanges: ranges })}
          />

          {/* Walk-Forward specific settings */}
          {tab === "walkForward" && (
            <details
              style={{
                fontSize: "var(--font-sm)",
                color: "var(--text-secondary)",
                marginTop: 8,
              }}
            >
              <summary style={{ cursor: "pointer", padding: "4px 0", userSelect: "none" }}>
                Window Settings
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
                <div className="setting-row">
                  <label>Train Window</label>
                  <input
                    type="number"
                    value={wfConfig.windowSize}
                    onChange={(e) => updateWfConfig({ windowSize: Number(e.target.value) || 252 })}
                  />
                </div>
                <div className="setting-row">
                  <label>Step Size</label>
                  <input
                    type="number"
                    value={wfConfig.stepSize}
                    onChange={(e) => updateWfConfig({ stepSize: Number(e.target.value) || 63 })}
                  />
                </div>
                <div className="setting-row">
                  <label>Test Size</label>
                  <input
                    type="number"
                    value={wfConfig.testSize}
                    onChange={(e) => updateWfConfig({ testSize: Number(e.target.value) || 63 })}
                  />
                </div>
              </div>
            </details>
          )}

          {/* Run / Clear buttons */}
          <div className="backtest-actions" style={{ marginTop: 10 }}>
            <button
              className="run-button"
              onClick={tab === "gridSearch" ? runGridSearch : runWalkForward}
              disabled={isRunning || currentCandles.length < 50}
            >
              {isRunning
                ? "Running..."
                : tab === "gridSearch"
                  ? "Run Grid Search"
                  : "Run Walk-Forward"}
            </button>
            {(gridSearchResult || walkForwardResult) && (
              <button className="clear-button" onClick={clearResults}>
                Clear
              </button>
            )}
          </div>

          {/* Progress */}
          {isRunning && progress && (
            <ProgressBar current={progress.current} total={progress.total} />
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 4,
                background: "rgba(255, 68, 68, 0.15)",
                border: "1px solid var(--error)",
                color: "var(--error)",
                fontSize: "var(--font-xs)",
              }}
            >
              {error}
            </div>
          )}

          {/* Grid Search Results */}
          {tab === "gridSearch" && gridSearchResult && (
            <div style={{ marginTop: 8 }}>
              {/* Summary */}
              <div
                style={{
                  background: "var(--bg-primary)",
                  borderRadius: 6,
                  padding: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <MetricCell label="Tested" value={String(gridSearchResult.totalCombinations)} />
                  <MetricCell label="Valid" value={String(gridSearchResult.validCombinations)} />
                  <MetricCell
                    label="Best Score"
                    value={gridSearchResult.bestScore.toFixed(3)}
                    color="var(--success)"
                  />
                </div>
                {Object.keys(gridSearchResult.bestParams).length > 0 && (
                  <div
                    style={{
                      fontSize: "var(--font-xs)",
                      color: "var(--warning)",
                      marginTop: 6,
                      textAlign: "center",
                    }}
                  >
                    Best: {JSON.stringify(gridSearchResult.bestParams)}
                  </div>
                )}
              </div>

              {/* Results Table */}
              <ResultsTable results={gridSearchResult.results} topN={5} />
            </div>
          )}

          {/* Walk-Forward Results */}
          {tab === "walkForward" && walkForwardResult && (
            <div style={{ marginTop: 8 }}>
              <WalkForwardResults result={walkForwardResult} />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  padding: "var(--spacing-md)",
  borderTop: "1px solid var(--border)",
};

const headerStyle: React.CSSProperties = {
  fontSize: "var(--font-md)",
  fontWeight: 600,
  color: "var(--text-primary)",
  cursor: "pointer",
  userSelect: "none",
  padding: "var(--spacing-xs) 0",
};

const tabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 8px",
  fontSize: "var(--font-sm)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border)",
  background: "var(--bg-tertiary)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  transition: "all 0.15s",
};

const tabActiveStyle: React.CSSProperties = {
  background: "var(--accent-primary)",
  color: "var(--text-primary)",
  borderColor: "var(--accent-primary)",
};

const inputStyle: React.CSSProperties = {
  padding: "3px 4px",
  background: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: "var(--font-xs)",
  outline: "none",
};

const templateBtnStyle: React.CSSProperties = {
  padding: "2px 6px",
  fontSize: 9,
  background: "var(--bg-tertiary)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  cursor: "pointer",
};

const addBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "var(--font-xs)",
  background: "transparent",
  color: "var(--accent-primary)",
  border: "1px dashed var(--border)",
  borderRadius: 4,
  cursor: "pointer",
};

const removeBtnStyle: React.CSSProperties = {
  padding: "2px 6px",
  fontSize: "var(--font-xs)",
  background: "transparent",
  color: "var(--error)",
  border: "none",
  cursor: "pointer",
};
