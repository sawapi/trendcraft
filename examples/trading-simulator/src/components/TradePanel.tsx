import { useState, useCallback, useMemo } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { PriceType, ExitReason, ExitTrigger } from "../types";
import { PRICE_TYPE_LABELS, EXIT_REASON_LABELS, EXIT_TRIGGER_LABELS } from "../types";

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

export function TradePanel() {
  const {
    positions,
    getPositionSummary,
    isPlaying,
    executeBuy,
    executeSell,
    executeSellAll,
    pause,
    getCurrentCandle,
    getNextCandle,
    initialCapital,
  } = useSimulatorStore();

  const [buyShares, setBuyShares] = useState(100);
  const [sellShares, setSellShares] = useState(100);
  const [memo, setMemo] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("nextOpen");
  const [exitReason, setExitReason] = useState<ExitReason>("MANUAL");
  const [exitTrigger, setExitTrigger] = useState<ExitTrigger | undefined>(undefined);

  const currentCandle = getCurrentCandle();
  const nextCandle = getNextCandle();
  const positionSummary = getPositionSummary();

  // Calculate estimated price based on selected price type
  const estimatedPrice = useMemo(() => {
    if (priceType === "nextOpen") {
      return nextCandle?.open || currentCandle?.close || 0;
    }
    return currentCandle?.[priceType] || 0;
  }, [priceType, currentCandle, nextCandle]);

  const totalBuyCost = estimatedPrice * buyShares;

  const handleBuy = useCallback(() => {
    if (isPlaying) pause();
    executeBuy(buyShares, memo, priceType);
    setMemo("");
  }, [isPlaying, pause, executeBuy, buyShares, memo, priceType]);

  const handleSell = useCallback(() => {
    if (isPlaying) pause();
    executeSell(sellShares, memo, priceType, exitReason, exitTrigger);
    setMemo("");
    setExitTrigger(undefined);
  }, [isPlaying, pause, executeSell, sellShares, memo, priceType, exitReason, exitTrigger]);

  const handleSellAll = useCallback(() => {
    if (isPlaying) pause();
    executeSellAll(memo, priceType, exitReason, exitTrigger);
    setMemo("");
    setExitTrigger(undefined);
  }, [isPlaying, pause, executeSellAll, memo, priceType, exitReason, exitTrigger]);

  const handleBuySharesChange = (value: number) => {
    const rounded = Math.max(100, Math.round(value / 100) * 100);
    setBuyShares(rounded);
  };

  const handleSellSharesChange = (value: number) => {
    const maxShares = positionSummary?.totalShares || 100;
    const rounded = Math.max(100, Math.min(maxShares, Math.round(value / 100) * 100));
    setSellShares(rounded);
  };

  const hasPosition = positions.length > 0;
  const canUseNextOpen = nextCandle !== null;

  return (
    <div className="trade-panel">
      <h3>売買アクション</h3>

      {/* Buy Section */}
      <div className="shares-input">
        <label>買い株数</label>
        <div className="shares-controls">
          <button
            className="shares-btn"
            onClick={() => handleBuySharesChange(buyShares - 100)}
            disabled={buyShares <= 100}
          >
            -100
          </button>
          <input
            type="number"
            value={buyShares}
            onChange={(e) => handleBuySharesChange(Number(e.target.value))}
            step={100}
            min={100}
          />
          <button
            className="shares-btn"
            onClick={() => handleBuySharesChange(buyShares + 100)}
          >
            +100
          </button>
        </div>
      </div>

      {/* Sell Section - only show if has position */}
      {hasPosition && positionSummary && (
        <div className="shares-input">
          <label>売り株数 (保有: {positionSummary.totalShares}株)</label>
          <div className="shares-controls">
            <button
              className="shares-btn"
              onClick={() => handleSellSharesChange(sellShares - 100)}
              disabled={sellShares <= 100}
            >
              -100
            </button>
            <input
              type="number"
              value={Math.min(sellShares, positionSummary.totalShares)}
              onChange={(e) => handleSellSharesChange(Number(e.target.value))}
              step={100}
              min={100}
              max={positionSummary.totalShares}
            />
            <button
              className="shares-btn"
              onClick={() => handleSellSharesChange(sellShares + 100)}
              disabled={sellShares >= positionSummary.totalShares}
            >
              +100
            </button>
          </div>
        </div>
      )}

      <div className="price-type-selector">
        <label>約定価格</label>
        <div className="price-type-buttons">
          {PRICE_TYPES.map((type) => (
            <button
              key={type}
              className={`price-type-btn ${priceType === type ? "active" : ""}`}
              onClick={() => setPriceType(type)}
              disabled={type === "nextOpen" && !canUseNextOpen}
              title={
                type === "nextOpen" && !canUseNextOpen
                  ? "最終日のため翌日始値は選択できません"
                  : ""
              }
            >
              {PRICE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="price-estimate">
          {priceType === "nextOpen" ? "翌日始値" : PRICE_TYPE_LABELS[priceType]}
          : {estimatedPrice.toLocaleString()}円
          <span className="capital-ratio">
            (買い概算: {totalBuyCost.toLocaleString()}円 / {((totalBuyCost / initialCapital) * 100).toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Exit Reason Selector - only show if has position */}
      {hasPosition && (
        <div className="exit-reason-selector">
          <label>イグジット理由</label>
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

      {/* Exit Trigger Selector - only show if has position and exitReason is not MANUAL */}
      {hasPosition && exitReason !== "MANUAL" && (
        <div className="exit-trigger-selector">
          <label>詳細トリガー（任意）</label>
          <select
            value={exitTrigger || ""}
            onChange={(e) => setExitTrigger(e.target.value as ExitTrigger || undefined)}
          >
            <option value="">選択しない</option>
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
          title={hasPosition ? "追加買い" : "新規買い"}
        >
          {hasPosition ? "追加買" : "BUY"}
        </button>
        <button
          className="sell-btn"
          onClick={handleSell}
          disabled={!hasPosition || (priceType === "nextOpen" && !canUseNextOpen)}
          title={!hasPosition ? "ポジションがありません" : "部分売り"}
        >
          部分売
        </button>
        <button
          className="sell-btn sell-all"
          onClick={handleSellAll}
          disabled={!hasPosition || (priceType === "nextOpen" && !canUseNextOpen)}
          title={!hasPosition ? "ポジションがありません" : "全売り"}
        >
          全売
        </button>
      </div>

      <div className="memo-input">
        <label>メモ（判断理由を記録）</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="例: RSIが30を下回り、サポートラインに接触したため買いエントリー"
        />
      </div>
    </div>
  );
}
