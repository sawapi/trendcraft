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
 * Monte Carlo section of the Robustness tab — bootstrap resampling of
 * the last backtest. Run-on-demand (not auto-computed): the simulation
 * is O(iterations · trades) and stochastic, so it stays behind an
 * explicit button like the sibling Grid Search.
 *
 * Surfaces the downside-risk headline — probability of profit / loss and
 * risk of ruin (a ruin-threshold drawdown) — plus a 5th/median/95th
 * percentile table for Sharpe / Return / Max DD. The resampled spread is
 * the headline a single backtest number can't show. A full equity fan
 * chart lands in a later pass once core exposes the per-path equity bands.
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

/**
 * Color a risk fraction by the bands mainstream Monte Carlo tooling uses
 * (green < 5%, amber < 20%, red ≥ 20%, deep red ≥ 50%).
 */
function riskColor(p: number): string {
  if (p < 0.05) return "#16a34a";
  if (p < 0.2) return "#eab308";
  if (p < 0.5) return "#ea580c";
  return "#dc2626";
}

function McResultBody({ result, iterations }: { result: MonteCarloResult; iterations: number }) {
  const { assessment, downside, statistics, originalResult } = result;
  const { probProfit, probLoss, riskOfRuin, ruinThreshold } = downside;
  return (
    <>
      {/* Downside-risk headline */}
      <div style={{ display: "flex", gap: 6 }}>
        <DownsideStat label="P(profit)" value={probProfit} color="#16a34a" />
        <DownsideStat label="P(loss)" value={probLoss} color={riskColor(probLoss)} />
        <DownsideStat
          label={`Risk of ruin (${ruinThreshold}%)`}
          value={riskOfRuin}
          color={riskColor(riskOfRuin)}
        />
      </div>
      <div style={{ fontSize: 9, color: "var(--text-secondary, #888)", lineHeight: 1.4 }}>
        {iterations.toLocaleString()} bootstrap resamples · {assessment.reason}
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

/** A single downside-risk stat chip (label + colored percentage). */
function DownsideStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "6px 8px",
        borderRadius: 6,
        background: "var(--bg-primary, #1a1a1a)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ fontSize: "var(--font-md)", fontWeight: 700, color }}>
        {(value * 100).toFixed(1)}%
      </div>
      <div style={{ fontSize: 9, color: "var(--text-secondary, #888)" }}>{label}</div>
    </div>
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
