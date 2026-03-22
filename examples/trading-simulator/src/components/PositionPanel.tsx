import { useMemo } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { formatPrice } from "../types";
import { formatDate } from "../utils/fileParser";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function PositionPanel() {
  const {
    symbols,
    activeSymbolId,
    getPositionSummary,
    getShortPositionSummary,
    getUnrealizedPnl,
    getTotalPnl,
    getYearHighLow,
    getHoldingDays,
    trailingStopEnabled,
  } = useSimulatorStore();

  // Get the active symbol
  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  const activeCurrency = activeSymbol?.currency ?? "JPY";
  const positions = activeSymbol?.positions || [];
  const tradeHistory = activeSymbol?.tradeHistory || [];

  const positionSummary = getPositionSummary();
  const shortSummary = getShortPositionSummary();
  const longPositions = positions.filter((p) => p.direction !== "short");
  const shortPositions = positions.filter((p) => p.direction === "short");
  const unrealizedPnl = getUnrealizedPnl();
  const totalPnl = getTotalPnl();
  const tradeCount = tradeHistory.filter(
    (t) => t.type === "SELL" || t.type === "BUY_TO_COVER",
  ).length;
  const yearHighLow = getYearHighLow();
  const holdingDays = getHoldingDays();

  return (
    <div className="position-panel">
      <CollapsiblePanel title="Position" storageKey="position">
        {longPositions.length > 0 && positionSummary ? (
          <div className="position-status long">
            <div className="status-label">
              Long ({longPositions.length} entries)
              {holdingDays !== null && <span className="holding-days">Day {holdingDays}</span>}
            </div>
            <div className="position-summary">
              <div className="summary-row">
                <span className="label">Shares</span>
                <span className="value">{positionSummary.totalShares}</span>
              </div>
              <div className="summary-row">
                <span className="label">Avg Entry</span>
                <span className="value">
                  {positionSummary.avgEntryPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="summary-row">
                <span className="label">Total Cost</span>
                <span className="value">
                  {positionSummary.totalCost.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>
            {unrealizedPnl && (
              <div className={`pnl ${unrealizedPnl.pnl >= 0 ? "positive" : "negative"}`}>
                Unrealized: {unrealizedPnl.pnl >= 0 ? "+" : ""}
                {unrealizedPnl.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} (
                {unrealizedPnl.pnlPercent >= 0 ? "+" : ""}
                {unrealizedPnl.pnlPercent.toFixed(2)}%)
              </div>
            )}

            {trailingStopEnabled && longPositions.some((p) => p.trailingStopPrice) && (
              <div className="trailing-stop-info">
                <span className="label">Trailing Stop</span>
                <span className="value">
                  {formatPrice(
                    Math.max(
                      ...longPositions
                        .filter((p) => p.trailingStopPrice)
                        .map((p) => p.trailingStopPrice as number),
                    ),
                    activeCurrency,
                  )}
                </span>
              </div>
            )}

            {longPositions.length > 1 && (
              <div className="position-list">
                <div className="list-header">Entry History</div>
                {longPositions.map((pos, idx) => (
                  <div key={pos.id} className="position-item">
                    <span className="item-num">#{idx + 1}</span>
                    <span className="item-shares">{pos.shares}</span>
                    <span className="item-price">@{pos.entryPrice.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !shortSummary ? (
          <div className="no-position">No position</div>
        ) : null}

        {/* Short Position */}
        {shortPositions.length > 0 && shortSummary && (
          <div className="position-status short">
            <div className="status-label">Short ({shortPositions.length} entries)</div>
            <div className="position-summary">
              <div className="summary-row">
                <span className="label">Shares</span>
                <span className="value">{shortSummary.totalShares}</span>
              </div>
              <div className="summary-row">
                <span className="label">Avg Entry</span>
                <span className="value">
                  {shortSummary.avgEntryPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>

            {trailingStopEnabled && shortPositions.some((p) => p.trailingStopPrice) && (
              <div className="trailing-stop-info">
                <span className="label">Trailing Stop</span>
                <span className="value">
                  {formatPrice(
                    Math.min(
                      ...shortPositions
                        .filter((p) => p.trailingStopPrice)
                        .map((p) => p.trailingStopPrice as number),
                    ),
                    activeCurrency,
                  )}
                </span>
              </div>
            )}

            {shortPositions.length > 1 && (
              <div className="position-list">
                <div className="list-header">Short Entry History</div>
                {shortPositions.map((pos, idx) => (
                  <div key={pos.id} className="position-item">
                    <span className="item-num">#{idx + 1}</span>
                    <span className="item-shares">{pos.shares}</span>
                    <span className="item-price">@{pos.entryPrice.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tradeCount > 0 && (
          <div className="total-pnl">
            <span className="label">Realized ({tradeCount})</span>
            <span className={`value ${totalPnl >= 0 ? "positive" : "negative"}`}>
              {totalPnl >= 0 ? "+" : ""}
              {totalPnl.toLocaleString()}
            </span>
          </div>
        )}

        {yearHighLow && (
          <div className="year-high-low">
            <h3>YTD Range</h3>
            <div className="year-stat">
              <span className="label">High</span>
              <span className="value high">{yearHighLow.yearHigh.toLocaleString()}</span>
              <span className="date">({formatDate(yearHighLow.yearHighDate)})</span>
            </div>
            <div className="year-stat">
              <span className="label">Low</span>
              <span className="value low">{yearHighLow.yearLow.toLocaleString()}</span>
              <span className="date">({formatDate(yearHighLow.yearLowDate)})</span>
            </div>
            <div className="year-stat current">
              <span className="label">Current</span>
              <span className="value">{yearHighLow.currentPrice.toLocaleString()}</span>
            </div>
            <div className="year-position">
              <span className={`from-value ${yearHighLow.fromHigh >= 0 ? "positive" : "negative"}`}>
                From High {yearHighLow.fromHigh >= 0 ? "+" : ""}
                {yearHighLow.fromHigh.toFixed(1)}%
              </span>
              <span className={`from-value ${yearHighLow.fromLow >= 0 ? "positive" : "negative"}`}>
                From Low {yearHighLow.fromLow >= 0 ? "+" : ""}
                {yearHighLow.fromLow.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </CollapsiblePanel>
    </div>
  );
}
