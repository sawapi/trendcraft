import { useMemo, useState } from "react";
import type { BracketOrder } from "../../types";

interface BracketOrderFormProps {
  entryPrice: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  onChange: (bracket: BracketOrder | null) => void;
}

export function BracketOrderForm({
  entryPrice,
  defaultStopLossPercent,
  defaultTakeProfitPercent,
  onChange,
}: BracketOrderFormProps) {
  const [enabled, setEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState(() =>
    Math.round(entryPrice * (1 + defaultTakeProfitPercent / 100)),
  );
  const [slPrice, setSlPrice] = useState(() =>
    Math.round(entryPrice * (1 - defaultStopLossPercent / 100)),
  );

  const rrRatio = useMemo(() => {
    if (entryPrice <= 0 || slPrice >= entryPrice || tpPrice <= entryPrice) return null;
    const risk = entryPrice - slPrice;
    const reward = tpPrice - entryPrice;
    return reward / risk;
  }, [entryPrice, slPrice, tpPrice]);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (checked) {
      const tp = Math.round(entryPrice * (1 + defaultTakeProfitPercent / 100));
      const sl = Math.round(entryPrice * (1 - defaultStopLossPercent / 100));
      setTpPrice(tp);
      setSlPrice(sl);
      onChange({ takeProfitPrice: tp, stopLossPrice: sl });
    } else {
      onChange(null);
    }
  };

  const handleTpChange = (value: number) => {
    setTpPrice(value);
    onChange({ takeProfitPrice: value, stopLossPrice: slPrice });
  };

  const handleSlChange = (value: number) => {
    setSlPrice(value);
    onChange({ takeProfitPrice: tpPrice, stopLossPrice: value });
  };

  return (
    <div className="bracket-order-form">
      <div className="bracket-header">
        <label className="bracket-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          Bracket Order (TP/SL)
        </label>
      </div>

      {enabled && (
        <div className="bracket-inputs">
          <div className="bracket-row">
            <label className="bracket-label tp">TP</label>
            <input
              type="number"
              value={tpPrice}
              onChange={(e) => handleTpChange(Number(e.target.value))}
              min={0}
              step={1}
            />
            <span className="bracket-pct">
              +{entryPrice > 0 ? (((tpPrice - entryPrice) / entryPrice) * 100).toFixed(1) : "0"}%
            </span>
          </div>
          <div className="bracket-row">
            <label className="bracket-label entry">Entry</label>
            <span className="bracket-entry-price">{entryPrice.toLocaleString()}</span>
          </div>
          <div className="bracket-row">
            <label className="bracket-label sl">SL</label>
            <input
              type="number"
              value={slPrice}
              onChange={(e) => handleSlChange(Number(e.target.value))}
              min={0}
              step={1}
            />
            <span className="bracket-pct">
              {entryPrice > 0 ? (((slPrice - entryPrice) / entryPrice) * 100).toFixed(1) : "0"}%
            </span>
          </div>
          {rrRatio != null && (
            <div className="bracket-rr">
              R:R = 1:{rrRatio.toFixed(2)}
              <span
                className={`rr-quality ${rrRatio >= 2 ? "good" : rrRatio >= 1 ? "ok" : "poor"}`}
              >
                {rrRatio >= 2 ? " (Good)" : rrRatio >= 1 ? " (Fair)" : " (Poor)"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
