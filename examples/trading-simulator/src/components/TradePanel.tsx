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

// ポジションサイジング計算タイプ
type SizingMethod = "fixed" | "risk" | "atr";

interface SizingResult {
  shares: number;
  riskAmount: number;
  riskPercent: number;
}

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
    stopLossPercent,
    indicatorData,
    currentIndex,
    startIndex,
  } = useSimulatorStore();

  const [buyShares, setBuyShares] = useState(100);
  const [sellShares, setSellShares] = useState(100);
  const [memo, setMemo] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("nextOpen");
  const [exitReason, setExitReason] = useState<ExitReason>("MANUAL");
  const [exitTrigger, setExitTrigger] = useState<ExitTrigger | undefined>(undefined);

  // ポジションサイジング計算機の状態
  const [showSizingCalc, setShowSizingCalc] = useState(false);
  const [sizingMethod, setSizingMethod] = useState<SizingMethod>("risk");
  const [riskPercent, setRiskPercent] = useState(2); // 資金に対するリスク%
  const [customStopLoss, setCustomStopLoss] = useState(0); // カスタム損切り価格
  const [atrMultiplier, setAtrMultiplier] = useState(2); // ATR倍率

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

  // 現在のATR値を取得
  const currentAtr = useMemo(() => {
    if (!indicatorData?.atr) return null;
    const visibleIndex = currentIndex - startIndex;
    return indicatorData.atr[visibleIndex] ?? null;
  }, [indicatorData, currentIndex, startIndex]);

  // ポジションサイジング計算
  const sizingResult: SizingResult | null = useMemo(() => {
    if (estimatedPrice <= 0) return null;

    let stopLossPrice: number;

    switch (sizingMethod) {
      case "risk":
        // 固定リスク%方式: デフォルトの損切り%を使用
        stopLossPrice = customStopLoss > 0
          ? customStopLoss
          : estimatedPrice * (1 - stopLossPercent / 100);
        break;
      case "atr":
        // ATRベース方式
        if (!currentAtr) return null;
        stopLossPrice = estimatedPrice - (currentAtr * atrMultiplier);
        break;
      case "fixed":
      default:
        // 固定株数（計算不要）
        return null;
    }

    const riskPerShare = estimatedPrice - stopLossPrice;
    if (riskPerShare <= 0) return null;

    const maxRiskAmount = initialCapital * (riskPercent / 100);
    const calculatedShares = Math.floor(maxRiskAmount / riskPerShare / 100) * 100; // 100株単位
    const shares = Math.max(100, calculatedShares);

    return {
      shares,
      riskAmount: shares * riskPerShare,
      riskPercent: (shares * riskPerShare / initialCapital) * 100,
    };
  }, [sizingMethod, estimatedPrice, stopLossPercent, riskPercent, customStopLoss, currentAtr, atrMultiplier, initialCapital]);

  // 計算結果を買い株数に反映
  const applySizingResult = useCallback(() => {
    if (sizingResult) {
      setBuyShares(sizingResult.shares);
      setShowSizingCalc(false);
    }
  }, [sizingResult]);

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
        <div className="shares-header">
          <label>買い株数</label>
          <button
            className="sizing-calc-toggle"
            onClick={() => setShowSizingCalc(!showSizingCalc)}
            title="ポジションサイジング計算機"
          >
            {showSizingCalc ? "✕ 閉じる" : "📊 計算機"}
          </button>
        </div>
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

      {/* Position Sizing Calculator */}
      {showSizingCalc && (
        <div className="sizing-calculator">
          <div className="sizing-method-selector">
            <label>計算方式</label>
            <div className="sizing-method-buttons">
              <button
                className={`sizing-method-btn ${sizingMethod === "risk" ? "active" : ""}`}
                onClick={() => setSizingMethod("risk")}
              >
                リスク%
              </button>
              <button
                className={`sizing-method-btn ${sizingMethod === "atr" ? "active" : ""}`}
                onClick={() => setSizingMethod("atr")}
                disabled={!currentAtr}
                title={!currentAtr ? "ATRインジケーターを有効にしてください" : ""}
              >
                ATRベース
              </button>
            </div>
          </div>

          <div className="sizing-inputs">
            <div className="sizing-input">
              <label>リスク許容度 (%)</label>
              <input
                type="number"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                min={0.5}
                max={10}
                step={0.5}
              />
              <span className="sizing-hint">資金{initialCapital.toLocaleString()}円 × {riskPercent}% = {(initialCapital * riskPercent / 100).toLocaleString()}円</span>
            </div>

            {sizingMethod === "risk" && (
              <div className="sizing-input">
                <label>損切り価格 (0=デフォルト{stopLossPercent}%)</label>
                <input
                  type="number"
                  value={customStopLoss}
                  onChange={(e) => setCustomStopLoss(Number(e.target.value))}
                  min={0}
                  step={1}
                />
              </div>
            )}

            {sizingMethod === "atr" && currentAtr && (
              <div className="sizing-input">
                <label>ATR倍率</label>
                <input
                  type="number"
                  value={atrMultiplier}
                  onChange={(e) => setAtrMultiplier(Number(e.target.value))}
                  min={1}
                  max={5}
                  step={0.5}
                />
                <span className="sizing-hint">ATR: {currentAtr.toFixed(2)} × {atrMultiplier} = {(currentAtr * atrMultiplier).toFixed(2)}円</span>
              </div>
            )}
          </div>

          {sizingResult && (
            <div className="sizing-result">
              <div className="result-row">
                <span className="result-label">推奨株数</span>
                <span className="result-value">{sizingResult.shares.toLocaleString()}株</span>
              </div>
              <div className="result-row">
                <span className="result-label">リスク金額</span>
                <span className="result-value">{sizingResult.riskAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}円</span>
              </div>
              <div className="result-row">
                <span className="result-label">リスク率</span>
                <span className="result-value">{sizingResult.riskPercent.toFixed(2)}%</span>
              </div>
              <button className="apply-sizing-btn" onClick={applySizingResult}>
                この株数を適用
              </button>
            </div>
          )}

          {!sizingResult && sizingMethod !== "fixed" && (
            <div className="sizing-error">
              計算できません。パラメータを確認してください。
            </div>
          )}
        </div>
      )}

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
