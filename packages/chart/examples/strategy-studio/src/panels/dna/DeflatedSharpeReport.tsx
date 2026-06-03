import type { DeflatedSharpeComputation } from "../../lib/robustness";

type Props = {
  /** Deflated Sharpe correction derived from the grid search result. */
  computation: DeflatedSharpeComputation;
};

/**
 * Deflated Sharpe headline for the Robustness tab — the probability that
 * the optimization's chosen strategy has a genuinely positive Sharpe once
 * the multiple-testing of the grid search is accounted for.
 *
 * Bailey & López de Prado treat ~0.95 as the bar: below it the headline
 * Sharpe is plausibly a selection-bias artifact, so the chip flips
 * green → amber → red around it. The subline reports how many grid
 * combinations fed the correction and the selected combination's raw
 * per-return Sharpe, so the gap between the raw and deflated views is
 * visible at a glance.
 */
export function DeflatedSharpeReport({ computation }: Props) {
  if (computation.kind === "empty") {
    return <div className="meta-strategy-caption">{computation.message}</div>;
  }
  const { probability, observedSharpe, trials, sampleSize } = computation;
  const color = dsrColor(probability);
  const verdict =
    probability >= 0.95 ? "credible" : probability >= 0.9 ? "borderline" : "likely overfit";

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <DsrStat
        label={`Deflated Sharpe · ${verdict}`}
        value={`${(probability * 100).toFixed(0)}%`}
        color={color}
      />
      <DsrStat
        label="Observed Sharpe (per trade)"
        value={observedSharpe.toFixed(2)}
        color="#4a9eff"
      />
      <div
        style={{
          flex: 1,
          padding: "6px 8px",
          fontSize: 9,
          color: "var(--text-secondary, #888)",
          lineHeight: 1.4,
          display: "flex",
          alignItems: "center",
        }}
      >
        Best of {trials} grid combos · {sampleSize} trades · P(true Sharpe &gt; 0) after
        selection-bias correction
      </div>
    </div>
  );
}

/** ≥ 0.95 credible (green), ≥ 0.90 borderline (amber), below likely overfit (red). */
function dsrColor(p: number): string {
  if (p >= 0.95) return "#16a34a";
  if (p >= 0.9) return "#eab308";
  return "#dc2626";
}

/** A single headline stat chip (label + colored value). */
function DsrStat({ label, value, color }: { label: string; value: string; color: string }) {
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
