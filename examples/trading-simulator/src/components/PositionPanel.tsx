import { useSimulatorStore } from "../store/simulatorStore";
import { formatDate } from "../utils/fileParser";

export function PositionPanel() {
  const {
    positions,
    getPositionSummary,
    getUnrealizedPnl,
    getTotalPnl,
    tradeHistory,
    getYearHighLow,
    getHoldingDays,
    trailingStopEnabled,
  } = useSimulatorStore();

  const positionSummary = getPositionSummary();
  const unrealizedPnl = getUnrealizedPnl();
  const totalPnl = getTotalPnl();
  const tradeCount = tradeHistory.filter((t) => t.type === "SELL").length;
  const yearHighLow = getYearHighLow();
  const holdingDays = getHoldingDays();

  return (
    <div className="position-panel">
      <h3>ポジション</h3>

      {positions.length > 0 && positionSummary ? (
        <div className="position-status long">
          <div className="status-label">
            ロング保有中 ({positions.length}回買付)
            {holdingDays !== null && (
              <span className="holding-days">保有{holdingDays}日目</span>
            )}
          </div>
          <div className="position-summary">
            <div className="summary-row">
              <span className="label">保有株数</span>
              <span className="value">{positionSummary.totalShares}株</span>
            </div>
            <div className="summary-row">
              <span className="label">平均取得単価</span>
              <span className="value">
                {positionSummary.avgEntryPrice.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="summary-row">
              <span className="label">取得総額</span>
              <span className="value">
                {positionSummary.totalCost.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>
          {unrealizedPnl && (
            <div
              className={`pnl ${unrealizedPnl.pnl >= 0 ? "positive" : "negative"}`}
            >
              含み損益: {unrealizedPnl.pnl >= 0 ? "+" : ""}
              {unrealizedPnl.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} (
              {unrealizedPnl.pnlPercent >= 0 ? "+" : ""}
              {unrealizedPnl.pnlPercent.toFixed(2)}%)
            </div>
          )}

          {trailingStopEnabled && positions.some((p) => p.trailingStopPrice) && (
            <div className="trailing-stop-info">
              <span className="label">トレーリングストップ</span>
              <span className="value">
                {Math.max(...positions.filter(p => p.trailingStopPrice).map(p => p.trailingStopPrice!)).toLocaleString(undefined, { maximumFractionDigits: 0 })}円
              </span>
            </div>
          )}

          {positions.length > 1 && (
            <div className="position-list">
              <div className="list-header">買付履歴</div>
              {positions.map((pos, idx) => (
                <div key={pos.id} className="position-item">
                  <span className="item-num">#{idx + 1}</span>
                  <span className="item-shares">{pos.shares}株</span>
                  <span className="item-price">@{pos.entryPrice.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="no-position">ポジションなし</div>
      )}

      {tradeCount > 0 && (
        <div className="total-pnl">
          <span className="label">確定損益 ({tradeCount}回)</span>
          <span className={`value ${totalPnl >= 0 ? "positive" : "negative"}`}>
            {totalPnl >= 0 ? "+" : ""}
            {totalPnl.toLocaleString()}
          </span>
        </div>
      )}

      {yearHighLow && (
        <div className="year-high-low">
          <h3>年初来</h3>
          <div className="year-stat">
            <span className="label">高値</span>
            <span className="value high">
              {yearHighLow.yearHigh.toLocaleString()}
            </span>
            <span className="date">({formatDate(yearHighLow.yearHighDate)})</span>
          </div>
          <div className="year-stat">
            <span className="label">安値</span>
            <span className="value low">
              {yearHighLow.yearLow.toLocaleString()}
            </span>
            <span className="date">({formatDate(yearHighLow.yearLowDate)})</span>
          </div>
          <div className="year-stat current">
            <span className="label">現在値</span>
            <span className="value">
              {yearHighLow.currentPrice.toLocaleString()}
            </span>
          </div>
          <div className="year-position">
            <span
              className={`from-value ${yearHighLow.fromHigh >= 0 ? "positive" : "negative"}`}
            >
              高値から {yearHighLow.fromHigh >= 0 ? "+" : ""}
              {yearHighLow.fromHigh.toFixed(1)}%
            </span>
            <span
              className={`from-value ${yearHighLow.fromLow >= 0 ? "positive" : "negative"}`}
            >
              安値から {yearHighLow.fromLow >= 0 ? "+" : ""}
              {yearHighLow.fromLow.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
