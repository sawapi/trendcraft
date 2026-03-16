/**
 * Context menu for right-clicking on drawings
 */

import { useEffect, useRef } from "react";
import { useChartStore } from "../store/chartStore";

const COLOR_PRESETS = ["#ff9800", "#2196f3", "#4caf50", "#f44336", "#9c27b0", "#ffffff"];

interface DrawingContextMenuProps {
  x: number;
  y: number;
  drawingId: string;
  onClose: () => void;
}

export function DrawingContextMenu({ x, y, drawingId, onClose }: DrawingContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const removeDrawing = useChartStore((s) => s.removeDrawing);
  const updateDrawing = useChartStore((s) => s.updateDrawing);
  const drawings = useChartStore((s) => s.drawings);

  const drawing = drawings.find((d) => d.id === drawingId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  if (!drawing) return null;

  return (
    <div ref={menuRef} className="drawing-context-menu" style={{ left: x, top: y }}>
      <button
        type="button"
        className="ctx-menu-item"
        onClick={() => {
          removeDrawing(drawingId);
          onClose();
        }}
      >
        <span className="material-icons md-14">delete</span>
        Delete
      </button>
      <button
        type="button"
        className="ctx-menu-item"
        onClick={() => {
          updateDrawing(drawingId, { visible: !drawing.visible });
          onClose();
        }}
      >
        <span className="material-icons md-14">
          {drawing.visible ? "visibility_off" : "visibility"}
        </span>
        {drawing.visible ? "Hide" : "Show"}
      </button>
      <div className="ctx-menu-divider" />
      <div className="ctx-menu-colors">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            className={`ctx-color-swatch ${drawing.color === color ? "active" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => {
              updateDrawing(drawingId, { color });
              onClose();
            }}
          />
        ))}
      </div>
      <div className="ctx-menu-divider" />
      <div className="ctx-menu-row">
        <span className="ctx-menu-label">Width</span>
        {[1, 2, 3].map((w) => (
          <button
            key={w}
            type="button"
            className={`ctx-width-btn ${drawing.lineWidth === w ? "active" : ""}`}
            onClick={() => {
              updateDrawing(drawingId, { lineWidth: w });
              onClose();
            }}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
