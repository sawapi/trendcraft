/**
 * Crosshair Renderer — Draws crosshair lines and price/time labels.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { PaneRect, ThemeColors } from "../core/types";
import type { ViewportState } from "../core/viewport";

/**
 * Render crosshair lines across all panes.
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
      drawPriceLabel(ctx, price, priceAxisX, clampedY, theme, fontSize);
    }
  }

  ctx.setLineDash([]);
}

function drawPriceLabel(
  ctx: CanvasRenderingContext2D,
  price: number,
  x: number,
  y: number,
  theme: ThemeColors,
  fontSize: number,
): void {
  const label = formatCrosshairPrice(price);
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const metrics = ctx.measureText(label);
  const padX = 6;
  const padY = 4;
  const labelWidth = metrics.width + padX * 2;
  const labelHeight = fontSize + padY * 2;

  // Background
  ctx.fillStyle = theme.crosshair;
  ctx.fillRect(x, y - labelHeight / 2, labelWidth, labelHeight);

  // Text
  ctx.fillStyle = theme.background;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + padX, y);
}

function formatCrosshairPrice(price: number): string {
  if (Math.abs(price) >= 100) return price.toFixed(2);
  if (Math.abs(price) >= 1) return price.toFixed(3);
  return price.toFixed(6);
}
