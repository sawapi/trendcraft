/**
 * Trade Analysis Panel - Detailed trade analysis with charts and tables
 *
 * Shows MFE/MAE scatter, holding period bar chart, time analysis table,
 * streak analysis, and exit reason pie chart.
 */

import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { TradeAnalysis } from "trendcraft";

// Day of week labels (0=Sunday)
const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

// Month labels (1-12)
const MONTH_LABELS: Record<number, string> = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec",
};

// Exit reason display labels
const EXIT_REASON_LABELS: Record<string, string> = {
  signal: "Signal",
  stopLoss: "Stop Loss",
  takeProfit: "Take Profit",
  trailing: "Trailing Stop",
  breakeven: "Breakeven",
  scaleOut: "Scale Out",
  partialTakeProfit: "Partial TP",
  timeExit: "Time Exit",
  endOfData: "End of Data",
};

type Props = {
  analysis: TradeAnalysis;
  trades: { mfe?: number; mae?: number; returnPercent: number }[];
};

/**
 * Build MFE/MAE scatter chart option
 */
function buildMfeMaeChart(
  trades: { mfe?: number; mae?: number; returnPercent: number }[],
): EChartsOption | null {
  const scatterData = trades
    .filter((t) => t.mfe !== undefined && t.mae !== undefined)
    .map((t) => [t.mae ?? 0, t.mfe ?? 0, t.returnPercent]);

  if (scatterData.length === 0) return null;

  return {
    backgroundColor: "transparent",
    animation: false,
    title: {
      text: "MFE / MAE Scatter",
      left: 5,
      top: 0,
      textStyle: { color: "#888", fontSize: 11, fontWeight: "normal" },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(0,0,0,0.8)",
      borderColor: "#333",
      textStyle: { color: "#fff", fontSize: 11 },
      formatter: (params) => {
        const p = params as { value: number[] };
        return `MAE: ${p.value[0].toFixed(1)}%<br/>MFE: ${p.value[1].toFixed(1)}%<br/>Return: ${p.value[2] >= 0 ? "+" : ""}${p.value[2].toFixed(1)}%`;
      },
    },
    grid: { left: 45, right: 15, top: 30, bottom: 35 },
    xAxis: {
      type: "value",
      name: "MAE %",
      nameLocation: "middle",
      nameGap: 22,
      nameTextStyle: { color: "#888", fontSize: 10 },
      axisLine: { lineStyle: { color: "#444" } },
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#888", fontSize: 9 },
    },
    yAxis: {
      type: "value",
      name: "MFE %",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: "#888", fontSize: 10 },
      axisLine: { lineStyle: { color: "#444" } },
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#888", fontSize: 9 },
    },
    series: [
      {
        type: "scatter",
        data: scatterData,
        symbolSize: 6,
        itemStyle: {
          color: (params) => {
            const val = (params.value as number[])[2];
            return val >= 0 ? "rgba(38, 166, 154, 0.7)" : "rgba(239, 83, 80, 0.7)";
          },
        },
      },
    ],
  };
}

/**
 * Build holding period bar chart option
 */
function buildHoldingPeriodChart(analysis: TradeAnalysis): EChartsOption | null {
  const data = analysis.byHoldingPeriod;
  if (data.length === 0) return null;

  const periods = data.map((d) => d.period);
  const avgReturns = data.map((d) => d.stats.avgReturn);
  const tradeCounts = data.map((d) => d.stats.tradeCount);

  return {
    backgroundColor: "transparent",
    animation: false,
    title: {
      text: "Returns by Holding Period",
      left: 5,
      top: 0,
      textStyle: { color: "#888", fontSize: 11, fontWeight: "normal" },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(0,0,0,0.8)",
      borderColor: "#333",
      textStyle: { color: "#fff", fontSize: 11 },
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        const p = items[0] as { name: string };
        const avgRet = items.find(
          (i) => (i as { seriesName: string }).seriesName === "Avg Return",
        ) as { value: number } | undefined;
        const count = items.find((i) => (i as { seriesName: string }).seriesName === "Trades") as
          | { value: number }
          | undefined;
        return `${p.name}<br/>Avg Return: ${avgRet?.value !== undefined ? `${avgRet.value >= 0 ? "+" : ""}${avgRet.value.toFixed(1)}%` : "N/A"}<br/>Trades: ${count?.value ?? "N/A"}`;
      },
    },
    grid: { left: 45, right: 40, top: 30, bottom: 25 },
    xAxis: {
      type: "category",
      data: periods,
      axisLine: { lineStyle: { color: "#444" } },
      axisLabel: { color: "#888", fontSize: 9 },
    },
    yAxis: [
      {
        type: "value",
        name: "Avg Return %",
        nameTextStyle: { color: "#888", fontSize: 9 },
        axisLine: { lineStyle: { color: "#444" } },
        splitLine: { lineStyle: { color: "#333" } },
        axisLabel: { color: "#888", fontSize: 9 },
      },
      {
        type: "value",
        name: "Trades",
        nameTextStyle: { color: "#888", fontSize: 9 },
        axisLine: { lineStyle: { color: "#444" } },
        splitLine: { show: false },
        axisLabel: { color: "#888", fontSize: 9 },
      },
    ],
    series: [
      {
        name: "Avg Return",
        type: "bar",
        data: avgReturns,
        barWidth: "40%",
        itemStyle: {
          color: (params) => {
            return (params.value as number) >= 0
              ? "rgba(38, 166, 154, 0.8)"
              : "rgba(239, 83, 80, 0.8)";
          },
        },
      },
      {
        name: "Trades",
        type: "line",
        yAxisIndex: 1,
        data: tradeCounts,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { color: "#888", width: 1 },
        itemStyle: { color: "#888" },
      },
    ],
  };
}

/**
 * Build exit reason pie chart option
 */
function buildExitReasonChart(analysis: TradeAnalysis): EChartsOption | null {
  const data = analysis.byExitReason;
  if (data.length === 0) return null;

  const COLORS = [
    "#4ecdc4",
    "#e94560",
    "#ff9f43",
    "#a29bfe",
    "#6c5ce7",
    "#00cec9",
    "#fd79a8",
    "#ffeaa7",
    "#dfe6e9",
  ];

  const pieData = data.map((d, i) => ({
    name: EXIT_REASON_LABELS[d.reason] ?? d.reason,
    value: d.stats.tradeCount,
    itemStyle: { color: COLORS[i % COLORS.length] },
  }));

  return {
    backgroundColor: "transparent",
    animation: false,
    title: {
      text: "Exit Reasons",
      left: 5,
      top: 0,
      textStyle: { color: "#888", fontSize: 11, fontWeight: "normal" },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(0,0,0,0.8)",
      borderColor: "#333",
      textStyle: { color: "#fff", fontSize: 11 },
      formatter: (params) => {
        const p = params as { name: string; value: number; percent: number };
        return `${p.name}: ${p.value} trades (${p.percent.toFixed(1)}%)`;
      },
    },
    series: [
      {
        type: "pie",
        radius: ["30%", "60%"],
        center: ["50%", "55%"],
        data: pieData,
        label: {
          color: "#aaa",
          fontSize: 9,
          formatter: "{b}: {c}",
        },
        labelLine: { lineStyle: { color: "#555" } },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };
}

export function TradeAnalysisPanel({ analysis, trades }: Props) {
  const mfeMaeChart = useMemo(() => buildMfeMaeChart(trades), [trades]);
  const holdingPeriodChart = useMemo(() => buildHoldingPeriodChart(analysis), [analysis]);
  const exitReasonChart = useMemo(() => buildExitReasonChart(analysis), [analysis]);

  // Build time analysis tables
  const dayOfWeekData = useMemo(() => {
    const rows: { day: string; trades: number; winRate: number; avgReturn: number }[] = [];
    // Iterate Monday(1) through Friday(5) - typical trading days
    for (let d = 1; d <= 5; d++) {
      const stats = analysis.byTime.dayOfWeek.get(d);
      if (stats) {
        rows.push({
          day: DAY_LABELS[d],
          trades: stats.tradeCount,
          winRate: stats.winRate,
          avgReturn: stats.avgReturn,
        });
      }
    }
    // Also include weekends if data exists
    for (const d of [0, 6]) {
      const stats = analysis.byTime.dayOfWeek.get(d);
      if (stats) {
        rows.push({
          day: DAY_LABELS[d],
          trades: stats.tradeCount,
          winRate: stats.winRate,
          avgReturn: stats.avgReturn,
        });
      }
    }
    return rows;
  }, [analysis]);

  const monthData = useMemo(() => {
    const rows: { month: string; trades: number; winRate: number; avgReturn: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const stats = analysis.byTime.month.get(m);
      if (stats) {
        rows.push({
          month: MONTH_LABELS[m],
          trades: stats.tradeCount,
          winRate: stats.winRate,
          avgReturn: stats.avgReturn,
        });
      }
    }
    return rows;
  }, [analysis]);

  // Exit reason details table
  const exitReasonDetails = useMemo(() => {
    return analysis.byExitReason.map((d) => ({
      reason: EXIT_REASON_LABELS[d.reason] ?? d.reason,
      trades: d.stats.tradeCount,
      winRate: d.stats.winRate,
      avgReturn: d.stats.avgReturn,
      profitFactor: d.stats.profitFactor,
    }));
  }, [analysis]);

  return (
    <div className="trade-analysis-panel">
      {/* Overall Stats */}
      <div className="analysis-section">
        <div className="analysis-section-header">Overall Statistics</div>
        <div className="analysis-stats-grid">
          <div className="analysis-stat">
            <span className="analysis-stat-label">Expectancy</span>
            <span
              className={`analysis-stat-value ${analysis.overall.expectancy >= 0 ? "positive" : "negative"}`}
            >
              {analysis.overall.expectancy >= 0 ? "+" : ""}
              {analysis.overall.expectancy.toFixed(2)}%
            </span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat-label">Avg Win</span>
            <span className="analysis-stat-value positive">
              +{analysis.overall.avgWin.toFixed(2)}%
            </span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat-label">Avg Loss</span>
            <span className="analysis-stat-value negative">
              {analysis.overall.avgLoss.toFixed(2)}%
            </span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat-label">Profit Factor</span>
            <span className="analysis-stat-value">{analysis.overall.profitFactor.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* MFE/MAE Analysis */}
      {analysis.mfeMae.avgMfe > 0 && (
        <div className="analysis-section">
          <div className="analysis-section-header">MFE / MAE</div>
          <div className="analysis-stats-grid cols-3">
            <div className="analysis-stat">
              <span className="analysis-stat-label">Avg MFE</span>
              <span className="analysis-stat-value positive">
                +{analysis.mfeMae.avgMfe.toFixed(1)}%
              </span>
            </div>
            <div className="analysis-stat">
              <span className="analysis-stat-label">Avg MAE</span>
              <span className="analysis-stat-value negative">
                -{analysis.mfeMae.avgMae.toFixed(1)}%
              </span>
            </div>
            <div className="analysis-stat">
              <span className="analysis-stat-label">MFE Util.</span>
              <span className="analysis-stat-value">
                {analysis.mfeMae.avgMfeUtilization.toFixed(0)}%
              </span>
            </div>
          </div>
          {mfeMaeChart && (
            <div className="analysis-chart-container">
              <ReactECharts
                option={mfeMaeChart}
                style={{ height: "160px", width: "100%" }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
          )}
        </div>
      )}

      {/* Holding Period */}
      {holdingPeriodChart && (
        <div className="analysis-section">
          <div className="analysis-section-header">Holding Period</div>
          <div className="analysis-chart-container">
            <ReactECharts
              option={holdingPeriodChart}
              style={{ height: "140px", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        </div>
      )}

      {/* Streak Analysis */}
      <div className="analysis-section">
        <div className="analysis-section-header">Streaks</div>
        <div className="analysis-stats-grid">
          <div className="analysis-stat">
            <span className="analysis-stat-label">Max Win</span>
            <span className="analysis-stat-value positive">{analysis.streaks.maxWinStreak}</span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat-label">Max Loss</span>
            <span className="analysis-stat-value negative">{analysis.streaks.maxLossStreak}</span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat-label">Avg Win</span>
            <span className="analysis-stat-value">{analysis.streaks.avgWinStreak.toFixed(1)}</span>
          </div>
          <div className="analysis-stat">
            <span className="analysis-stat-label">Avg Loss</span>
            <span className="analysis-stat-value">{analysis.streaks.avgLossStreak.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Exit Reason */}
      {exitReasonChart && (
        <div className="analysis-section">
          <div className="analysis-section-header">Exit Reasons</div>
          <div className="analysis-chart-container">
            <ReactECharts
              option={exitReasonChart}
              style={{ height: "160px", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
          {exitReasonDetails.length > 0 && (
            <div className="analysis-mini-table">
              <div className="mini-table-header">
                <span className="mini-col reason">Reason</span>
                <span className="mini-col">Trades</span>
                <span className="mini-col">Win%</span>
                <span className="mini-col">Avg Ret</span>
              </div>
              {exitReasonDetails.map((row) => (
                <div key={row.reason} className="mini-table-row">
                  <span className="mini-col reason">{row.reason}</span>
                  <span className="mini-col">{row.trades}</span>
                  <span className="mini-col">{row.winRate.toFixed(0)}%</span>
                  <span className={`mini-col ${row.avgReturn >= 0 ? "positive" : "negative"}`}>
                    {row.avgReturn >= 0 ? "+" : ""}
                    {row.avgReturn.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Time Analysis - Day of Week */}
      {dayOfWeekData.length > 0 && (
        <div className="analysis-section">
          <div className="analysis-section-header">Entry Day of Week</div>
          <div className="analysis-mini-table">
            <div className="mini-table-header">
              <span className="mini-col reason">Day</span>
              <span className="mini-col">Trades</span>
              <span className="mini-col">Win%</span>
              <span className="mini-col">Avg Ret</span>
            </div>
            {dayOfWeekData.map((row) => (
              <div key={row.day} className="mini-table-row">
                <span className="mini-col reason">{row.day}</span>
                <span className="mini-col">{row.trades}</span>
                <span className="mini-col">{row.winRate.toFixed(0)}%</span>
                <span className={`mini-col ${row.avgReturn >= 0 ? "positive" : "negative"}`}>
                  {row.avgReturn >= 0 ? "+" : ""}
                  {row.avgReturn.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Analysis - Month */}
      {monthData.length > 0 && (
        <div className="analysis-section">
          <div className="analysis-section-header">Entry Month</div>
          <div className="analysis-mini-table">
            <div className="mini-table-header">
              <span className="mini-col reason">Month</span>
              <span className="mini-col">Trades</span>
              <span className="mini-col">Win%</span>
              <span className="mini-col">Avg Ret</span>
            </div>
            {monthData.map((row) => (
              <div key={row.month} className="mini-table-row">
                <span className="mini-col reason">{row.month}</span>
                <span className="mini-col">{row.trades}</span>
                <span className="mini-col">{row.winRate.toFixed(0)}%</span>
                <span className={`mini-col ${row.avgReturn >= 0 ? "positive" : "negative"}`}>
                  {row.avgReturn >= 0 ? "+" : ""}
                  {row.avgReturn.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
