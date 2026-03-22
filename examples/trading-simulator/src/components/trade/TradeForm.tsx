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
import {
  CURRENCY_CONFIG,
  EXIT_REASON_LABELS,
  EXIT_TRIGGER_LABELS,
  PRICE_TYPE_LABELS,
  formatPrice,
} from "../../types";
import { CollapsiblePanel } from "../CollapsiblePanel";
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
    executeShortSell,
    executeBuyCover,
    executeBuyCoverAll,
    getShortPositionSummary,
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

  const activeCurrency = activeSymbol?.currency ?? "JPY";

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
  const [useLimitOrder, setUseLimitOrder] = useState(false);
  const [limitPrice, setLimitPrice] = useState<number>(0);
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
        limitPrice: useLimitOrder && limitPrice > 0 ? limitPrice : undefined,
      });
    } else {
      executeBuy(buyShares, memo, priceType);
    }
    setMemo("");
    setPendingJournal(null);
  }, [
    isPlaying,
    pause,
    executeBuy,
    placePendingOrder,
    buyShares,
    memo,
    priceType,
    activeSymbol,
    useLimitOrder,
    limitPrice,
  ]);

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
        limitPrice: useLimitOrder && limitPrice > 0 ? limitPrice : undefined,
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
    useLimitOrder,
    limitPrice,
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
        limitPrice: useLimitOrder && limitPrice > 0 ? limitPrice : undefined,
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
    useLimitOrder,
    limitPrice,
  ]);

  const shortSummary = getShortPositionSummary();
  const longPositions = positions.filter((p) => p.direction !== "short");
  const shortPositions = positions.filter((p) => p.direction === "short");
  const hasLongPosition = longPositions.length > 0;
  const hasShortPosition = shortPositions.length > 0;
  const handleShortSell = useCallback(() => {
    if (isPlaying) pause();

    if (priceType === "nextOpen" && activeSymbol) {
      placePendingOrder({
        symbolId: activeSymbol.id,
        orderType: "SHORT_SELL",
        shares: buyShares,
        memo,
        limitPrice: useLimitOrder && limitPrice > 0 ? limitPrice : undefined,
      });
    } else {
      executeShortSell(buyShares, memo, priceType);
    }
    setMemo("");
    setPendingJournal(null);
  }, [
    isPlaying,
    pause,
    executeShortSell,
    placePendingOrder,
    buyShares,
    memo,
    priceType,
    activeSymbol,
    useLimitOrder,
    limitPrice,
  ]);

  const handleBuyCover = useCallback(() => {
    if (isPlaying) pause();

    if (priceType === "nextOpen" && activeSymbol) {
      placePendingOrder({
        symbolId: activeSymbol.id,
        orderType: "BUY_TO_COVER",
        shares: sellShares,
        memo,
        exitReason,
        exitTrigger,
        limitPrice: useLimitOrder && limitPrice > 0 ? limitPrice : undefined,
      });
    } else {
      executeBuyCover(sellShares, memo, priceType, exitReason, exitTrigger);
    }
    setMemo("");
    setExitTrigger(undefined);
    setPendingJournal(null);
  }, [
    isPlaying,
    pause,
    executeBuyCover,
    placePendingOrder,
    sellShares,
    memo,
    priceType,
    exitReason,
    exitTrigger,
    activeSymbol,
    useLimitOrder,
    limitPrice,
  ]);

  const handleCoverAll = useCallback(() => {
    if (isPlaying) pause();

    if (priceType === "nextOpen" && activeSymbol) {
      placePendingOrder({
        symbolId: activeSymbol.id,
        orderType: "COVER_ALL",
        shares: 0,
        memo,
        exitReason,
        exitTrigger,
        limitPrice: useLimitOrder && limitPrice > 0 ? limitPrice : undefined,
      });
    } else {
      executeBuyCoverAll(memo, priceType, exitReason, exitTrigger);
    }
    setMemo("");
    setExitTrigger(undefined);
    setPendingJournal(null);
  }, [
    isPlaying,
    pause,
    executeBuyCoverAll,
    placePendingOrder,
    memo,
    priceType,
    exitReason,
    exitTrigger,
    activeSymbol,
    useLimitOrder,
    limitPrice,
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
    SHORT_SELL: "Short Sell",
    BUY_TO_COVER: "Cover",
    COVER_ALL: "Cover All",
  };

  return (
    <div className="trade-panel">
      <CollapsiblePanel title="Trade Actions" storageKey="trade-actions">
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
          <div className="shares-stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setBuyShares((prev) => Math.max(1, prev - 1))}
              disabled={buyShares <= 1}
            >
              <span className="material-icons">remove</span>
            </button>
            <input
              type="number"
              value={buyShares}
              onChange={(e) => setBuyShares(Math.max(1, Number(e.target.value)))}
              min={1}
              className="shares-input-field"
            />
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setBuyShares((prev) => prev + 1)}
            >
              <span className="material-icons">add</span>
            </button>
          </div>
          <div className="shares-presets">
            {CURRENCY_CONFIG[activeCurrency].defaultLotPresets.map((qty) => (
              <button
                key={qty}
                type="button"
                className={`preset-btn ${buyShares === qty ? "active" : ""}`}
                onClick={() => setBuyShares(qty)}
              >
                {qty}
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
            currency={activeCurrency}
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

        {/* Sell / Cover Section */}
        {((hasLongPosition && positionSummary) || (hasShortPosition && shortSummary)) && (
          <div className="shares-input">
            <label>
              {hasShortPosition && shortSummary
                ? `Cover Shares (short: ${shortSummary.totalShares})`
                : `Sell Shares (held: ${positionSummary?.totalShares})`}
            </label>
            <div className="shares-stepper">
              <button
                type="button"
                className="stepper-btn"
                onClick={() => {
                  setSellShares((prev) => Math.max(1, prev - 1));
                }}
                disabled={sellShares <= 1}
              >
                <span className="material-icons">remove</span>
              </button>
              <input
                type="number"
                value={Math.min(
                  sellShares,
                  shortSummary?.totalShares || positionSummary?.totalShares || 1,
                )}
                onChange={(e) => {
                  const maxShares = shortSummary?.totalShares || positionSummary?.totalShares || 1;
                  setSellShares(Math.max(1, Math.min(maxShares, Number(e.target.value))));
                }}
                min={1}
                max={shortSummary?.totalShares || positionSummary?.totalShares || 1}
                className="shares-input-field"
              />
              <button
                type="button"
                className="stepper-btn"
                onClick={() => {
                  const maxShares = shortSummary?.totalShares || positionSummary?.totalShares || 1;
                  setSellShares((prev) => Math.min(maxShares, prev + 1));
                }}
                disabled={
                  sellShares >= (shortSummary?.totalShares || positionSummary?.totalShares || 0)
                }
              >
                <span className="material-icons">add</span>
              </button>
            </div>
            <div className="shares-presets">
              {CURRENCY_CONFIG[activeCurrency].defaultLotPresets
                .filter(
                  (qty) => qty <= (shortSummary?.totalShares || positionSummary?.totalShares || 0),
                )
                .map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    className={`preset-btn ${sellShares === qty ? "active" : ""}`}
                    onClick={() => setSellShares(qty)}
                  >
                    {qty}
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
            {priceType === "nextOpen" ? "Next Open" : PRICE_TYPE_LABELS[priceType]}:{" "}
            {formatPrice(estimatedPrice, activeCurrency)}
            <span className="capital-ratio">
              (est. cost: {formatPrice(totalBuyCost, activeCurrency)} /{" "}
              {((totalBuyCost / initialCapital) * 100).toFixed(1)}%)
            </span>
          </div>

          {/* Limit Order Option (Next Open only) */}
          {priceType === "nextOpen" && (
            <div className="limit-order-section">
              <label className="checkbox-label limit-checkbox">
                <input
                  type="checkbox"
                  checked={useLimitOrder}
                  onChange={(e) => {
                    setUseLimitOrder(e.target.checked);
                    if (e.target.checked && limitPrice === 0) {
                      setLimitPrice(currentCandle?.close || 0);
                    }
                  }}
                />
                Limit Order
              </label>
              {useLimitOrder && (
                <div className="limit-price-input">
                  <label>Limit Price</label>
                  <input
                    type="number"
                    value={limitPrice}
                    min={0}
                    step={1}
                    onChange={(e) => setLimitPrice(Number(e.target.value))}
                  />
                  <p className="hint">
                    Buy: fills if low &le; limit. Sell: fills if high &ge; limit. Unfilled orders
                    stay pending.
                  </p>
                </div>
              )}
            </div>
          )}
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

        {/* Long buttons */}
        <div className="trade-buttons">
          <button
            className="buy-btn"
            onClick={handleBuy}
            disabled={(priceType === "nextOpen" && !canUseNextOpen) || hasShortPosition}
            title={
              hasShortPosition
                ? "Close short first"
                : hasLongPosition
                  ? "Add to position"
                  : "New long position"
            }
          >
            {hasLongPosition ? "ADD" : "BUY"}
          </button>
          <button
            className="sell-btn"
            onClick={handleSell}
            disabled={!hasLongPosition || (priceType === "nextOpen" && !canUseNextOpen)}
            title={!hasLongPosition ? "No long position" : "Partial sell"}
          >
            SELL
          </button>
          <button
            className="sell-btn sell-all"
            onClick={handleSellAll}
            disabled={!hasLongPosition || (priceType === "nextOpen" && !canUseNextOpen)}
            title={!hasLongPosition ? "No long position" : "Sell all"}
          >
            ALL
          </button>
        </div>

        {/* Short buttons */}
        <div className="trade-buttons short-buttons">
          <button
            className="short-btn"
            onClick={handleShortSell}
            disabled={(priceType === "nextOpen" && !canUseNextOpen) || hasLongPosition}
            title={
              hasLongPosition
                ? "Close long first"
                : hasShortPosition
                  ? "Add to short"
                  : "New short position"
            }
          >
            {hasShortPosition ? "ADD SHORT" : "SHORT"}
          </button>
          <button
            className="cover-btn"
            onClick={handleBuyCover}
            disabled={!hasShortPosition || (priceType === "nextOpen" && !canUseNextOpen)}
            title={!hasShortPosition ? "No short position" : "Partial cover"}
          >
            COVER
          </button>
          <button
            className="cover-btn cover-all"
            onClick={handleCoverAll}
            disabled={!hasShortPosition || (priceType === "nextOpen" && !canUseNextOpen)}
            title={!hasShortPosition ? "No short position" : "Cover all"}
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

        {/* Pending order type label for short orders */}

        {/* Pending Orders */}
        {symbolPendingOrders.length > 0 && (
          <div className="pending-orders">
            <h4>Pending Orders</h4>
            <ul className="pending-orders-list">
              {symbolPendingOrders.map((order) => (
                <li key={order.id} className={`pending-order ${order.orderType.toLowerCase()}`}>
                  <div className="pending-order-info">
                    <span
                      className={`order-type ${order.orderType === "BUY" || order.orderType === "BUY_TO_COVER" ? "buy" : "sell"}`}
                    >
                      {ORDER_TYPE_LABELS[order.orderType]}
                    </span>
                    {order.orderType !== "SELL_ALL" && order.orderType !== "COVER_ALL" && (
                      <span className="order-shares">{order.shares} sh</span>
                    )}
                    {order.limitPrice != null && (
                      <span className="order-limit">
                        @{formatPrice(order.limitPrice, activeCurrency)}
                      </span>
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
      </CollapsiblePanel>
    </div>
  );
}
