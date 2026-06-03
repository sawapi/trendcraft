import { Sparkline } from "@trendcraft/chart/react/sparkline";
import { useMemo } from "react";
import { stitchOosEquity, type WalkForwardResult, wfeRatio } from "trendcraft";
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
 * rather than a curve-fit one, so the badge flips pass/fail at 0.5.
 *
 * Below the headline is the stitched out-of-sample equity curve
 * (`stitchOosEquity`) — every window's out-of-sample trades compounded
 * into one continuous path. This is the canonical walk-forward visual:
 * it shows what an account that only ever traded unseen data would have
 * done, so curve-fit strategies that look great in-sample but stall
 * out-of-sample show up as a flat or sinking line even when the average
 * WFE rounds up. The per-window table then breaks the same path back into
 * its raw in/out-of-sample returns so a single bad window that drags the
 * average down is visible rather than hidden inside the aggregate.
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

  // Stitched out-of-sample equity: every window's OOS trades compounded
  // into one continuous path. The absolute capital only scales the curve
  // (the chart auto-fits), so the core default is fine — the endpoint
  // relative to the start is the total compounded OOS return.
  const curve = useMemo(() => stitchOosEquity(result).map((p) => p.equity), [result]);
  const oosReturn = curve.length > 1 ? (curve[curve.length - 1] / curve[0] - 1) * 100 : Number.NaN;
  const oosUp = oosReturn >= 0;

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

      {/* Stitched out-of-sample equity curve (canonical walk-forward visual) */}
      {curve.length > 1 && (
        <div className="results-chart-block">
          <div
            className="results-chart-label"
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <span>Stitched OOS equity</span>
            <span style={{ color: oosUp ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
              {oosUp ? "+" : ""}
              {oosReturn.toFixed(1)}%
            </span>
          </div>
          <Sparkline
            type="line"
            data={curve}
            width={320}
            height={56}
            color={{ fixed: oosUp ? "#26a69a" : "#ef5350" }}
            fill
            style={{ width: "100%" }}
          />
        </div>
      )}

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
