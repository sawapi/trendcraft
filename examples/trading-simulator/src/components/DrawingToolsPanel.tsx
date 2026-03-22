import { useCallback, useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { formatPrice } from "../types";
import { CollapsiblePanel } from "./CollapsiblePanel";

const LINE_COLORS = ["#fbbf24", "#38bdf8", "#4ade80", "#f472b6", "#a78bfa", "#ffffff"];

export function DrawingToolsPanel() {
  const {
    drawings,
    addDrawing,
    removeDrawing,
    clearDrawings,
    getCurrentCandle,
    symbols,
    activeSymbolId,
  } = useSimulatorStore();

  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);
  const activeCurrency = activeSymbol?.currency ?? "JPY";

  const [hLinePrice, setHLinePrice] = useState<string>("");
  const [hLineColor, setHLineColor] = useState(LINE_COLORS[0]);
  const [hLineLabel, setHLineLabel] = useState("");

  const currentCandle = getCurrentCandle();

  const handleAddHorizontalLine = useCallback(() => {
    const price = Number(hLinePrice);
    if (Number.isNaN(price) || price <= 0) return;

    addDrawing({
      type: "horizontal",
      price,
      color: hLineColor,
      label: hLineLabel || undefined,
    });

    setHLinePrice("");
    setHLineLabel("");
  }, [hLinePrice, hLineColor, hLineLabel, addDrawing]);

  const handleAddAtCurrentPrice = useCallback(() => {
    if (!currentCandle) return;
    addDrawing({
      type: "horizontal",
      price: currentCandle.close,
      color: hLineColor,
      label: hLineLabel || `${currentCandle.close.toLocaleString()}`,
    });
    setHLineLabel("");
  }, [currentCandle, hLineColor, hLineLabel, addDrawing]);

  return (
    <div className="drawing-tools-panel">
      <CollapsiblePanel title="Drawing Tools" storageKey="drawing-tools">
        {/* Horizontal Line */}
        <div className="drawing-section">
          <label>Horizontal Line</label>
          <div className="drawing-input-row">
            <input
              type="number"
              placeholder="Price"
              value={hLinePrice}
              onChange={(e) => setHLinePrice(e.target.value)}
              className="drawing-price-input"
            />
            <input
              type="text"
              placeholder="Label"
              value={hLineLabel}
              onChange={(e) => setHLineLabel(e.target.value)}
              className="drawing-label-input"
            />
          </div>
          <div className="drawing-color-row">
            {LINE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch ${hLineColor === color ? "active" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => setHLineColor(color)}
              />
            ))}
          </div>
          <div className="drawing-btn-row">
            <button type="button" className="btn-small" onClick={handleAddHorizontalLine}>
              Add Line
            </button>
            <button
              type="button"
              className="btn-small btn-secondary"
              onClick={handleAddAtCurrentPrice}
            >
              At Current Price
            </button>
          </div>
        </div>

        {/* Drawing List */}
        {drawings.length > 0 && (
          <div className="drawing-list">
            <div className="drawing-list-header">
              <span>Active Lines ({drawings.length})</span>
              <button type="button" className="btn-tiny" onClick={clearDrawings}>
                Clear All
              </button>
            </div>
            {drawings.map((d) => (
              <div key={d.id} className="drawing-item">
                <span className="drawing-swatch" style={{ backgroundColor: d.color }} />
                <span className="drawing-info">
                  {d.type === "horizontal"
                    ? formatPrice(d.price || 0, activeCurrency)
                    : "Trendline"}
                  {d.label && <span className="drawing-item-label"> ({d.label})</span>}
                </span>
                <button
                  type="button"
                  className="drawing-remove"
                  onClick={() => removeDrawing(d.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </CollapsiblePanel>
    </div>
  );
}
