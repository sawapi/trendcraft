import { type WalkForwardResult, wfeRatio } from "trendcraft";
import type { WalkForwardComputation } from "../../lib/optimization";

type Props = {
  /** Latest walk-forward computation lifted from the Optimization panel. */
  computation: WalkForwardComputation;
};

/**
 * Walk-Forward section of the Robustness tab — read-only view of the
 * rolling analysis run from the sibling Optimization panel (the run
 * trigger and window dials live there, matching how Grid Search and
 * Strategy DNA already share one run).
 *
 * The headline is Pardo's Walk-Forward Efficiency (`wfeRatio`): the
 * average of each window's calendar-annualized out-of-sample / in-sample
 * return. Pardo treats ≥ 50% as the bar for a genuinely robust strategy
 * rather than a curve-fit one, so the badge flips pass/fail at 0.5. The
 * per-window table below shows the raw in/out-of-sample returns each
 * window contributed, so a single bad window that drags the average down
 * is visible rather than hidden inside the aggregate.
 */
export function WalkForwardReport({ computation }: Props) {
  if (computation.kind === "idle") {
    return (
      <div className="meta-strategy-caption">
        Run a walk-forward analysis from the Optimization panel to grade out-of-sample stability.
      </div>
    );
  }
  if (computation.kind === "empty") {
    return <div className="meta-strategy-caption">{computation.message}</div>;
  }
  if (computation.kind === "error") {
    return <div className="risk-error">{computation.message}</div>;
  }
  return (
    <WalkForwardBody
      result={computation.result}
      windows={computation.windows}
      oosPercent={computation.oosPercent}
    />
  );
}

/** WFE pass ≥ 0.5 (Pardo), borderline ≥ 0.3, fail below. */
function wfeColor(wfe: number): string {
  if (!Number.isFinite(wfe)) return "#6b7280";
  if (wfe >= 0.5) return "#16a34a";
  if (wfe >= 0.3) return "#eab308";
  return "#dc2626";
}

function WalkForwardBody({
  result,
  windows,
  oosPercent,
}: {
  result: WalkForwardResult;
  windows: number;
  oosPercent: number;
}) {
  const wfe = wfeRatio(result);
  const wfeFinite = Number.isFinite(wfe);
  const color = wfeColor(wfe);
  const { stabilityRatio } = result.aggregateMetrics;
  const verdict = !wfeFinite
    ? "n/a"
    : wfe >= 0.5
      ? "robust"
      : wfe >= 0.3
        ? "borderline"
        : "overfit";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Headline: WFE badge + stability ratio */}
      <div style={{ display: "flex", gap: 6 }}>
        <WfStat
          label={`Avg WFE · ${verdict}`}
          value={wfeFinite ? `${(wfe * 100).toFixed(0)}%` : "—"}
          color={color}
        />
        <WfStat
          label="Stability ratio"
          value={`${(stabilityRatio * 100).toFixed(0)}%`}
          color="#4a9eff"
        />
      </div>
      <div style={{ fontSize: 9, color: "var(--text-secondary, #888)", lineHeight: 1.4 }}>
        {windows} window(s) · {oosPercent}% out-of-sample · {result.recommendation.reason}
      </div>

      {/* Per-window in/out-of-sample breakdown */}
      <table className="optimization-result-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="num">IS Ret %</th>
            <th className="num">OOS Ret %</th>
            <th className="num">OOS Sharpe</th>
          </tr>
        </thead>
        <tbody>
          {result.periods.map((p, i) => (
            <tr key={`${p.trainStart}-${p.testStart}`}>
              <td>{i + 1}</td>
              <td className="num">{p.inSampleMetrics.returns.toFixed(1)}</td>
              <td
                className="num"
                style={{ color: p.outOfSampleMetrics.returns > 0 ? "#16a34a" : "#dc2626" }}
              >
                {p.outOfSampleMetrics.returns.toFixed(1)}
              </td>
              <td className="num">{p.outOfSampleMetrics.sharpe.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A single headline stat chip (label + colored value). */
function WfStat({ label, value, color }: { label: string; value: string; color: string }) {
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
      <div style={{ fontSize: "var(--font-md)", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-secondary, #888)" }}>{label}</div>
    </div>
  );
}
