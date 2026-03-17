import { useCallback, useMemo, useState } from "react";
import { useSimulatorStore } from "../../store/simulatorStore";
import type {
  BracketOrder,
  ExitReason,
  ExitTrigger,
  OrderType,
  PriceType,
  TradeJournalEntry,
} from "../../types";
import { EXIT_REASON_LABELS, EXIT_TRIGGER_LABELS, PRICE_TYPE_LABELS } from "../../types";
import { BracketOrderForm } from "./BracketOrderForm";
import { JournalEntry } from "./JournalEntry";
import { PositionSizer } from "./PositionSizer";

const PRICE_TYPES: PriceType[] = ["nextOpen", "high", "low", "close"];
const EXIT_REASONS: ExitReason[] = ["TAKE_PROFIT", "STOP_LOSS", "SIGNAL_FLIP", "TIMEOUT", "MANUAL"];
const EXIT_TRIGGERS: ExitTrigger[] = [
  "DISCRETIONARY",
  "TARGET_REACHED",
  "RSI_OVERBOUGHT",
  "RSI_OVERSOLD",
  "MACD_CROSS",
  "MA_CROSS",
  "TRAILING_STOP",
  "TIME_LIMIT",
];

const SHARE_STEPS = [-100, -10, -1, 1, 10, 100];

export function TradeForm() {
  const {
    symbols,
    activeSymbolId,
    commonDateRange,
    currentDateIndex,
    getPositionSummary,
    isPlaying,
    executeBuy,
    executeSell,
    executeSellAll,
    placePendingOrder,
    cancelPendingOrder,
    pendingOrders,
    pause,
    getCurrentCandle,
    getNextCandle,
    initialCapital,
    stopLossPercent,
    takeProfitPercent,
  } = useSimulatorStore();

  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  const currentIndex = useMemo(() => {
    if (!activeSymbol || !commonDateRange || currentDateIndex < 0) return 0;
    const targetDate = commonDateRange.dates[currentDateIndex];
    if (!targetDate) return 0;
    return activeSymbol.allCandles.findIndex((c) => c.time === targetDate);
  }, [activeSymbol, commonDateRange, currentDateIndex]);

  const positions = activeSymbol?.positions || [];
  const indicatorData = activeSymbol?.indicatorData || null;
  const startIndex = activeSymbol?.startIndex || 0;

  const [buyShares, setBuyShares] = useState(100);
  const [sellShares, setSellShares] = useState(100);
  const [memo, setMemo] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("nextOpen");
  const [exitReason, setExitReason] = useState<ExitReason>("MANUAL");
  const [exitTrigger, setExitTrigger] = useState<ExitTrigger | undefined>(undefined);
  const [showSizingCalc, setShowSizingCalc] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [_bracket, setBracket] = useState<BracketOrder | null>(null);
  const [pendingJournal, setPendingJournal] = useState<TradeJournalEntry | null>(null);

  const currentCandle = getCurrentCandle();
  const nextCandle = getNextCandle();
  const positionSummary = getPositionSummary();

  const estimatedPrice = useMemo(() => {
    if (priceType === "nextOpen") {
      return nextCandle?.open || currentCandle?.close || 0;
    }
    return currentCandle?.[priceType] || 0;
  }, [priceType, currentCandle, nextCandle]);

  const totalBuyCost = estimatedPrice * buyShares;

  const currentAtr = useMemo(() => {
    if (!indicatorData?.atr) return null;
    const visibleIndex = currentIndex - startIndex;
    return indicatorData.atr[visibleIndex] ?? null;
  }, [indicatorData, currentIndex, startIndex]);

  const handleBuy = useCallback(() => {
    if (isPlaying) pause();

    if (priceType === "nextOpen" && activeSymbol) {
      placePendingOrder({
        symbolId: activeSymbol.id,
        orderType: "BUY",
        shares: buyShares,
        memo,
      });
    } else {
      executeBuy(buyShares, memo, priceType);
    }
    setMemo("");
    setPendingJournal(null);
  }, [isPlaying, pause, executeBuy, placePendingOrder, buyShares, memo, priceType, activeSymbol]);

  const handleSell = useCallback(() => {
    if (isPlaying) pause();

    if (priceType === "nextOpen" && activeSymbol) {
      placePendingOrder({
        symbolId: activeSymbol.id,
        orderType: "SELL",
        shares: sellShares,
        memo,
        exitReason,
        exitTrigger,
      });
    } else {
      executeSell(sellShares, memo, priceType, exitReason, exitTrigger);
    }
    setMemo("");
    setExitTrigger(undefined);
    setPendingJournal(null);
  }, [
    isPlaying,
    pause,
    executeSell,
    placePendingOrder,
    sellShares,
    memo,
    priceType,
    exitReason,
    exitTrigger,
    activeSymbol,
  ]);

  const handleSellAll = useCallback(() => {
    if (isPlaying) pause();

    if (priceType === "nextOpen" && activeSymbol) {
      placePendingOrder({
        symbolId: activeSymbol.id,
        orderType: "SELL_ALL",
        shares: 0,
        memo,
        exitReason,
        exitTrigger,
      });
    } else {
      executeSellAll(memo, priceType, exitReason, exitTrigger);
    }
    setMemo("");
    setExitTrigger(undefined);
    setPendingJournal(null);
  }, [
    isPlaying,
    pause,
    executeSellAll,
    placePendingOrder,
    memo,
    priceType,
    exitReason,
    exitTrigger,
    activeSymbol,
  ]);

  const hasPosition = positions.length > 0;
  const canUseNextOpen = nextCandle !== null;

  const symbolPendingOrders = useMemo(() => {
    if (!activeSymbol) return [];
    return pendingOrders.filter((o) => o.symbolId === activeSymbol.id);
  }, [pendingOrders, activeSymbol]);

  const ORDER_TYPE_LABELS: Record<OrderType, string> = {
    BUY: "Buy",
    SELL: "Partial Sell",
    SELL_ALL: "Sell All",
  };

  return (
    <div className="trade-panel">
      <h3>Trade Actions</h3>

      {/* Buy Section */}
      <div className="shares-input">
        <div className="shares-header">
          <label>Buy Shares</label>
          <button
            className="sizing-calc-toggle"
            onClick={() => setShowSizingCalc(!showSizingCalc)}
            title="Position Sizing Calculator"
          >
            {showSizingCalc ? "✕ Close" : "Calculator"}
          </button>
        </div>
        <input
          type="number"
          value={buyShares}
          onChange={(e) => setBuyShares(Math.max(1, Number(e.target.value)))}
          min={1}
          className="shares-input-field"
        />
        <div className="shares-step-buttons">
          {SHARE_STEPS.map((step) => (
            <button
              key={step}
              className={`shares-step-btn ${step > 0 ? "plus" : "minus"}`}
              onClick={() => setBuyShares((prev) => Math.max(1, prev + step))}
              disabled={step < 0 && buyShares + step < 1}
            >
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
        </div>
      </div>

      {/* Position Sizing Calculator */}
      {showSizingCalc && (
        <PositionSizer
          estimatedPrice={estimatedPrice}
          initialCapital={initialCapital}
          stopLossPercent={stopLossPercent}
          currentAtr={currentAtr}
          onApply={(shares) => {
            setBuyShares(shares);
            setShowSizingCalc(false);
          }}
        />
      )}

      {/* Bracket Order */}
      <BracketOrderForm
        entryPrice={estimatedPrice}
        defaultStopLossPercent={stopLossPercent}
        defaultTakeProfitPercent={takeProfitPercent}
        onChange={setBracket}
      />

      {/* Sell Section */}
      {hasPosition && positionSummary && (
        <div className="shares-input">
          <label>Sell Shares (held: {positionSummary.totalShares})</label>
          <input
            type="number"
            value={Math.min(sellShares, positionSummary.totalShares)}
            onChange={(e) => {
              const maxShares = positionSummary?.totalShares || 1;
              setSellShares(Math.max(1, Math.min(maxShares, Number(e.target.value))));
            }}
            min={1}
            max={positionSummary.totalShares}
            className="shares-input-field"
          />
          <div className="shares-step-buttons">
            {SHARE_STEPS.map((step) => (
              <button
                key={step}
                className={`shares-step-btn ${step > 0 ? "plus" : "minus"}`}
                onClick={() => {
                  const maxShares = positionSummary?.totalShares || 1;
                  setSellShares((prev) => Math.max(1, Math.min(maxShares, prev + step)));
                }}
                disabled={
                  (step < 0 && sellShares + step < 1) ||
                  (step > 0 && sellShares >= positionSummary.totalShares)
                }
              >
                {step > 0 ? `+${step}` : step}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="price-type-selector">
        <label>Execution Price</label>
        <div className="price-type-buttons">
          {PRICE_TYPES.map((type) => (
            <button
              key={type}
              className={`price-type-btn ${priceType === type ? "active" : ""}`}
              onClick={() => setPriceType(type)}
              disabled={type === "nextOpen" && !canUseNextOpen}
              title={
                type === "nextOpen" && !canUseNextOpen ? "Next open unavailable on last day" : ""
              }
            >
              {PRICE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="price-estimate">
          {priceType === "nextOpen" ? "Next Open" : PRICE_TYPE_LABELS[priceType]}: ¥
          {estimatedPrice.toLocaleString()}
          <span className="capital-ratio">
            (est. cost: ¥{totalBuyCost.toLocaleString()} /{" "}
            {((totalBuyCost / initialCapital) * 100).toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Exit Reason */}
      {hasPosition && (
        <div className="exit-reason-selector">
          <label>Exit Reason</label>
          <div className="exit-reason-buttons">
            {EXIT_REASONS.map((reason) => (
              <button
                key={reason}
                className={`exit-reason-btn ${exitReason === reason ? "active" : ""}`}
                onClick={() => setExitReason(reason)}
              >
                {EXIT_REASON_LABELS[reason]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exit Trigger */}
      {hasPosition && exitReason !== "MANUAL" && (
        <div className="exit-trigger-selector">
          <label>Exit Trigger (optional)</label>
          <select
            value={exitTrigger || ""}
            onChange={(e) => setExitTrigger((e.target.value as ExitTrigger) || undefined)}
          >
            <option value="">None</option>
            {EXIT_TRIGGERS.map((trigger) => (
              <option key={trigger} value={trigger}>
                {EXIT_TRIGGER_LABELS[trigger]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="trade-buttons">
        <button
          className="buy-btn"
          onClick={handleBuy}
          disabled={priceType === "nextOpen" && !canUseNextOpen}
          title={hasPosition ? "Add to position" : "New position"}
        >
          {hasPosition ? "ADD" : "BUY"}
        </button>
        <button
          className="sell-btn"
          onClick={handleSell}
          disabled={!hasPosition || (priceType === "nextOpen" && !canUseNextOpen)}
          title={!hasPosition ? "No position" : "Partial sell"}
        >
          SELL
        </button>
        <button
          className="sell-btn sell-all"
          onClick={handleSellAll}
          disabled={!hasPosition || (priceType === "nextOpen" && !canUseNextOpen)}
          title={!hasPosition ? "No position" : "Sell all"}
        >
          ALL
        </button>
      </div>

      {/* Memo */}
      <div className="memo-input">
        <div className="memo-header">
          <label>Memo (record your reasoning)</label>
          <button className="journal-toggle-btn" onClick={() => setShowJournal(!showJournal)}>
            {showJournal ? "Simple" : "Journal"}
          </button>
        </div>
        {!showJournal ? (
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. RSI below 30, touching support line — buying"
          />
        ) : (
          <JournalEntry
            onSubmit={(journal) => {
              setPendingJournal(journal);
              setMemo(journal.thesis);
            }}
          />
        )}
        {pendingJournal && (
          <div className="journal-saved-indicator">
            Journal saved (confidence: {pendingJournal.confidence}/5)
          </div>
        )}
      </div>

      {/* Pending Orders */}
      {symbolPendingOrders.length > 0 && (
        <div className="pending-orders">
          <h4>Pending Orders (fill at next open)</h4>
          <ul className="pending-orders-list">
            {symbolPendingOrders.map((order) => (
              <li key={order.id} className={`pending-order ${order.orderType.toLowerCase()}`}>
                <div className="pending-order-info">
                  <span className={`order-type ${order.orderType === "BUY" ? "buy" : "sell"}`}>
                    {ORDER_TYPE_LABELS[order.orderType]}
                  </span>
                  {order.orderType !== "SELL_ALL" && (
                    <span className="order-shares">{order.shares} sh</span>
                  )}
                  {order.memo && (
                    <span className="order-memo" title={order.memo}>
                      {order.memo.length > 20 ? `${order.memo.slice(0, 20)}...` : order.memo}
                    </span>
                  )}
                </div>
                <button
                  className="cancel-order-btn"
                  onClick={() => cancelPendingOrder(order.id)}
                  title="Cancel order"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
