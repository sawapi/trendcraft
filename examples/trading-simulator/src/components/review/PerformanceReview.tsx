import { useMemo } from "react";
import { type BehaviorInsight, analyzeBehavior } from "../../engine/behaviorAnalyzer";
import { useSimulatorStore } from "../../store/simulatorStore";
import { formatPrice } from "../../types";
import { TradeReplay } from "./TradeReplay";

const TYPE_STYLES: Record<BehaviorInsight["type"], { icon: string; borderColor: string }> = {
  strength: { icon: "\u2714", borderColor: "#22c55e" },
  weakness: { icon: "\u26A0", borderColor: "#ef4444" },
  info: { icon: "\u2139", borderColor: "#3b82f6" },
};

function InsightCard({ insight }: { insight: BehaviorInsight }) {
  const style = TYPE_STYLES[insight.type];
  return (
    <div className="insight-card" style={{ borderLeftColor: style.borderColor }}>
      <div className="insight-header">
        <span className="insight-icon">{style.icon}</span>
        <span className="insight-title">{insight.title}</span>
        {insight.metric && <span className="insight-metric">{insight.metric}</span>}
      </div>
      <p className="insight-description">{insight.description}</p>
    </div>
  );
}

export function PerformanceReview() {
  const symbols = useSimulatorStore((s) => s.symbols);
  const activeSymbolId = useSimulatorStore((s) => s.activeSymbolId);
  const reset = useSimulatorStore((s) => s.reset);

  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  const insights = useMemo(() => {
    if (!activeSymbol) return [];
    return analyzeBehavior(activeSymbol.tradeHistory, activeSymbol.equityCurve);
  }, [activeSymbol]);

  const activeCurrency = activeSymbol?.currency ?? "JPY";

  const sellTrades = useMemo(() => {
    if (!activeSymbol) return [];
    return activeSymbol.tradeHistory.filter((t) => t.type === "SELL" || t.type === "BUY_TO_COVER");
  }, [activeSymbol]);

  const profitFactor = useMemo(() => {
    const wins = sellTrades.filter((t) => (t.pnlPercent || 0) > 0);
    const losses = sellTrades.filter((t) => (t.pnlPercent || 0) <= 0);
    const grossProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
    if (grossLoss === 0) return grossProfit > 0 ? 999.99 : 0;
    return grossProfit / grossLoss;
  }, [sellTrades]);

  if (!activeSymbol) {
    return (
      <div className="performance-review">
        <p>No data available.</p>
      </div>
    );
  }

  const strengths = insights.filter((i) => i.type === "strength");
  const weaknesses = insights.filter((i) => i.type === "weakness");
  const infos = insights.filter((i) => i.type === "info");

  return (
    <div className="performance-review">
      <div className="review-header">
        <h2>Performance Review</h2>
        <button className="reset-btn" onClick={reset}>
          New Session
        </button>
      </div>

      <div className="review-summary">
        <div className="summary-stat">
          <span className="summary-label">Total Trades</span>
          <span className="summary-value">{sellTrades.length}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Win Rate</span>
          <span className="summary-value">
            {sellTrades.length > 0
              ? `${((sellTrades.filter((t) => (t.pnlPercent || 0) > 0).length / sellTrades.length) * 100).toFixed(0)}%`
              : "N/A"}
          </span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Total P&L</span>
          <span
            className={`summary-value ${
              sellTrades.reduce((s, t) => s + (t.pnl || 0), 0) >= 0 ? "positive" : "negative"
            }`}
          >
            {formatPrice(
              sellTrades.reduce((s, t) => s + (t.pnl || 0), 0),
              activeCurrency,
            )}
          </span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Profit Factor</span>
          <span className={`summary-value ${profitFactor >= 1 ? "positive" : "negative"}`}>
            {profitFactor.toFixed(2)}
          </span>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="review-empty">
          Not enough trades to generate behavior insights. Complete more trades for analysis.
        </div>
      ) : (
        <div className="review-sections">
          {strengths.length > 0 && (
            <div className="review-section">
              <h3>Strengths</h3>
              {strengths.map((i, idx) => (
                <InsightCard key={idx} insight={i} />
              ))}
            </div>
          )}
          {weaknesses.length > 0 && (
            <div className="review-section">
              <h3>Areas for Improvement</h3>
              {weaknesses.map((i, idx) => (
                <InsightCard key={idx} insight={i} />
              ))}
            </div>
          )}
          {infos.length > 0 && (
            <div className="review-section">
              <h3>Observations</h3>
              {infos.map((i, idx) => (
                <InsightCard key={idx} insight={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trade Replay */}
      {sellTrades.length > 0 && (
        <div className="review-section">
          <h3>Trade Replay</h3>
          <TradeReplay trades={activeSymbol.tradeHistory} currency={activeCurrency} />
        </div>
      )}
    </div>
  );
}
