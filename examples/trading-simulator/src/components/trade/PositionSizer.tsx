import { useCallback, useMemo, useState } from "react";
import type { Currency } from "../../types";
import { formatPrice } from "../../types";

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
  currency?: Currency;
  onApply: (shares: number) => void;
}

export function PositionSizer({
  estimatedPrice,
  initialCapital,
  stopLossPercent,
  currentAtr,
  currency = "JPY",
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
        <label>Method</label>
        <div className="sizing-method-buttons">
          <button
            className={`sizing-method-btn ${sizingMethod === "risk" ? "active" : ""}`}
            onClick={() => setSizingMethod("risk")}
          >
            Risk %
          </button>
          <button
            className={`sizing-method-btn ${sizingMethod === "atr" ? "active" : ""}`}
            onClick={() => setSizingMethod("atr")}
            disabled={!currentAtr}
            title={!currentAtr ? "Enable ATR indicator first" : ""}
          >
            ATR Based
          </button>
        </div>
      </div>

      <div className="sizing-inputs">
        <div className="sizing-input">
          <label>Risk Tolerance (%)</label>
          <input
            type="number"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value))}
            min={0.5}
            max={10}
            step={0.5}
          />
          <span className="sizing-hint">
            Capital {formatPrice(initialCapital, currency)} × {riskPercent}% ={" "}
            {formatPrice((initialCapital * riskPercent) / 100, currency)}
          </span>
        </div>

        {sizingMethod === "risk" && (
          <div className="sizing-input">
            <label>Stop Loss Price (0=default {stopLossPercent}%)</label>
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
            <label>ATR Multiplier</label>
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
              {formatPrice(currentAtr * atrMultiplier, currency)}
            </span>
          </div>
        )}
      </div>

      {sizingResult && (
        <div className="sizing-result">
          <div className="result-row">
            <span className="result-label">Recommended</span>
            <span className="result-value">{sizingResult.shares.toLocaleString()} shares</span>
          </div>
          <div className="result-row">
            <span className="result-label">Risk Amount</span>
            <span className="result-value">{formatPrice(sizingResult.riskAmount, currency)}</span>
          </div>
          <div className="result-row">
            <span className="result-label">Risk %</span>
            <span className="result-value">{sizingResult.riskPercent.toFixed(2)}%</span>
          </div>
          <button className="apply-sizing-btn" onClick={handleApply}>
            Apply
          </button>
        </div>
      )}

      {!sizingResult && <div className="sizing-error">Cannot calculate. Check parameters.</div>}
    </div>
  );
}
