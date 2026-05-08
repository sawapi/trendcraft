import type { ChartInstance, ChartType, DrawingType } from "@trendcraft/chart";
import { useEffect, useState } from "react";

interface ChartToolbarProps {
  chart: ChartInstance | null;
}

const CHART_TYPES: ReadonlyArray<{ id: ChartType; label: string }> = [
  { id: "candlestick", label: "Candle" },
  { id: "line", label: "Line" },
  { id: "mountain", label: "Mountain" },
  { id: "ohlc", label: "OHLC" },
];

const DRAWING_TOOLS: ReadonlyArray<{ id: DrawingType; label: string; title: string }> = [
  { id: "hline", label: "H-Line", title: "Horizontal line" },
  { id: "vline", label: "V-Line", title: "Vertical line" },
  { id: "ray", label: "Trend", title: "Trend line / ray" },
  { id: "arrow", label: "Arrow", title: "Arrow" },
  { id: "rectangle", label: "Rect", title: "Rectangle" },
  { id: "channel", label: "Channel", title: "Parallel channel" },
  { id: "fibRetracement", label: "Fib", title: "Fibonacci retracement" },
  { id: "fibExtension", label: "Fib+", title: "Fibonacci extension" },
  { id: "textLabel", label: "Text", title: "Text label" },
];

/**
 * Toolbar pinned above the chart. Exposes the chart-type switcher, drawing
 * tools, and Fit content — the controls a user expects from a "complete"
 * chart demo. Studio is the flagship example, so feature parity with
 * simple-chart's drawing affordances and indicator-showcase's chart-type
 * cycle is intentional here.
 */
export function ChartToolbar({ chart }: ChartToolbarProps) {
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [activeTool, setActiveTool] = useState<DrawingType | null>(null);

  // Sync chart type. Kept separate from the drawing-tool sync so changing
  // the chart type mid-drawing doesn't cascade through `setDrawingTool` and
  // clear the in-progress anchor of a two-click drawing.
  useEffect(() => {
    if (!chart) return;
    chart.setChartType(chartType);
  }, [chart, chartType]);

  // Sync the active drawing tool only when it actually changes. Calling
  // `setDrawingTool` with the same value would still reset the in-progress
  // gesture (by design — see DrawingTool.setTool), so we must avoid firing
  // it for unrelated state changes (chart type, theme, etc.).
  useEffect(() => {
    if (!chart) return;
    chart.setDrawingTool(activeTool);
  }, [chart, activeTool]);

  // Mirror DrawingTool state changes (drawing completion, Escape hotkey,
  // any other path that clears or re-arms the tool) so the highlighted
  // button always matches the chart's actual active tool. Without this,
  // pressing Escape mid-drawing leaves the toolbar stuck and a follow-up
  // click would deactivate instead of re-arm.
  useEffect(() => {
    if (!chart) return;
    const onChange = (data: unknown) => {
      const next = (data as { tool: DrawingType | null } | null)?.tool ?? null;
      setActiveTool(next);
    };
    chart.on("drawingToolChanged", onChange);
    return () => chart.off("drawingToolChanged", onChange);
  }, [chart]);

  const onChartType = (id: ChartType) => {
    setChartType(id);
  };

  const onDrawingTool = (id: DrawingType) => {
    setActiveTool((prev) => (prev === id ? null : id));
  };

  const onClearDrawings = () => {
    setActiveTool(null);
    if (!chart) return;
    for (const d of chart.getDrawings()) chart.removeDrawing(d.id);
  };

  return (
    <div className="chart-toolbar" role="toolbar" aria-label="Chart controls">
      <div className="chart-toolbar-group" aria-label="Chart type">
        {CHART_TYPES.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`chart-toolbar-btn${chartType === t.id ? " active" : ""}`}
            onClick={() => onChartType(t.id)}
            title={`Chart type: ${t.label}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <span className="chart-toolbar-sep" aria-hidden="true" />

      <div className="chart-toolbar-group" aria-label="Drawing tools">
        {DRAWING_TOOLS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`chart-toolbar-btn${activeTool === t.id ? " active" : ""}`}
            onClick={() => onDrawingTool(t.id)}
            title={`${t.title} — click chart to place`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className="chart-toolbar-btn"
          onClick={onClearDrawings}
          title="Clear all drawings"
        >
          Clear
        </button>
      </div>

      <span className="chart-toolbar-sep" aria-hidden="true" />

      <button
        type="button"
        className="chart-toolbar-btn"
        onClick={() => chart?.fitContent()}
        title="Fit visible range to data"
      >
        Fit
      </button>
    </div>
  );
}
