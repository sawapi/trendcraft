/**
 * Context menu for right-clicking on chart bars.
 * Rendered via Portal to document.body so it lives outside the chart DOM tree.
 * This prevents its appearance from triggering mouseout on the ECharts canvas.
 */

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { PatternSignal } from "trendcraft";
import { useSignals } from "../hooks/useSignals";
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
  const setReplayPattern = useChartStore((s) => s.setReplayPattern);
  const currentCandles = useChartStore((s) => s.currentCandles);
  const enabledSignals = useChartStore((s) => s.enabledSignals);
  const indicatorParams = useChartStore((s) => s.indicatorParams);

  const signals = useSignals(currentCandles, enabledSignals, indicatorParams);

  const hasBacktest = backtestResult !== null;

  // Find the highest-confidence pattern at this bar
  const patternAtBar: PatternSignal | null = useMemo(() => {
    if (!signals.chartPatterns || !enabledSignals.includes("chartPatterns")) return null;
    const barTime = currentCandles[barIndex]?.time;
    if (!barTime) return null;

    const matching = signals.chartPatterns.filter((p) => {
      return barTime >= p.pattern.startTime && barTime <= p.pattern.endTime;
    });
    if (matching.length === 0) return null;

    // Pick highest confidence
    return matching.reduce((best, p) => (p.confidence > best.confidence ? p : best));
  }, [signals.chartPatterns, enabledSignals, currentCandles, barIndex]);

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
      <button
        type="button"
        className={`ctx-menu-item ${!patternAtBar ? "disabled" : ""}`}
        disabled={!patternAtBar}
        title={
          patternAtBar
            ? `Replay ${patternAtBar.type.replace(/_/g, " ")} pattern`
            : "No pattern at this bar"
        }
        onClick={() => {
          if (patternAtBar) {
            setReplayPattern(patternAtBar);
            onClose();
          }
        }}
      >
        <span className="material-icons md-14">play_circle</span>
        Replay Pattern
      </button>
    </div>,
    document.body,
  );
}
