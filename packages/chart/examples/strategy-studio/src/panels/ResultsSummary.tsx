import { Sparkline } from "@trendcraft/chart/react/sparkline";
import { useMemo, useState } from "react";
import type { BacktestResult, Trade } from "trendcraft";

type Props = {
  result: BacktestResult | undefined;
};

type Tab = "overview" | "breakdown" | "trades";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "breakdown", label: "Breakdown" },
  { key: "trades", label: "Trade analysis" },
];

/**
 * Three-tab result panel mirroring the TradingView / MT5 strategy-report
 * structure: KPI snapshot first, long/short breakdown second, trade-level
 * statistics third. Tabs let us surface the nine extended `BacktestResult`
 * fields (sortino, calmar, cagr, expectancy, exposure, avg/largest win,
 * avg/largest loss) without flooding the default view.
 */
export function ResultsSummary({ result }: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  if (!result) {
    return (
      <div className="results-summary empty">Run a backtest to see metrics and trades here.</div>
    );
  }

  return (
    <div className="results-summary">
      <div className="risk-tabs" style={{ marginBottom: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`risk-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab result={result} />}
      {tab === "breakdown" && <BreakdownTab result={result} />}
      {tab === "trades" && <TradesTab result={result} />}
    </div>
  );
}

function OverviewTab({ result }: { result: BacktestResult }) {
  const cards: Array<{ label: string; value: string; tone?: "good" | "bad" }> = [
    {
      label: "Total return",
      value: `${formatPercent(result.totalReturnPercent)} (${formatMoney(result.totalReturn)})`,
      tone: result.totalReturn >= 0 ? "good" : "bad",
    },
    {
      label: "CAGR",
      value: formatPercent(result.cagrPercent),
      tone: result.cagrPercent >= 0 ? "good" : "bad",
    },
    {
      label: "Max DD",
      value: formatPercent(-Math.abs(result.maxDrawdown)),
      tone: "bad",
    },
    { label: "Sharpe", value: formatRatio(result.sharpeRatio) },
    { label: "Sortino", value: formatRatio(result.sortinoRatio) },
    {
      label: "Profit factor",
      value: Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞",
    },
    {
      label: "Win rate",
      value: formatPercent(result.winRate),
      tone: result.winRate >= 50 ? "good" : "bad",
    },
    { label: "Trades", value: String(result.tradeCount) },
    {
      label: "Expectancy",
      value: formatPercent(result.expectancyPercent),
      tone: result.expectancyPercent >= 0 ? "good" : "bad",
    },
  ];

  const equity = useMemo(() => buildEquityCurve(result), [result]);
  const underwater = useMemo(() => buildUnderwaterCurve(equity), [equity]);

  return (
    <>
      <div className="metrics-grid metrics-grid-3">
        {cards.map((c) => (
          <div key={c.label} className={`metric${c.tone ? ` ${c.tone}` : ""}`}>
            <div className="metric-label">{c.label}</div>
            <div className="metric-value">{c.value}</div>
          </div>
        ))}
      </div>

      {equity.length > 1 && (
        <div className="results-chart-block">
          <div className="results-chart-label">Equity curve</div>
          <Sparkline
            type="line"
            data={equity}
            width={320}
            height={56}
            color={{
              fixed: result.totalReturnPercent >= 0 ? "#26a69a" : "#ef5350",
            }}
            fill
          />
        </div>
      )}
      {underwater.length > 1 && (
        <div className="results-chart-block">
          <div className="results-chart-label">Underwater drawdown</div>
          <Sparkline
            type="line"
            data={underwater}
            width={320}
            height={48}
            color={{ fixed: "#ef5350" }}
            fill
          />
        </div>
      )}
    </>
  );
}

function BreakdownTab({ result }: { result: BacktestResult }) {
  const span = useMemo(
    () => ({ firstBarTime: result.firstBarTime, lastBarTime: result.lastBarTime }),
    [result.firstBarTime, result.lastBarTime],
  );
  const all = useMemo(() => bucketStats(result.trades, "all", span), [result.trades, span]);
  const longs = useMemo(() => bucketStats(result.trades, "long", span), [result.trades, span]);
  const shorts = useMemo(() => bucketStats(result.trades, "short", span), [result.trades, span]);

  const rows: Array<{ label: string; pick: (b: BucketStats) => string }> = [
    { label: "Trades", pick: (b) => String(b.count) },
    { label: "Win rate", pick: (b) => formatPercent(b.winRate) },
    { label: "Expectancy", pick: (b) => formatPercent(b.expectancyPercent) },
    { label: "Avg win", pick: (b) => formatPercent(b.avgWinPercent) },
    { label: "Avg loss", pick: (b) => formatPercent(-b.avgLossPercent) },
    { label: "Largest win", pick: (b) => formatPercent(b.largestWinPercent) },
    { label: "Largest loss", pick: (b) => formatPercent(-b.largestLossPercent) },
    {
      label: "Profit factor",
      pick: (b) => (Number.isFinite(b.profitFactor) ? b.profitFactor.toFixed(2) : "∞"),
    },
    { label: "Avg holding period", pick: (b) => `${b.avgHoldingDays.toFixed(1)}d` },
    { label: "Exposure", pick: (b) => formatPercent(b.exposurePercent) },
  ];

  return (
    <table className="breakdown-table">
      <thead>
        <tr>
          <th></th>
          <th className="num">All</th>
          <th className="num">Long</th>
          <th className="num">Short</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td className="num">{r.pick(all)}</td>
            <td className="num">{longs.count > 0 ? r.pick(longs) : "—"}</td>
            <td className="num">{shorts.count > 0 ? r.pick(shorts) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TradesTab({ result }: { result: BacktestResult }) {
  const histogram = useMemo(() => buildHistogram(result.trades), [result.trades]);
  const tradeCount = result.trades.length;

  return (
    <>
      {tradeCount > 0 && tradeCount < 30 && (
        <div className="sample-size-banner">
          Sample size warning: only {tradeCount} trades. KPIs are statistically noisy below 30
          trades — treat percentages as directional, not precise.
        </div>
      )}

      {histogram.bins.length > 0 && (
        <div className="results-chart-block">
          <div className="results-chart-label">Trade P&amp;L distribution (%)</div>
          <Histogram
            bins={histogram.bins}
            min={histogram.min}
            max={histogram.max}
            zeroIndex={histogram.zeroIndex}
          />
        </div>
      )}

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
    </>
  );
}

type BucketStats = {
  count: number;
  winRate: number;
  expectancyPercent: number;
  avgWinPercent: number;
  avgLossPercent: number;
  largestWinPercent: number;
  largestLossPercent: number;
  profitFactor: number;
  avgHoldingDays: number;
  /**
   * Side-specific market exposure %. Computed from the filtered trades'
   * merged `(entry, exit)` intervals against the backtest's candle span;
   * surfacing core's aggregate `exposurePercent` in the long/short columns
   * would mislead because they would each show *total* time-in-market.
   */
  exposurePercent: number;
};

type SpanInfo = { firstBarTime: number; lastBarTime: number };

function bucketStats(trades: Trade[], side: "all" | "long" | "short", span: SpanInfo): BucketStats {
  const filtered = side === "all" ? trades : trades.filter((t) => (t.direction ?? "long") === side);
  if (filtered.length === 0) {
    return {
      count: 0,
      winRate: 0,
      expectancyPercent: 0,
      avgWinPercent: 0,
      avgLossPercent: 0,
      largestWinPercent: 0,
      largestLossPercent: 0,
      profitFactor: 0,
      avgHoldingDays: 0,
      exposurePercent: 0,
    };
  }
  const wins = filtered.filter((t) => t.return > 0);
  const losses = filtered.filter((t) => t.return <= 0);
  const grossWin = wins.reduce((s, t) => s + t.return, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.return, 0));
  return {
    count: filtered.length,
    winRate: (wins.length / filtered.length) * 100,
    expectancyPercent: filtered.reduce((s, t) => s + t.returnPercent, 0) / filtered.length,
    avgWinPercent:
      wins.length > 0 ? wins.reduce((s, t) => s + t.returnPercent, 0) / wins.length : 0,
    avgLossPercent:
      losses.length > 0
        ? Math.abs(losses.reduce((s, t) => s + t.returnPercent, 0) / losses.length)
        : 0,
    largestWinPercent: wins.length > 0 ? Math.max(...wins.map((t) => t.returnPercent)) : 0,
    largestLossPercent:
      losses.length > 0 ? Math.abs(Math.min(...losses.map((t) => t.returnPercent))) : 0,
    profitFactor:
      grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Number.POSITIVE_INFINITY : 0,
    avgHoldingDays: filtered.reduce((s, t) => s + t.holdingDays, 0) / filtered.length,
    exposurePercent: computeExposurePercent(filtered, span),
  };
}

/**
 * Side-aware exposure %: total holding time of `trades` (merging overlapping
 * `(entryTime, exitTime)` intervals so scale-out tranches sharing an entry
 * are not double-counted) divided by the candle span in days. Mirrors
 * core's `computeMergedExposureDays` so the "All" column lines up with
 * `result.exposurePercent` to within rounding; Studio computes it locally
 * because core doesn't expose per-direction exposure.
 */
function computeExposurePercent(trades: Trade[], span: SpanInfo): number {
  if (trades.length === 0) return 0;
  const spanMs = span.lastBarTime - span.firstBarTime;
  if (spanMs <= 0) return 0;
  const intervals = trades
    .map((t) => ({ start: t.entryTime, end: t.exitTime }))
    .sort((a, b) => a.start - b.start);
  let totalMs = 0;
  let curStart = intervals[0].start;
  let curEnd = intervals[0].end;
  for (let i = 1; i < intervals.length; i++) {
    const iv = intervals[i];
    if (iv.start > curEnd) {
      totalMs += curEnd - curStart;
      curStart = iv.start;
      curEnd = iv.end;
    } else if (iv.end > curEnd) {
      curEnd = iv.end;
    }
  }
  totalMs += curEnd - curStart;
  return Math.min(100, (totalMs / spanMs) * 100);
}

/**
 * Reconstruct the post-trade equity curve from the realized trade ledger.
 * `BacktestResult` doesn't expose the per-bar equity series, so we walk the
 * realized dollar P/L (`trade.return`) cumulatively starting at
 * `initialCapital`. Summing `return` (not compounding `returnPercent`) is
 * what guarantees the last value equals `finalCapital` even when partial
 * exits, scale-outs, slippage and commissions split a single position
 * across several `Trade` records — `returnPercent` is per-position,
 * compounding it would double-count tranches and disagree with the
 * engine's headline total return. Intra-trade unrealized swings are still
 * collapsed; per-bar equity needs an engine-side API we haven't shipped.
 */
function buildEquityCurve(result: BacktestResult): number[] {
  if (result.trades.length === 0) return [];
  const out: number[] = [result.initialCapital];
  let equity = result.initialCapital;
  for (const t of result.trades) {
    equity += t.return;
    out.push(equity);
  }
  return out;
}

function buildUnderwaterCurve(equity: number[]): number[] {
  if (equity.length === 0) return [];
  const out: number[] = [];
  let peak = equity[0];
  for (const v of equity) {
    if (v > peak) peak = v;
    out.push(peak > 0 ? ((v - peak) / peak) * 100 : 0);
  }
  return out;
}

type HistogramData = {
  bins: { count: number; lo: number; hi: number }[];
  min: number;
  max: number;
  zeroIndex: number;
};

function buildHistogram(trades: Trade[], binCount = 21): HistogramData {
  if (trades.length === 0) {
    return { bins: [], min: 0, max: 0, zeroIndex: 0 };
  }
  const returns = trades.map((t) => t.returnPercent);
  let min = Math.min(...returns);
  let max = Math.max(...returns);
  // Always span zero so the histogram visually anchors win/loss separation.
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    count: 0,
    lo: min + i * width,
    hi: min + (i + 1) * width,
  }));
  for (const r of returns) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((r - min) / width)));
    bins[idx].count++;
  }
  const zeroIndex = Math.min(binCount - 1, Math.max(0, Math.floor((0 - min) / width)));
  return { bins, min, max, zeroIndex };
}

function Histogram({
  bins,
  min,
  max,
  zeroIndex,
}: {
  bins: { count: number; lo: number; hi: number }[];
  min: number;
  max: number;
  zeroIndex: number;
}) {
  const peak = Math.max(1, ...bins.map((b) => b.count));
  const W = 320;
  const H = 70;
  const bw = W / bins.length;
  return (
    <svg
      width={W}
      height={H}
      role="img"
      aria-label={`Trade return histogram from ${min.toFixed(1)}% to ${max.toFixed(1)}%`}
    >
      <title>Histogram of trade returns (%)</title>
      {bins.map((b, i) => {
        const h = (b.count / peak) * (H - 14);
        const x = i * bw;
        const y = H - 14 - h;
        const isLoss = i < zeroIndex || (i === zeroIndex && b.lo < 0 && b.hi <= 0);
        return (
          <rect
            key={i}
            x={x + 0.5}
            y={y}
            width={Math.max(0, bw - 1)}
            height={h}
            fill={isLoss ? "#ef5350" : "#26a69a"}
            opacity={0.85}
          />
        );
      })}
      {/* baseline */}
      <line x1={0} y1={H - 14} x2={W} y2={H - 14} stroke="#2a2e39" strokeWidth={1} />
      <text x={2} y={H - 2} fontSize={9} fill="#787b86">
        {min.toFixed(1)}%
      </text>
      <text x={W - 2} y={H - 2} fontSize={9} fill="#787b86" textAnchor="end">
        {max.toFixed(1)}%
      </text>
    </svg>
  );
}

function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function formatRatio(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function formatMoney(v: number): string {
  const sign = v >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
