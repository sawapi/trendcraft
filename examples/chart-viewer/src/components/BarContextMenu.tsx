/**
 * Context menu for right-clicking on chart bars.
 * Rendered via Portal to document.body so it lives outside the chart DOM tree.
 * This prevents its appearance from triggering mouseout on the ECharts canvas.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useChartStore } from "../store/chartStore";

interface BarContextMenuProps {
  x: number;
  y: number;
  barIndex: number;
  onClose: () => void;
}

export function BarContextMenu({ x, y, barIndex, onClose }: BarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const backtestResult = useChartStore((s) => s.backtestResult);
  const setExplainBar = useChartStore((s) => s.setExplainBar);

  const hasBacktest = backtestResult !== null;

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

  return createPortal(
    <div ref={menuRef} className="drawing-context-menu" style={{ left: x, top: y }}>
      <button
        type="button"
        className={`ctx-menu-item ${!hasBacktest ? "disabled" : ""}`}
        disabled={!hasBacktest}
        title={
          !hasBacktest ? "Run a backtest first to explain signals" : "Explain signal at this bar"
        }
        onClick={() => {
          if (hasBacktest) {
            setExplainBar(barIndex);
            onClose();
          }
        }}
      >
        <span className="material-icons md-14">info</span>
        Explain This Bar
      </button>
    </div>,
    document.body,
  );
}
