/**
 * Drawing toolbar (left side) for interactive drawing tools
 */

import { useCallback, useState } from "react";
import { useChartStore } from "../store/chartStore";
import type { DrawingToolType, HLineDrawing } from "../types";

const TOOLS: { type: DrawingToolType; icon: string; label: string }[] = [
  { type: "cursor", icon: "near_me", label: "Cursor" },
  { type: "hline", icon: "horizontal_rule", label: "Horizontal Line" },
  { type: "trendline", icon: "trending_up", label: "Trend Line" },
  { type: "fibRetracement", icon: "layers", label: "Fibonacci" },
  { type: "rect", icon: "crop_landscape", label: "Rectangle" },
  { type: "text", icon: "text_fields", label: "Text" },
];

let drawingIdCounter = 0;
function generateId(): string {
  return `drawing-${Date.now()}-${++drawingIdCounter}`;
}

export function DrawingToolbar() {
  const activeDrawingTool = useChartStore((state) => state.activeDrawingTool);
  const setActiveDrawingTool = useChartStore((state) => state.setActiveDrawingTool);
  const addDrawing = useChartStore((state) => state.addDrawing);
  const drawings = useChartStore((state) => state.drawings);
  const clearDrawings = useChartStore((state) => state.clearDrawings);
  const undoDrawing = useChartStore((state) => state.undoDrawing);
  const redoDrawing = useChartStore((state) => state.redoDrawing);
  const pendingPoint = useChartStore((state) => state.pendingPoint);

  const [showPriceInput, setShowPriceInput] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  const handleToolClick = useCallback(
    (type: DrawingToolType) => {
      if (type === "hline") {
        setShowPriceInput(true);
        setActiveDrawingTool(type);
      } else {
        setShowPriceInput(false);
        setActiveDrawingTool(type);
      }
    },
    [setActiveDrawingTool],
  );

  const handleAddHLine = useCallback(() => {
    const price = Number.parseFloat(priceInput);
    if (Number.isNaN(price)) return;

    const drawing: HLineDrawing = {
      id: generateId(),
      type: "hline",
      color: "#ff9800",
      lineWidth: 1,
      visible: true,
      price,
    };
    addDrawing(drawing);
    setPriceInput("");
  }, [priceInput, addDrawing]);

  const handlePriceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleAddHLine();
      } else if (e.key === "Escape") {
        setShowPriceInput(false);
        setActiveDrawingTool("cursor");
      }
    },
    [handleAddHLine, setActiveDrawingTool],
  );

  return (
    <div className="drawing-toolbar">
      {TOOLS.map(({ type, icon, label }) => (
        <button
          key={type}
          type="button"
          className={`drawing-tool-btn ${activeDrawingTool === type ? "active" : ""}`}
          onClick={() => handleToolClick(type)}
          title={label}
        >
          <span className="material-icons md-18">{icon}</span>
        </button>
      ))}

      <div className="drawing-toolbar-divider" />

      <button
        type="button"
        className="drawing-tool-btn"
        onClick={undoDrawing}
        title="Undo (Ctrl+Z)"
      >
        <span className="material-icons md-18">undo</span>
      </button>
      <button
        type="button"
        className="drawing-tool-btn"
        onClick={redoDrawing}
        title="Redo (Ctrl+Y)"
      >
        <span className="material-icons md-18">redo</span>
      </button>

      {drawings.length > 0 && (
        <button
          type="button"
          className="drawing-tool-btn drawing-tool-danger"
          onClick={clearDrawings}
          title="Clear All Drawings"
        >
          <span className="material-icons md-18">delete_sweep</span>
        </button>
      )}

      {showPriceInput && (
        <div className="drawing-price-input">
          <input
            type="number"
            placeholder="Price"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onKeyDown={handlePriceKeyDown}
            // biome-ignore lint/a11y/noAutofocus: UX requires immediate focus
            autoFocus
          />
          <button type="button" onClick={handleAddHLine} title="Add">
            <span className="material-icons md-14">check</span>
          </button>
        </div>
      )}

      {activeDrawingTool !== "cursor" && activeDrawingTool !== "hline" && (
        <div className="drawing-pending-hint">
          <span className="material-icons md-14">{pendingPoint ? "adjust" : "touch_app"}</span>
          {pendingPoint ? "2nd point" : activeDrawingTool === "text" ? "Place" : "1st point"}
        </div>
      )}
    </div>
  );
}
