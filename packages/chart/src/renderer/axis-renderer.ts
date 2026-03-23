/**
 * Axis Renderer — Draws price (Y) and time (X) axes.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

/**
 * Render the price axis (right side) for a pane.
 */
export function renderPriceAxis(
  ctx: CanvasRenderingContext2D,
  priceScale: PriceScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
  fontSize: number,
): void {
  const ticks = priceScale.getTicks();

  ctx.fillStyle = theme.background;
  ctx.fillRect(x, y, width, height);

  // Border line
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.stroke();

  // Tick labels
  ctx.fillStyle = theme.textSecondary;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (const tick of ticks) {
    const tickY = priceScale.priceToY(tick) + y;
    if (tickY < y || tickY > y + height) continue;
    ctx.fillText(formatPrice(tick), x + 6, tickY);
  }
}

/**
 * Render the time axis (bottom).
 */
export function renderTimeAxis(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
  fontSize: number,
): void {
  ctx.fillStyle = theme.background;
  ctx.fillRect(x, y, width + 100, height);

  // Top border
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();

  // Compute label interval
  const minLabelSpacing = 80;
  const barSpacing = timeScale.barSpacing;
  const labelInterval = Math.max(1, Math.ceil(minLabelSpacing / barSpacing));

  ctx.fillStyle = theme.textSecondary;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;

  for (let i = start; i < end && i < candles.length; i++) {
    if ((i - start) % labelInterval !== 0) continue;
    const candle = candles[i];
    if (!candle) continue;

    const labelX = timeScale.indexToX(i);
    const label = formatTime(candle.time);

    ctx.fillText(label, labelX, y + 6);
  }
}

/**
 * Render horizontal grid lines for a pane.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  priceScale: PriceScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
): void {
  const ticks = priceScale.getTicks();

  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;

  for (const tick of ticks) {
    const tickY = Math.round(priceScale.priceToY(tick) + y) + 0.5;
    if (tickY < y || tickY > y + height) continue;
    ctx.beginPath();
    ctx.moveTo(x, tickY);
    ctx.lineTo(x + width, tickY);
    ctx.stroke();
  }
}

/**
 * Render reference lines (e.g., 30/70 for RSI).
 */
export function renderReferenceLines(
  ctx: CanvasRenderingContext2D,
  lines: number[],
  priceScale: PriceScale,
  x: number,
  y: number,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  for (const val of lines) {
    const lineY = Math.round(priceScale.priceToY(val) + y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + width, lineY);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

// ---- Formatting Helpers ----

function formatPrice(price: number): string {
  if (Math.abs(price) >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`;
  if (Math.abs(price) >= 10_000) return `${(price / 1_000).toFixed(1)}K`;
  if (Math.abs(price) >= 100) return price.toFixed(1);
  if (Math.abs(price) >= 1) return price.toFixed(2);
  if (Math.abs(price) >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatTime(epoch: number): string {
  const d = new Date(epoch);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();

  if (hours === 0 && minutes === 0) {
    return `${month}/${day}`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}
