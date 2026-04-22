/**
 * Crosshair Renderer — Draws crosshair lines, price label, and time label.
 *
 * Supports three snap modes (see CrosshairMode):
 * - "normal": free y, time-index snap only
 * - "magnet": y snaps to the active bar's close
 * - "magnetOHLC": y snaps to the nearest of O/H/L/C on the active bar, within a pixel threshold
 */

import { pickReadableTextColor } from "../core/color-utils";
import { autoFormatPrice, formatCrosshairTime, measureTextWidth } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, CrosshairMode, PaneRect, ThemeColors } from "../core/types";
import type { ViewportState } from "../core/viewport";

export type CrosshairRenderOptions = {
  mode?: CrosshairMode;
  /** Pixel threshold for magnetOHLC snapping (default 12). */
  snapThreshold?: number;
};

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
  options?: CrosshairRenderOptions,
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
    const rawY = Math.max(activePane.y, Math.min(mouseY, activePane.y + activePane.height));

    // Apply magnet snap (main pane only — OHLC is meaningless elsewhere).
    // magnetOHLC falls back to the raw y when no candidate is within threshold.
    const ps = priceScales.get(activePane.id);
    let snappedY = rawY;
    const mode = options?.mode ?? "normal";
    if (mode !== "normal" && ps && candles && activePane.id === "main") {
      const candle = candles[viewportState.crosshairIndex];
      if (candle) {
        snappedY = snapCrosshairY(
          rawY,
          candle,
          ps,
          activePane.y,
          mode,
          options?.snapThreshold ?? 12,
        );
      }
    }

    ctx.beginPath();
    ctx.moveTo(0, Math.round(snappedY) + 0.5);
    ctx.lineTo(priceAxisX, Math.round(snappedY) + 0.5);
    ctx.stroke();

    // Price label on right axis
    if (ps) {
      const price = ps.yToPrice(snappedY - activePane.y);
      drawPriceLabel(ctx, price, priceAxisX, snappedY, theme, fontSize, "right");
    }

    // Price label on left axis (if left scale has series)
    const leftPs = leftPriceScales?.get(activePane.id);
    if (leftPs) {
      const leftPrice = leftPs.yToPrice(snappedY - activePane.y);
      drawPriceLabel(ctx, leftPrice, activePane.x, snappedY, theme, fontSize, "left");
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

/**
 * Snap the crosshair y-coordinate based on mode.
 * - "magnet"     → always snap to close
 * - "magnetOHLC" → nearest of O/H/L/C within `thresholdPx`, else raw y
 */
function snapCrosshairY(
  rawY: number,
  candle: CandleData,
  ps: PriceScale,
  paneY: number,
  mode: CrosshairMode,
  thresholdPx: number,
): number {
  if (mode === "magnet") {
    return paneY + ps.priceToY(candle.close);
  }
  // magnetOHLC — pick closest of the four within threshold
  const candidates: number[] = [
    paneY + ps.priceToY(candle.open),
    paneY + ps.priceToY(candle.high),
    paneY + ps.priceToY(candle.low),
    paneY + ps.priceToY(candle.close),
  ];
  let best = rawY;
  let bestDist = thresholdPx;
  for (const y of candidates) {
    const d = Math.abs(y - rawY);
    if (d < bestDist) {
      bestDist = d;
      best = y;
    }
  }
  return best;
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
  const textColor = pickReadableTextColor(theme.crosshair, theme.background);
  if (position === "left") {
    ctx.fillRect(x - labelWidth, y - labelHeight / 2, labelWidth, labelHeight);
    ctx.fillStyle = textColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x - padX, y);
  } else {
    ctx.fillRect(x, y - labelHeight / 2, labelWidth, labelHeight);
    ctx.fillStyle = textColor;
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

  ctx.fillStyle = pickReadableTextColor(theme.crosshair, theme.background);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x, y + padY);
}

// Price and time formatting delegated to core/format.ts
