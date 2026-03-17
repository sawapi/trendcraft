import { useCallback, useMemo, useState } from "react";

type SizingMethod = "risk" | "atr";

interface SizingResult {
  shares: number;
  riskAmount: number;
  riskPercent: number;
}

interface PositionSizerProps {
  estimatedPrice: number;
  initialCapital: number;
  stopLossPercent: number;
  currentAtr: number | null;
  onApply: (shares: number) => void;
}

export function PositionSizer({
  estimatedPrice,
  initialCapital,
  stopLossPercent,
  currentAtr,
  onApply,
}: PositionSizerProps) {
  const [sizingMethod, setSizingMethod] = useState<SizingMethod>("risk");
  const [riskPercent, setRiskPercent] = useState(2);
  const [customStopLoss, setCustomStopLoss] = useState(0);
  const [atrMultiplier, setAtrMultiplier] = useState(2);

  const sizingResult: SizingResult | null = useMemo(() => {
    if (estimatedPrice <= 0) return null;

    let stopLossPrice: number;

    switch (sizingMethod) {
      case "risk":
        stopLossPrice =
          customStopLoss > 0 ? customStopLoss : estimatedPrice * (1 - stopLossPercent / 100);
        break;
      case "atr":
        if (!currentAtr) return null;
        stopLossPrice = estimatedPrice - currentAtr * atrMultiplier;
        break;
      default:
        return null;
    }

    const riskPerShare = estimatedPrice - stopLossPrice;
    if (riskPerShare <= 0) return null;

    const maxRiskAmount = initialCapital * (riskPercent / 100);
    const calculatedShares = Math.floor(maxRiskAmount / riskPerShare);
    const shares = Math.max(1, calculatedShares);

    return {
      shares,
      riskAmount: shares * riskPerShare,
      riskPercent: ((shares * riskPerShare) / initialCapital) * 100,
    };
  }, [
    sizingMethod,
    estimatedPrice,
    stopLossPercent,
    riskPercent,
    customStopLoss,
    currentAtr,
    atrMultiplier,
    initialCapital,
  ]);

  const handleApply = useCallback(() => {
    if (sizingResult) {
      onApply(sizingResult.shares);
    }
  }, [sizingResult, onApply]);

  return (
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
          <span className="sizing-hint">
            資金{initialCapital.toLocaleString()}円 × {riskPercent}% ={" "}
            {((initialCapital * riskPercent) / 100).toLocaleString()}円
          </span>
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
            <span className="sizing-hint">
              ATR: {currentAtr.toFixed(2)} × {atrMultiplier} ={" "}
              {(currentAtr * atrMultiplier).toFixed(2)}円
            </span>
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
            <span className="result-value">
              {sizingResult.riskAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}円
            </span>
          </div>
          <div className="result-row">
            <span className="result-label">リスク率</span>
            <span className="result-value">{sizingResult.riskPercent.toFixed(2)}%</span>
          </div>
          <button className="apply-sizing-btn" onClick={handleApply}>
            この株数を適用
          </button>
        </div>
      )}

      {!sizingResult && (
        <div className="sizing-error">計算できません。パラメータを確認してください。</div>
      )}
    </div>
  );
}
