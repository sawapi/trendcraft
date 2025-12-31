import { useState, useCallback, useMemo } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { PriceType } from "../types";
import { PRICE_TYPE_LABELS } from "../types";

const PRICE_TYPES: PriceType[] = ["nextOpen", "high", "low", "close"];

export function TradePanel() {
  const {
    position,
    isPlaying,
    executeBuy,
    executeSell,
    skip,
    pause,
    getCurrentCandle,
    getNextCandle,
    initialCapital,
  } = useSimulatorStore();

  const [shares, setShares] = useState(100);
  const [memo, setMemo] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("nextOpen");

  const currentCandle = getCurrentCandle();
  const nextCandle = getNextCandle();

  // Calculate estimated price based on selected price type
  const estimatedPrice = useMemo(() => {
    if (priceType === "nextOpen") {
      return nextCandle?.open || currentCandle?.close || 0;
    }
    return currentCandle?.[priceType] || 0;
  }, [priceType, currentCandle, nextCandle]);

  const totalCost = estimatedPrice * shares;

  const handleBuy = useCallback(() => {
    if (isPlaying) pause();
    executeBuy(shares, memo, priceType);
    setMemo("");
  }, [isPlaying, pause, executeBuy, shares, memo, priceType]);

  const handleSell = useCallback(() => {
    if (isPlaying) pause();
    executeSell(memo, priceType);
    setMemo("");
  }, [isPlaying, pause, executeSell, memo, priceType]);

  const handleSkip = useCallback(() => {
    skip();
  }, [skip]);

  const handleSharesChange = (value: number) => {
    // Round to nearest 100
    const rounded = Math.max(100, Math.round(value / 100) * 100);
    setShares(rounded);
  };

  const hasPosition = position !== null;
  const canUseNextOpen = nextCandle !== null;

  return (
    <div className="trade-panel">
      <h3>売買アクション</h3>

      {!hasPosition && (
        <div className="shares-input">
          <label>株数</label>
          <div className="shares-controls">
            <button
              className="shares-btn"
              onClick={() => handleSharesChange(shares - 100)}
              disabled={shares <= 100}
            >
              -100
            </button>
            <input
              type="number"
              value={shares}
              onChange={(e) => handleSharesChange(Number(e.target.value))}
              step={100}
              min={100}
            />
            <button
              className="shares-btn"
              onClick={() => handleSharesChange(shares + 100)}
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
          {!hasPosition && (
            <span className="capital-ratio">
              (概算: {totalCost.toLocaleString()}円 / {((totalCost / initialCapital) * 100).toFixed(1)}%)
            </span>
          )}
        </div>
      </div>

      <div className="trade-buttons">
        <button
          className="buy-btn"
          onClick={handleBuy}
          disabled={hasPosition || (priceType === "nextOpen" && !canUseNextOpen)}
          title={hasPosition ? "既にポジションを保有しています" : "買い"}
        >
          BUY
        </button>
        <button
          className="sell-btn"
          onClick={handleSell}
          disabled={!hasPosition || (priceType === "nextOpen" && !canUseNextOpen)}
          title={!hasPosition ? "ポジションがありません" : "売り"}
        >
          SELL
        </button>
        <button className="skip-btn" onClick={handleSkip} title="次の日へ">
          SKIP
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
