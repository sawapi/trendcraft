/**
 * Mountain (Area) Chart Renderer — Close price line with filled area below.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

export function renderMountainChart(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  theme: ThemeColors,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const points: { x: number; y: number }[] = [];

  for (let i = start; i < end && i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;
    points.push({
      x: timeScale.indexToX(i),
      y: priceScale.priceToY(candle.close),
    });
  }

  if (points.length < 2) return;

  const baseY = priceScale.height;

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, baseY);
  gradient.addColorStop(0, `${theme.upColor}40`);
  gradient.addColorStop(1, `${theme.upColor}05`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(points[0].x, baseY);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.lineTo(points[points.length - 1].x, baseY);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = theme.upColor;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}
