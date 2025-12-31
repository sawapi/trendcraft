import { useSimulatorStore } from "../store/simulatorStore";
import { formatDate } from "../utils/fileParser";

export function PositionPanel() {
  const {
    position,
    getUnrealizedPnl,
    getTotalPnl,
    tradeHistory,
    getYearHighLow,
  } = useSimulatorStore();

  const unrealizedPnl = getUnrealizedPnl();
  const totalPnl = getTotalPnl();
  const tradeCount = tradeHistory.filter((t) => t.type === "SELL").length;
  const yearHighLow = getYearHighLow();

  return (
    <div className="position-panel">
      <h3>ポジション</h3>

      {position ? (
        <div className="position-status long">
          <div className="status-label">ロング保有中</div>
          <div className="status-value">
            {position.entryPrice.toLocaleString()} @{" "}
            {formatDate(position.entryDate)}
          </div>
          {unrealizedPnl && (
            <div
              className={`pnl ${unrealizedPnl.pnl >= 0 ? "positive" : "negative"}`}
            >
              含み損益: {unrealizedPnl.pnl >= 0 ? "+" : ""}
              {unrealizedPnl.pnl.toLocaleString()} (
              {unrealizedPnl.pnlPercent >= 0 ? "+" : ""}
              {unrealizedPnl.pnlPercent.toFixed(2)}%)
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
