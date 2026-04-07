/**
 * Crosshair Renderer — Draws crosshair lines, price label, and time label.
 */

import { autoFormatPrice, formatCrosshairTime, measureTextWidth } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, PaneRect, ThemeColors } from "../core/types";
import type { ViewportState } from "../core/viewport";

/**
 * Render crosshair lines across all panes.
 * Supports optional left scale labels for dual-scale panes.
 */
export function renderCrosshair(
  ctx: CanvasRenderingContext2D,
  viewportState: Readonly<ViewportState>,
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  timeScale: TimeScale,
  priceAxisX: number,
  timeAxisY: number,
  theme: ThemeColors,
  fontSize: number,
  candles?: readonly CandleData[],
  leftPriceScales?: Map<string, PriceScale>,
): void {
  if (viewportState.crosshairIndex === null) return;

  const x = timeScale.indexToX(viewportState.crosshairIndex);
  const mouseY = viewportState.mouseY;

  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = theme.crosshair;
  ctx.lineWidth = 1;

  // Vertical line through all panes
  for (const pane of paneRects) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, pane.y);
    ctx.lineTo(Math.round(x) + 0.5, pane.y + pane.height);
    ctx.stroke();
  }

  // Horizontal line in active pane only
  const activePane = paneRects.find((p) => p.id === viewportState.activePaneId);
  if (activePane) {
    const clampedY = Math.max(activePane.y, Math.min(mouseY, activePane.y + activePane.height));
    ctx.beginPath();
    ctx.moveTo(0, Math.round(clampedY) + 0.5);
    ctx.lineTo(priceAxisX, Math.round(clampedY) + 0.5);
    ctx.stroke();

    // Price label on right axis
    const ps = priceScales.get(activePane.id);
    if (ps) {
      const price = ps.yToPrice(clampedY - activePane.y);
      drawPriceLabel(ctx, price, priceAxisX, clampedY, theme, fontSize, "right");
    }

    // Price label on left axis (if left scale has series)
    const leftPs = leftPriceScales?.get(activePane.id);
    if (leftPs) {
      const leftPrice = leftPs.yToPrice(clampedY - activePane.y);
      drawPriceLabel(ctx, leftPrice, activePane.x, clampedY, theme, fontSize, "left");
    }
  }

  ctx.setLineDash([]);

  // Time label on time axis
  if (
    candles &&
    viewportState.crosshairIndex >= 0 &&
    viewportState.crosshairIndex < candles.length
  ) {
    const candle = candles[viewportState.crosshairIndex];
    if (candle) {
      drawTimeLabel(ctx, candle.time, x, timeAxisY, theme, fontSize);
    }
  }
}

function drawPriceLabel(
  ctx: CanvasRenderingContext2D,
  price: number,
  x: number,
  y: number,
  theme: ThemeColors,
  fontSize: number,
  position: "left" | "right" = "right",
): void {
  const label = autoFormatPrice(price);
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const padX = 6;
  const padY = 4;
  const labelWidth = measureTextWidth(ctx, label) + padX * 2;
  const labelHeight = fontSize + padY * 2;

  ctx.fillStyle = theme.crosshair;
  if (position === "left") {
    ctx.fillRect(x - labelWidth, y - labelHeight / 2, labelWidth, labelHeight);
    ctx.fillStyle = theme.background;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x - padX, y);
  } else {
    ctx.fillRect(x, y - labelHeight / 2, labelWidth, labelHeight);
    ctx.fillStyle = theme.background;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + padX, y);
  }
}

function drawTimeLabel(
  ctx: CanvasRenderingContext2D,
  time: number,
  x: number,
  y: number,
  theme: ThemeColors,
  fontSize: number,
): void {
  const label = formatCrosshairTime(time);
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const padX = 6;
  const padY = 3;
  const labelWidth = measureTextWidth(ctx, label) + padX * 2;
  const labelHeight = fontSize + padY * 2;

  ctx.fillStyle = theme.crosshair;
  ctx.fillRect(x - labelWidth / 2, y, labelWidth, labelHeight);

  ctx.fillStyle = theme.background;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x, y + padY);
}

// Price and time formatting delegated to core/format.ts
