/**
 * Drawing Renderer — Renders user-drawn elements (hline, trendline, fib).
 */

import type { DataLayer } from "../core/data-layer";
import { autoFormatPrice } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type {
  ArrowDrawing,
  ChannelDrawing,
  Drawing,
  FibExtensionDrawing,
  FibRetracementDrawing,
  HLineDrawing,
  HRayDrawing,
  PaneRect,
  RayDrawing,
  RectangleDrawing,
  TextLabelDrawing,
  ThemeColors,
  TrendLineDrawing,
  VLineDrawing,
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
      case "ray":
        renderRay(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme);
        break;
      case "hray":
        renderHRay(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme);
        break;
      case "vline":
        renderVLine(ctx, drawing, mainPane, timeScale, dataLayer, theme);
        break;
      case "rectangle":
        renderRectangle(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme);
        break;
      case "channel":
        renderChannel(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme);
        break;
      case "fibExtension":
        renderFibExtension(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme, fontSize);
        break;
      case "textLabel":
        renderTextLabel(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme, fontSize);
        break;
      case "arrow":
        renderArrow(ctx, drawing, mainPane, ps, timeScale, dataLayer, theme);
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

function renderRay(
  ctx: CanvasRenderingContext2D,
  drawing: RayDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
): void {
  const x1 = timeScale.indexToX(dataLayer.indexAtTime(drawing.startTime));
  const y1 = ps.priceToY(drawing.startPrice) + pane.y;
  const x2 = timeScale.indexToX(dataLayer.indexAtTime(drawing.endTime));
  const y2 = ps.priceToY(drawing.endPrice) + pane.y;

  const color = drawing.color ?? "#2196F3";
  ctx.strokeStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1.5;
  ctx.setLineDash([]);

  // Compute far point by extending the ray to the pane boundary
  const dx = x2 - x1;
  const dy = y2 - y1;
  let farX: number;
  let farY: number;

  if (Math.abs(dx) < 0.001) {
    // Near-vertical ray
    farX = x2;
    farY = dy >= 0 ? pane.y + pane.height : pane.y;
  } else {
    // Extend toward right or left pane edge
    const targetX = dx > 0 ? pane.x + pane.width : pane.x;
    const t = (targetX - x1) / dx;
    farY = y1 + t * dy;
    farX = targetX;

    // Clamp to pane vertical bounds if needed
    if (farY < pane.y) {
      const tTop = (pane.y - y1) / dy;
      farX = x1 + tTop * dx;
      farY = pane.y;
    } else if (farY > pane.y + pane.height) {
      const tBot = (pane.y + pane.height - y1) / dy;
      farX = x1 + tBot * dx;
      farY = pane.y + pane.height;
    }
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(farX, farY);
  ctx.stroke();

  // Start point dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x1, y1, 3, 0, Math.PI * 2);
  ctx.fill();
}

function renderHRay(
  ctx: CanvasRenderingContext2D,
  drawing: HRayDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  _theme: ThemeColors,
): void {
  const x = timeScale.indexToX(dataLayer.indexAtTime(drawing.time));
  const y = ps.priceToY(drawing.price) + pane.y;
  const color = drawing.color ?? "#FF9800";

  ctx.strokeStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(x, Math.round(y) + 0.5);
  ctx.lineTo(pane.x + pane.width, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Anchor dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function renderVLine(
  ctx: CanvasRenderingContext2D,
  drawing: VLineDrawing,
  pane: PaneRect,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
): void {
  const x = timeScale.indexToX(dataLayer.indexAtTime(drawing.time));
  const color = drawing.color ?? "#9C27B0";

  ctx.strokeStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, pane.y);
  ctx.lineTo(Math.round(x) + 0.5, pane.y + pane.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function renderRectangle(
  ctx: CanvasRenderingContext2D,
  drawing: RectangleDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  _theme: ThemeColors,
): void {
  const x1 = timeScale.indexToX(dataLayer.indexAtTime(drawing.startTime));
  const y1 = ps.priceToY(drawing.startPrice) + pane.y;
  const x2 = timeScale.indexToX(dataLayer.indexAtTime(drawing.endTime));
  const y2 = ps.priceToY(drawing.endPrice) + pane.y;

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  const color = drawing.color ?? "#2196F3";

  // Fill
  ctx.fillStyle = drawing.fillColor ?? color;
  ctx.globalAlpha = 0.15;
  ctx.fillRect(left, top, w, h);
  ctx.globalAlpha = 1;

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1;
  ctx.setLineDash([]);
  ctx.strokeRect(left, top, w, h);
}

function renderChannel(
  ctx: CanvasRenderingContext2D,
  drawing: ChannelDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  _theme: ThemeColors,
): void {
  const x1 = timeScale.indexToX(dataLayer.indexAtTime(drawing.startTime));
  const y1 = ps.priceToY(drawing.startPrice) + pane.y;
  const x2 = timeScale.indexToX(dataLayer.indexAtTime(drawing.endTime));
  const y2 = ps.priceToY(drawing.endPrice) + pane.y;

  // Offset line (parallel)
  const y1o = ps.priceToY(drawing.startPrice + drawing.channelWidth) + pane.y;
  const y2o = ps.priceToY(drawing.endPrice + drawing.channelWidth) + pane.y;

  const color = drawing.color ?? "#26a69a";

  // Fill between the two lines
  ctx.fillStyle = drawing.fillColor ?? color;
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, y2o);
  ctx.lineTo(x1, y1o);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Main line
  ctx.strokeStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Offset line
  ctx.beginPath();
  ctx.moveTo(x1, y1o);
  ctx.lineTo(x2, y2o);
  ctx.stroke();
}

const DEFAULT_FIB_EXT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618];
const FIB_EXT_COLORS = [
  "#787b86", // 0
  "#f44336", // 0.236
  "#ff9800", // 0.382
  "#4caf50", // 0.5
  "#2196f3", // 0.618
  "#9c27b0", // 0.786
  "#787b86", // 1
  "#e91e63", // 1.272
  "#00bcd4", // 1.618
  "#ff5722", // 2
  "#3f51b5", // 2.618
];

function renderFibExtension(
  ctx: CanvasRenderingContext2D,
  drawing: FibExtensionDrawing,
  pane: PaneRect,
  ps: PriceScale,
  _timeScale: TimeScale,
  _dataLayer: DataLayer,
  _theme: ThemeColors,
  fontSize: number,
): void {
  const levels = drawing.levels ?? DEFAULT_FIB_EXT_LEVELS;
  const priceRange = drawing.endPrice - drawing.startPrice;

  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const price = drawing.startPrice + priceRange * level;
    const y = ps.priceToY(price) + pane.y;
    const color = FIB_EXT_COLORS[i % FIB_EXT_COLORS.length];

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
      const nextPrice = drawing.startPrice + priceRange * levels[i + 1];
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

function renderTextLabel(
  ctx: CanvasRenderingContext2D,
  drawing: TextLabelDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
  defaultFontSize: number,
): void {
  const x = timeScale.indexToX(dataLayer.indexAtTime(drawing.time));
  const y = ps.priceToY(drawing.price) + pane.y;
  const size = drawing.fontSize ?? defaultFontSize;
  const color = drawing.color ?? theme.text;

  ctx.font = `${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(drawing.text);
  const padX = 4;
  const padY = 2;
  const labelW = metrics.width + padX * 2;
  const labelH = size + padY * 2;

  // Background
  if (drawing.backgroundColor) {
    ctx.fillStyle = drawing.backgroundColor;
    ctx.fillRect(x - padX, y - labelH / 2, labelW, labelH);
  }

  // Text
  ctx.fillStyle = color;
  ctx.fillText(drawing.text, x, y);
}

function renderArrow(
  ctx: CanvasRenderingContext2D,
  drawing: ArrowDrawing,
  pane: PaneRect,
  ps: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  _theme: ThemeColors,
): void {
  const x1 = timeScale.indexToX(dataLayer.indexAtTime(drawing.startTime));
  const y1 = ps.priceToY(drawing.startPrice) + pane.y;
  const x2 = timeScale.indexToX(dataLayer.indexAtTime(drawing.endTime));
  const y2 = ps.priceToY(drawing.endPrice) + pane.y;

  const color = drawing.color ?? "#2196F3";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = drawing.lineWidth ?? 1.5;
  ctx.setLineDash([]);

  // Line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrowhead at end point
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 10;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}
