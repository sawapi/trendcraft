import { useMemo } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { PRICE_TYPE_LABELS, formatPrice } from "../types";
import { formatDate } from "../utils/fileParser";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function TradeHistoryPanel() {
  const { symbols, activeSymbolId, jumpToIndex } = useSimulatorStore();

  // Get the active symbol
  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  const activeCurrency = activeSymbol?.currency ?? "JPY";
  const tradeHistory = activeSymbol?.tradeHistory || [];
  const allCandles = activeSymbol?.allCandles || [];

  const handleTradeClick = (tradeDate: number) => {
    // Find the index corresponding to the trade date
    const targetIndex = allCandles.findIndex((c) => c.time === tradeDate);
    if (targetIndex !== -1) {
      jumpToIndex(targetIndex);
    }
  };

  if (tradeHistory.length === 0) {
    return (
      <div className="trade-history-panel">
        <CollapsiblePanel title="Trade History" storageKey="trade-history">
          <p className="no-trades">No trades yet</p>
        </CollapsiblePanel>
      </div>
    );
  }

  return (
    <div className="trade-history-panel">
      <CollapsiblePanel title={`Trade History (${tradeHistory.length})`} storageKey="trade-history">
        <div className="trade-list">
          {tradeHistory
            .slice()
            .reverse()
            .map((trade) => (
              <div
                key={trade.id}
                className={`trade-item ${trade.type.toLowerCase()} clickable`}
                onClick={() => handleTradeClick(trade.date)}
                onKeyDown={(e) => e.key === "Enter" && handleTradeClick(trade.date)}
                role="button"
                tabIndex={0}
                title="Click to jump to this date"
              >
                <div className="trade-header">
                  <span className={`trade-type ${trade.type.toLowerCase()}`}>{trade.type}</span>
                  <span className="trade-date">{formatDate(trade.date)}</span>
                </div>
                <div className="trade-details">
                  <span className="trade-price">{formatPrice(trade.price, activeCurrency)}</span>
                  <span className="trade-shares">×{trade.shares}</span>
                  <span className="trade-price-type">({PRICE_TYPE_LABELS[trade.priceType]})</span>
                </div>
                {(trade.type === "SELL" || trade.type === "BUY_TO_COVER") &&
                  trade.pnlPercent !== undefined && (
                    <div className={`trade-pnl ${trade.pnlPercent >= 0 ? "positive" : "negative"}`}>
                      {trade.pnlPercent >= 0 ? "+" : ""}
                      {trade.pnlPercent.toFixed(2)}%
                      {trade.tax && trade.tax > 0 ? (
                        <span className="trade-tax-info">
                          {" "}
                          (after tax: {formatPrice(trade.afterTaxPnl || 0, activeCurrency)})
                        </span>
                      ) : (
                        <span> ({formatPrice(trade.pnl || 0, activeCurrency)})</span>
                      )}
                    </div>
                  )}
                {trade.memo && <div className="trade-memo">{trade.memo}</div>}
              </div>
            ))}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
