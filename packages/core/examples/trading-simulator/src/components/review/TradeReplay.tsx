import { useMemo, useState } from "react";
import type { Currency, Trade } from "../../types";
import { EXIT_REASON_LABELS, formatPrice } from "../../types";

interface TradeReplayProps {
  trades: Trade[];
  currency?: Currency;
}

export function TradeReplay({ trades, currency = "JPY" }: TradeReplayProps) {
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const tradePairs = useMemo(() => {
    const pairs: { buy: Trade; sell: Trade }[] = [];
    let lastBuy: Trade | null = null;

    for (const t of trades) {
      if (t.type === "BUY" || t.type === "SHORT_SELL") {
        lastBuy = t;
      } else if ((t.type === "SELL" || t.type === "BUY_TO_COVER") && lastBuy) {
        pairs.push({ buy: lastBuy, sell: t });
        lastBuy = null;
      }
    }
    return pairs;
  }, [trades]);

  const selectedPair = tradePairs.find((p) => p.sell.id === selectedTradeId);

  return (
    <div className="trade-replay">
      <div className="trade-replay-list">
        {tradePairs.map((pair, idx) => {
          const pnlPercent = pair.sell.pnlPercent || 0;
          const won = pnlPercent > 0;

          return (
            <button
              key={pair.sell.id}
              className={`trade-replay-item ${selectedTradeId === pair.sell.id ? "selected" : ""} ${won ? "win" : "loss"}`}
              onClick={() =>
                setSelectedTradeId(selectedTradeId === pair.sell.id ? null : pair.sell.id)
              }
            >
              <span className="trade-replay-num">#{idx + 1}</span>
              <span className={`trade-replay-pnl ${won ? "positive" : "negative"}`}>
                {pnlPercent >= 0 ? "+" : ""}
                {pnlPercent.toFixed(1)}%
              </span>
              <span className="trade-replay-date">
                {new Date(pair.buy.date).toLocaleDateString()}
              </span>
            </button>
          );
        })}
      </div>

      {selectedPair && (
        <div className="trade-replay-detail">
          <div className="replay-detail-row">
            <span className="replay-label">Entry</span>
            <span>
              {new Date(selectedPair.buy.date).toLocaleDateString()} @{" "}
              {formatPrice(selectedPair.buy.price, currency)} × {selectedPair.buy.shares}
            </span>
          </div>
          <div className="replay-detail-row">
            <span className="replay-label">Exit</span>
            <span>
              {new Date(selectedPair.sell.date).toLocaleDateString()} @{" "}
              {formatPrice(selectedPair.sell.price, currency)} × {selectedPair.sell.shares}
            </span>
          </div>
          <div className="replay-detail-row">
            <span className="replay-label">P&L</span>
            <span className={(selectedPair.sell.pnlPercent || 0) >= 0 ? "positive" : "negative"}>
              {(selectedPair.sell.pnlPercent || 0) >= 0 ? "+" : ""}
              {(selectedPair.sell.pnlPercent || 0).toFixed(2)}% (
              {formatPrice(selectedPair.sell.pnl || 0, currency)})
            </span>
          </div>
          {selectedPair.sell.mfe != null && (
            <div className="replay-detail-row">
              <span className="replay-label">MFE / MAE</span>
              <span>
                +{selectedPair.sell.mfe.toFixed(1)}% / {(selectedPair.sell.mae || 0).toFixed(1)}%
                {selectedPair.sell.mfeUtilization != null &&
                  ` (${selectedPair.sell.mfeUtilization.toFixed(0)}% captured)`}
              </span>
            </div>
          )}
          {selectedPair.sell.exitReason && (
            <div className="replay-detail-row">
              <span className="replay-label">Exit Reason</span>
              <span>{EXIT_REASON_LABELS[selectedPair.sell.exitReason]}</span>
            </div>
          )}
          {selectedPair.buy.memo && (
            <div className="replay-detail-row">
              <span className="replay-label">Entry Memo</span>
              <span className="replay-memo">{selectedPair.buy.memo}</span>
            </div>
          )}
          {selectedPair.sell.memo && (
            <div className="replay-detail-row">
              <span className="replay-label">Exit Memo</span>
              <span className="replay-memo">{selectedPair.sell.memo}</span>
            </div>
          )}
          {selectedPair.buy.journal && (
            <div className="replay-journal">
              <div className="replay-detail-row">
                <span className="replay-label">Thesis</span>
                <span>{selectedPair.buy.journal.thesis}</span>
              </div>
              <div className="replay-detail-row">
                <span className="replay-label">Setup</span>
                <span>{selectedPair.buy.journal.setup}</span>
              </div>
              <div className="replay-detail-row">
                <span className="replay-label">Confidence</span>
                <span>{selectedPair.buy.journal.confidence}/5</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
