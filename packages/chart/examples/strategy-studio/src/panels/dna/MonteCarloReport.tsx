import type { MetricStatistics, MonteCarloResult } from "trendcraft";
import type { MonteCarloComputation } from "../../lib/robustness";

type Props = {
  computation: MonteCarloComputation;
  iterations: number;
  onIterationsChange: (n: number) => void;
  onRun: () => void;
  /** Disabled while there is no usable backtest to resample. */
  disabled: boolean;
  /** Reason the run is disabled, shown as a caption when `disabled`. */
  disabledReason?: string;
};

const ITERATION_OPTIONS = [500, 1000, 5000];

/**
 * Monte Carlo section of the Robustness tab — trade-shuffle resampling
 * of the last backtest. Run-on-demand (not auto-computed): the
 * simulation is O(iterations · trades) and stochastic, so it stays
 * behind an explicit button like the sibling Grid Search.
 *
 * Surfaces the significance verdict, both p-values, and a 5th/median/
 * 95th percentile table for Sharpe / Return / Max DD — the resampled
 * spread is the headline a single backtest number can't show. Richer
 * visuals (equity fan chart, Max DD histogram, P(ruin)) land in a
 * later pass once core exposes the per-path equity bands.
 */
export function MonteCarloReport({
  computation,
  iterations,
  onIterationsChange,
  onRun,
  disabled,
  disabledReason,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: "var(--font-xs)",
            color: "var(--text-secondary, #888)",
          }}
        >
          <span>Iterations</span>
          <select
            value={iterations}
            disabled={disabled}
            onChange={(e) => onIterationsChange(Number(e.target.value))}
            style={{ fontSize: "var(--font-xs)" }}
          >
            {ITERATION_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="optimization-run-btn"
          onClick={onRun}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          Run Monte Carlo
        </button>
      </div>

      {disabled && disabledReason && <div className="meta-strategy-caption">{disabledReason}</div>}

      {computation.kind === "empty" && (
        <div className="meta-strategy-caption">{computation.message}</div>
      )}
      {computation.kind === "error" && <div className="risk-error">{computation.message}</div>}
      {computation.kind === "ok" && (
        <McResultBody result={computation.result} iterations={computation.iterations} />
      )}
    </div>
  );
}

function McResultBody({ result, iterations }: { result: MonteCarloResult; iterations: number }) {
  const { assessment, pValue, statistics, originalResult } = result;
  return (
    <>
      {/* Significance verdict */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 6,
          background: "var(--bg-primary, #1a1a1a)",
          borderLeft: `3px solid ${assessment.isSignificant ? "#16a34a" : "#ea580c"}`,
        }}
      >
        <span
          style={{
            fontSize: "var(--font-sm)",
            fontWeight: 600,
            color: assessment.isSignificant ? "#16a34a" : "#ea580c",
          }}
        >
          {assessment.isSignificant ? "Significant" : "Not significant"}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-secondary, #888)" }}>
          {iterations.toLocaleString()} shuffles · p(Sharpe) {pValue.sharpe.toFixed(3)} · p(Return){" "}
          {pValue.returns.toFixed(3)}
        </span>
      </div>

      {/* Percentile spread table */}
      <table className="optimization-result-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th className="num">Actual</th>
            <th className="num">5th</th>
            <th className="num">Median</th>
            <th className="num">95th</th>
          </tr>
        </thead>
        <tbody>
          <McRow
            label="Sharpe"
            actual={originalResult.sharpe}
            stats={statistics.sharpe}
            digits={2}
          />
          <McRow
            label="Return %"
            actual={originalResult.totalReturnPercent}
            stats={statistics.totalReturnPercent}
            digits={1}
          />
          <McRow
            label="Max DD %"
            actual={originalResult.maxDrawdown}
            stats={statistics.maxDrawdown}
            digits={1}
          />
        </tbody>
      </table>
    </>
  );
}

function McRow({
  label,
  actual,
  stats,
  digits,
}: {
  label: string;
  actual: number;
  stats: MetricStatistics;
  digits: number;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{actual.toFixed(digits)}</td>
      <td className="num">{stats.percentile5.toFixed(digits)}</td>
      <td className="num">{stats.median.toFixed(digits)}</td>
      <td className="num">{stats.percentile95.toFixed(digits)}</td>
    </tr>
  );
}
