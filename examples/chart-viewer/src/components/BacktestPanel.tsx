/**
 * Backtest configuration and results panel
 */

import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { ENTRY_CONDITIONS, EXIT_CONDITIONS, useBacktest } from "../hooks/useBacktest";
import { useChartStore } from "../store/chartStore";
import { buildEquityCurve } from "../utils/backtestMarkers";

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Format large number to K/M format
 */
function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toFixed(0);
}

export function BacktestPanel() {
  const currentCandles = useChartStore((state) => state.currentCandles);
  const backtestConfig = useChartStore((state) => state.backtestConfig);
  const backtestResult = useChartStore((state) => state.backtestResult);
  const isBacktestRunning = useChartStore((state) => state.isBacktestRunning);
  const setBacktestConfig = useChartStore((state) => state.setBacktestConfig);
  const setBacktestResult = useChartStore((state) => state.setBacktestResult);
  const setIsBacktestRunning = useChartStore((state) => state.setIsBacktestRunning);

  const { run, clear } = useBacktest(
    currentCandles,
    backtestConfig,
    setBacktestResult,
    setIsBacktestRunning,
  );

  // Build equity curve chart option
  const equityChartOption = useMemo((): EChartsOption | null => {
    if (!backtestResult || backtestResult.trades.length === 0) return null;

    const equityData = buildEquityCurve(
      backtestResult.trades,
      backtestConfig.capital,
      currentCandles,
    );
    const dates = equityData.map((d) => d.date);
    const equityValues = equityData.map((d) => d.equity);

    return {
      backgroundColor: "transparent",
      animation: false,
      title: {
        text: "Equity Curve",
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
          const p = Array.isArray(params) ? params[0] : params;
          const value = (p as { value: number }).value;
          return `${(p as { name: string }).name}<br/>Equity: ${value.toLocaleString()}`;
        },
      },
      grid: { left: 50, right: 10, top: 25, bottom: 20 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "#444" } },
        axisLabel: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "#444" } },
        splitLine: { lineStyle: { color: "#333" } },
        axisLabel: {
          color: "#888",
          fontSize: 9,
          formatter: (value: number) => formatLargeNumber(value),
        },
      },
      series: [
        {
          name: "Equity",
          type: "line",
          data: equityValues,
          smooth: false,
          showSymbol: true,
          symbolSize: 4,
          lineStyle: { width: 1.5, color: "#4ecdc4" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(78, 205, 196, 0.3)" },
                { offset: 1, color: "rgba(78, 205, 196, 0.05)" },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#666", type: "dashed", width: 1 },
            label: { show: false },
            data: [{ yAxis: backtestConfig.capital }],
          },
        },
      ],
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
    };
  }, [backtestResult, backtestConfig.capital, currentCandles]);

  return (
    <div className="backtest-panel">
      <div className="backtest-header">Backtest</div>

      {/* Condition Selection */}
      <div className="backtest-conditions">
        <div className="condition-row">
          <label>Entry</label>
          <select
            value={backtestConfig.entryCondition}
            onChange={(e) => setBacktestConfig({ entryCondition: e.target.value })}
          >
            {Object.entries(ENTRY_CONDITIONS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="condition-row">
          <label>Exit</label>
          <select
            value={backtestConfig.exitCondition}
            onChange={(e) => setBacktestConfig({ exitCondition: e.target.value })}
          >
            {Object.entries(EXIT_CONDITIONS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Settings */}
      <details className="backtest-settings">
        <summary>Settings</summary>
        <div className="settings-grid">
          <div className="setting-row">
            <label>Capital</label>
            <input
              type="number"
              value={backtestConfig.capital}
              onChange={(e) => setBacktestConfig({ capital: Number(e.target.value) || 1000000 })}
            />
          </div>
          <div className="setting-row">
            <label>Stop Loss %</label>
            <input
              type="number"
              placeholder="Optional"
              value={backtestConfig.stopLoss ?? ""}
              onChange={(e) =>
                setBacktestConfig({
                  stopLoss: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="setting-row">
            <label>Take Profit %</label>
            <input
              type="number"
              placeholder="Optional"
              value={backtestConfig.takeProfit ?? ""}
              onChange={(e) =>
                setBacktestConfig({
                  takeProfit: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="setting-row">
            <label>Trailing Stop %</label>
            <input
              type="number"
              placeholder="Optional"
              value={backtestConfig.trailingStop ?? ""}
              onChange={(e) =>
                setBacktestConfig({
                  trailingStop: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="setting-row">
            <label>ATR Trail</label>
            <input
              type="number"
              placeholder="Multiplier"
              value={backtestConfig.atrTrailMultiplier ?? ""}
              onChange={(e) =>
                setBacktestConfig({
                  atrTrailMultiplier: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="setting-row">
            <label>Commission %</label>
            <input
              type="number"
              value={backtestConfig.commissionRate}
              onChange={(e) => setBacktestConfig({ commissionRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="setting-row">
            <label>Tax %</label>
            <input
              type="number"
              value={backtestConfig.taxRate}
              onChange={(e) => setBacktestConfig({ taxRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="setting-row">
            <label>Start Date</label>
            <input
              type="date"
              value={backtestConfig.startDate ?? ""}
              onChange={(e) =>
                setBacktestConfig({
                  startDate: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>
      </details>

      {/* Run Button */}
      <div className="backtest-actions">
        <button
          className="run-button"
          onClick={run}
          disabled={isBacktestRunning || currentCandles.length < 50}
        >
          {isBacktestRunning ? "Running..." : "Run Backtest"}
        </button>
        {backtestResult && (
          <button className="clear-button" onClick={clear}>
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {backtestResult && (
        <>
          <div className="backtest-results">
            <div className="result-grid">
              <div className="result-item">
                <span className="result-label">Return</span>
                <span
                  className={`result-value ${backtestResult.totalReturnPercent >= 0 ? "positive" : "negative"}`}
                >
                  {backtestResult.totalReturnPercent >= 0 ? "+" : ""}
                  {backtestResult.totalReturnPercent.toFixed(1)}%
                </span>
              </div>
              <div className="result-item">
                <span className="result-label">Win Rate</span>
                <span className="result-value">{backtestResult.winRate.toFixed(0)}%</span>
              </div>
              <div className="result-item">
                <span className="result-label">Trades</span>
                <span className="result-value">{backtestResult.tradeCount}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Max DD</span>
                <span className="result-value negative">
                  -{backtestResult.maxDrawdown.toFixed(1)}%
                </span>
              </div>
              <div className="result-item">
                <span className="result-label">Sharpe</span>
                <span className="result-value">{backtestResult.sharpeRatio.toFixed(2)}</span>
              </div>
              <div className="result-item">
                <span className="result-label">PF</span>
                <span className="result-value">{backtestResult.profitFactor.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Equity Chart */}
          {equityChartOption && (
            <div className="equity-chart-container">
              <ReactECharts
                option={equityChartOption}
                style={{ height: "100px", width: "100%" }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
          )}

          {/* Trades Table */}
          {backtestResult.trades.length > 0 && (
            <div className="trades-table">
              <div className="trades-header">Trades ({backtestResult.trades.length})</div>
              <div className="trades-list">
                {[...backtestResult.trades]
                  .sort((a, b) => b.exitTime - a.exitTime)
                  .slice(0, 20)
                  .map((trade, idx) => {
                    const isWin = trade.return > 0;
                    return (
                      <div key={idx} className={`trade-row ${isWin ? "win" : "loss"}`}>
                        <span className="trade-period">
                          {formatDate(trade.entryTime)} → {formatDate(trade.exitTime)}
                        </span>
                        <span className="trade-days">{trade.holdingDays}d</span>
                        <span className="trade-return">
                          {isWin ? "+" : ""}
                          {trade.returnPercent.toFixed(1)}%{trade.isPartial ? " (P)" : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
