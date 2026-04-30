import type { BacktestResult } from "trendcraft";

type Props = {
  result: BacktestResult | undefined;
};

export function ResultsSummary({ result }: Props) {
  if (!result) {
    return (
      <div className="results-summary empty">Run a backtest to see metrics and trades here.</div>
    );
  }

  const cards: Array<{ label: string; value: string; tone?: "good" | "bad" }> = [
    {
      label: "Total return",
      value: `${formatPercent(result.totalReturnPercent)} (${formatMoney(result.totalReturn)})`,
      tone: result.totalReturn >= 0 ? "good" : "bad",
    },
    { label: "Trades", value: String(result.tradeCount) },
    {
      label: "Win rate",
      value: formatPercent(result.winRate),
      tone: result.winRate >= 50 ? "good" : "bad",
    },
    {
      label: "Max DD",
      value: formatPercent(-Math.abs(result.maxDrawdown)),
      tone: "bad",
    },
    { label: "Sharpe", value: result.sharpeRatio.toFixed(2) },
    {
      label: "PF",
      value: Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞",
    },
    { label: "Avg hold", value: `${result.avgHoldingDays.toFixed(1)}d` },
  ];

  return (
    <div className="results-summary">
      <div className="metrics-grid">
        {cards.map((c) => (
          <div key={c.label} className={`metric${c.tone ? ` ${c.tone}` : ""}`}>
            <div className="metric-label">{c.label}</div>
            <div className="metric-value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="trades-header">Trades ({result.trades.length})</div>
      <div className="trades-table-wrap">
        <table className="trades-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Entry</th>
              <th>Exit</th>
              <th className="num">Return</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {result.trades.slice(-50).map((t, i) => (
              <tr key={`${t.entryTime}-${i}`} className={t.return >= 0 ? "win" : "loss"}>
                <td>{i + 1}</td>
                <td>{formatDate(t.entryTime)}</td>
                <td>{formatDate(t.exitTime)}</td>
                <td className="num">{formatPercent(t.returnPercent)}</td>
                <td>{t.exitReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.trades.length > 50 && (
          <div className="trades-footer">Showing last 50 of {result.trades.length}</div>
        )}
      </div>
    </div>
  );
}

function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function formatMoney(v: number): string {
  const sign = v >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
