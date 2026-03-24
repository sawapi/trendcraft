/**
 * Drawing Renderer — Renders user-drawn elements (hline, trendline, fib).
 */

import type { DataLayer } from "../core/data-layer";
import { autoFormatPrice } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type {
  Drawing,
  FibRetracementDrawing,
  HLineDrawing,
  PaneRect,
  ThemeColors,
  TrendLineDrawing,
} from "../core/types";

const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = [
  "#787b86", // 0
  "#f44336", // 0.236
  "#ff9800", // 0.382
  "#4caf50", // 0.5
  "#2196f3", // 0.618
  "#9c27b0", // 0.786
  "#787b86", // 1
];

/**
 * Render all drawings on the main pane.
 */
export function renderDrawings(
  ctx: CanvasRenderingContext2D,
  drawings: readonly Drawing[],
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
  fontSize: number,
): void {
  if (drawings.length === 0) return;

  const mainPane = paneRects.find((p) => p.id === "main");
  if (!mainPane) return;

  const ps = priceScales.get("main");
  if (!ps) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mainPane.x, mainPane.y, mainPane.width + 60, mainPane.height);
  ctx.clip();

  for (const drawing of drawings) {
    switch (drawing.type) {
      case "hline":
        renderHLine(ctx, drawing, mainPane, ps, theme, fontSize);
        break;
      case "trendline":
        renderTrendLine(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme);
        break;
      case "fibRetracement":
        renderFibRetracement(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme, fontSize);
        break;
    }
  }

  ctx.restore();
}

function renderHLine(
  ctx: CanvasRenderingContext2D,
  drawing: HLineDrawing,
  pane: PaneRect,
  ps: PriceScale,
  theme: ThemeColors,
  fontSize: number,
): void {
  const y = ps.priceToY(drawing.price) + pane.y;
  const color = drawing.color ?? "#FF9800";

  ctx.strokeStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(pane.x, Math.round(y) + 0.5);
  ctx.lineTo(pane.x + pane.width, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Price label
  const label = autoFormatPrice(drawing.price);
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const metrics = ctx.measureText(label);
  const padX = 4;
  const padY = 2;
  const labelW = metrics.width + padX * 2;
  const labelH = fontSize + padY * 2;

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(pane.x + pane.width, y - labelH / 2, labelW, labelH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pane.x + pane.width + padX, y);
}

function renderTrendLine(
  ctx: CanvasRenderingContext2D,
  drawing: TrendLineDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
): void {
  const startIdx = dataLayer.indexAtTime(drawing.startTime);
  const endIdx = dataLayer.indexAtTime(drawing.endTime);

  const x1 = timeScale.indexToX(startIdx);
  const y1 = ps.priceToY(drawing.startPrice) + pane.y;
  const x2 = timeScale.indexToX(endIdx);
  const y2 = ps.priceToY(drawing.endPrice) + pane.y;

  const color = drawing.color ?? "#2196F3";
  ctx.strokeStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Endpoints
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x1, y1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x2, y2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function renderFibRetracement(
  ctx: CanvasRenderingContext2D,
  drawing: FibRetracementDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
  fontSize: number,
): void {
  const levels = drawing.levels ?? DEFAULT_FIB_LEVELS;
  const priceRange = drawing.endPrice - drawing.startPrice;

  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const price = drawing.endPrice - priceRange * level;
    const y = ps.priceToY(price) + pane.y;
    const color = FIB_COLORS[i % FIB_COLORS.length];

    // Horizontal line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(level === 0 || level === 1 ? [] : [4, 3]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(pane.x, Math.round(y) + 0.5);
    ctx.lineTo(pane.x + pane.width, Math.round(y) + 0.5);
    ctx.stroke();

    // Fill between levels
    if (i < levels.length - 1) {
      const nextPrice = drawing.endPrice - priceRange * levels[i + 1];
      const nextY = ps.priceToY(nextPrice) + pane.y;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.04;
      ctx.fillRect(pane.x, Math.min(y, nextY), pane.width, Math.abs(nextY - y));
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // Label
    const pct = (level * 100).toFixed(1);
    const label = `${pct}% (${autoFormatPrice(price)})`;
    ctx.fillStyle = color;
    ctx.fillText(label, pane.x + 4, y);
  }
}
