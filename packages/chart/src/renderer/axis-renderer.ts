/**
 * Axis Renderer — Draws price (Y) and time (X) axes.
 */

import { autoFormatPrice, autoFormatTime } from "../core/format";
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
  priceFormatter: (price: number) => string = autoFormatPrice,
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
    ctx.fillText(priceFormatter(tick), x + 6, tickY);
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
  timeFormatter?: (time: number) => string,
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
  let prevLabelTime: number | null = null;

  for (let i = start; i < end && i < candles.length; i++) {
    if ((i - start) % labelInterval !== 0) continue;
    const candle = candles[i];
    if (!candle) continue;

    const labelX = timeScale.indexToX(i);
    const label = timeFormatter
      ? timeFormatter(candle.time)
      : autoFormatTime(candle.time, prevLabelTime);
    prevLabelTime = candle.time;

    ctx.fillText(label, labelX, y + 6);
  }
}

/**
 * Render horizontal grid lines for a pane.
 * Optionally renders vertical grid lines aligned with time axis ticks.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  priceScale: PriceScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
  timeScale?: TimeScale,
  candles?: readonly CandleData[],
): void {
  const ticks = priceScale.getTicks();

  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;

  // Horizontal grid lines
  for (const tick of ticks) {
    const tickY = Math.round(priceScale.priceToY(tick) + y) + 0.5;
    if (tickY < y || tickY > y + height) continue;
    ctx.beginPath();
    ctx.moveTo(x, tickY);
    ctx.lineTo(x + width, tickY);
    ctx.stroke();
  }

  // Vertical grid lines (aligned with time axis labels)
  if (timeScale && candles) {
    const minLabelSpacing = 80;
    const labelInterval = Math.max(1, Math.ceil(minLabelSpacing / timeScale.barSpacing));
    const start = timeScale.startIndex;
    const end = timeScale.endIndex;

    for (let i = start; i < end && i < candles.length; i++) {
      if ((i - start) % labelInterval !== 0) continue;
      const gridX = Math.round(timeScale.indexToX(i)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(gridX, y);
      ctx.lineTo(gridX, y + height);
      ctx.stroke();
    }
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

// Formatting delegated to core/format.ts
