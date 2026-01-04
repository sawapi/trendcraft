import { useSimulatorStore } from "../store/simulatorStore";
import { formatDate } from "../utils/fileParser";
import { PRICE_TYPE_LABELS } from "../types";

export function TradeHistoryPanel() {
  const { tradeHistory } = useSimulatorStore();

  if (tradeHistory.length === 0) {
    return (
      <div className="trade-history-panel">
        <h3>取引履歴</h3>
        <p className="no-trades">まだ取引がありません</p>
      </div>
    );
  }

  return (
    <div className="trade-history-panel">
      <h3>取引履歴 ({tradeHistory.length}件)</h3>
      <div className="trade-list">
        {tradeHistory
          .slice()
          .reverse()
          .map((trade) => (
            <div
              key={trade.id}
              className={`trade-item ${trade.type.toLowerCase()}`}
            >
              <div className="trade-header">
                <span className={`trade-type ${trade.type.toLowerCase()}`}>
                  {trade.type}
                </span>
                <span className="trade-date">{formatDate(trade.date)}</span>
              </div>
              <div className="trade-details">
                <span className="trade-price">
                  ¥{trade.price.toLocaleString()}
                </span>
                <span className="trade-shares">×{trade.shares}株</span>
                <span className="trade-price-type">
                  ({PRICE_TYPE_LABELS[trade.priceType]})
                </span>
              </div>
              {trade.type === "SELL" && trade.pnlPercent !== undefined && (
                <div
                  className={`trade-pnl ${trade.pnlPercent >= 0 ? "positive" : "negative"}`}
                >
                  {trade.pnlPercent >= 0 ? "+" : ""}
                  {trade.pnlPercent.toFixed(2)}% (¥
                  {trade.pnl?.toLocaleString()})
                </div>
              )}
              {trade.memo && <div className="trade-memo">{trade.memo}</div>}
            </div>
          ))}
      </div>
    </div>
  );
}
