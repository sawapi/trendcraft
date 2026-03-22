import { useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { EXIT_REASON_LABELS } from "../types";
import { analyzeAllTrades } from "../utils/tradeAnalyzer";

export function TradeAnalysis() {
  const [isOpen, setIsOpen] = useState(false);
  const { tradeHistory } = useSimulatorStore();

  const analysis = useMemo(() => {
    return analyzeAllTrades(tradeHistory);
  }, [tradeHistory]);

  const hasTrades = tradeHistory.filter((t) => t.type === "SELL").length > 0;

  if (!hasTrades) return null;

  return (
    <div className="trade-analysis">
      <button className="analysis-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className="material-icons">analytics</span>
        Trade Analysis
        <span className="material-icons toggle-icon">{isOpen ? "expand_less" : "expand_more"}</span>
      </button>

      {isOpen && (
        <div className="analysis-content">
          {/* Exit Reason Analysis */}
          <div className="analysis-section">
            <h4>By Exit Reason</h4>
            <div className="analysis-table">
              {analysis.exitReasons.map((item) => (
                <div key={item.reason} className="analysis-row">
                  <span className="label">{EXIT_REASON_LABELS[item.reason]}</span>
                  <span className="count">{item.count}</span>
                  <span className={`win-rate ${item.winRate >= 50 ? "positive" : "negative"}`}>
                    {item.winRate.toFixed(0)}%
                  </span>
                  <span className={`avg-pnl ${item.avgPnl >= 0 ? "positive" : "negative"}`}>
                    {item.avgPnl >= 0 ? "+" : ""}
                    {item.avgPnl.toFixed(1)}%
                  </span>
                </div>
              ))}
              {analysis.exitReasons.length === 0 && <div className="no-data">No data</div>}
            </div>
          </div>

          {/* Holding Period Analysis */}
          <div className="analysis-section">
            <h4>By Holding Period</h4>
            <div className="analysis-table">
              {analysis.holdingPeriods.map((item) => (
                <div key={item.label} className="analysis-row">
                  <span className="label">{item.label}</span>
                  <span className="count">{item.count}</span>
                  <span className={`win-rate ${item.winRate >= 50 ? "positive" : "negative"}`}>
                    {item.winRate.toFixed(0)}%
                  </span>
                  <span className={`avg-pnl ${item.avgPnl >= 0 ? "positive" : "negative"}`}>
                    {item.avgPnl >= 0 ? "+" : ""}
                    {item.avgPnl.toFixed(1)}%
                  </span>
                </div>
              ))}
              {analysis.holdingPeriods.length === 0 && <div className="no-data">No data</div>}
            </div>
          </div>

          {/* Market Regime Analysis */}
          <div className="analysis-section">
            <h4>By Market Regime</h4>
            <div className="analysis-table">
              {analysis.marketRegimes.map((item) => (
                <div key={item.regime} className="analysis-row">
                  <span className="label">{item.label}</span>
                  <span className="count">{item.count}</span>
                  <span className={`win-rate ${item.winRate >= 50 ? "positive" : "negative"}`}>
                    {item.winRate.toFixed(0)}%
                  </span>
                  <span className={`avg-pnl ${item.avgPnl >= 0 ? "positive" : "negative"}`}>
                    {item.avgPnl >= 0 ? "+" : ""}
                    {item.avgPnl.toFixed(1)}%
                  </span>
                </div>
              ))}
              {analysis.marketRegimes.length === 0 && <div className="no-data">No data</div>}
            </div>
          </div>

          {/* Day of Week Analysis */}
          <div className="analysis-section">
            <h4>By Day of Week</h4>
            <div className="analysis-table day-of-week">
              <div className="dow-header">
                <span className="label">Day</span>
                <span className="header-group">
                  <span className="sub-header">Entry</span>
                  <span className="sub-header">Exit</span>
                </span>
              </div>
              {analysis.dayOfWeek.map((item) => (
                <div key={item.dayOfWeek} className="analysis-row dow-row">
                  <span className="label">{item.label}</span>
                  <span className="dow-stats">
                    <span className="dow-entry">
                      <span className="count">{item.entryCount}</span>
                      <span
                        className={`win-rate ${item.entryWinRate >= 50 ? "positive" : "negative"}`}
                      >
                        {item.entryCount > 0 ? `${item.entryWinRate.toFixed(0)}%` : "-"}
                      </span>
                    </span>
                    <span className="dow-exit">
                      <span className="count">{item.exitCount}</span>
                      <span
                        className={`win-rate ${item.exitWinRate >= 50 ? "positive" : "negative"}`}
                      >
                        {item.exitCount > 0 ? `${item.exitWinRate.toFixed(0)}%` : "-"}
                      </span>
                    </span>
                  </span>
                </div>
              ))}
              {analysis.dayOfWeek.length === 0 && <div className="no-data">No data</div>}
            </div>
          </div>

          {/* Month Analysis */}
          <div className="analysis-section">
            <h4>By Month</h4>
            <div className="analysis-table month-table">
              {analysis.months.map((item) => (
                <div key={item.month} className="analysis-row">
                  <span className="label">{item.label}</span>
                  <span className="count">{item.count}</span>
                  <span className={`win-rate ${item.winRate >= 50 ? "positive" : "negative"}`}>
                    {item.winRate.toFixed(0)}%
                  </span>
                  <span className={`avg-pnl ${item.avgPnl >= 0 ? "positive" : "negative"}`}>
                    {item.avgPnl >= 0 ? "+" : ""}
                    {item.avgPnl.toFixed(1)}%
                  </span>
                </div>
              ))}
              {analysis.months.length === 0 && <div className="no-data">No data</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
