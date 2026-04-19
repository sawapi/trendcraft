/**
 * Band Series Renderer
 * Renders upper/middle/lower bands with filled area (BB, KC, Donchian).
 */

import { strokeNullableLine } from "../core/draw-helper";
import type { PriceScale, TimeScale } from "../core/scale";
import { reduceRange } from "../core/value-range";

export type BandRenderOptions = {
  upperColor: string;
  middleColor: string;
  lowerColor: string;
  fillColor: string;
  lineWidth: number;
};

const DEFAULT_BAND_OPTIONS: BandRenderOptions = {
  upperColor: "#2196F3",
  middleColor: "#FF9800",
  lowerColor: "#2196F3",
  fillColor: "rgba(33,150,243,0.08)",
  lineWidth: 1,
};

/**
 * Render band series (upper, middle, lower lines + filled area between upper/lower).
 */
export function renderBand(
  ctx: CanvasRenderingContext2D,
  upper: readonly (number | null)[],
  middle: readonly (number | null)[],
  lower: readonly (number | null)[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  options: Partial<BandRenderOptions> = {},
): void {
  const opts = { ...DEFAULT_BAND_OPTIONS, ...options };
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;

  // Fill area between upper and lower
  renderFillBetween(ctx, upper, lower, start, end, timeScale, priceScale, opts.fillColor);

  // Lines
  const lw = opts.lineWidth;
  strokeNullableLine(ctx, upper, timeScale, priceScale, { color: opts.upperColor, lineWidth: lw });
  strokeNullableLine(ctx, middle, timeScale, priceScale, {
    color: opts.middleColor,
    lineWidth: lw,
  });
  strokeNullableLine(ctx, lower, timeScale, priceScale, { color: opts.lowerColor, lineWidth: lw });
}

function renderFillBetween(
  ctx: CanvasRenderingContext2D,
  upper: readonly (number | null)[],
  lower: readonly (number | null)[],
  start: number,
  end: number,
  timeScale: TimeScale,
  priceScale: PriceScale,
  fillColor: string,
): void {
  // Collect valid segments where both upper and lower have values
  const points: { x: number; upperY: number; lowerY: number }[] = [];

  for (let i = start; i < end && i < upper.length && i < lower.length; i++) {
    const u = upper[i];
    const l = lower[i];
    if (u === null || u === undefined || l === null || l === undefined) {
      // Draw accumulated segment
      if (points.length > 1) {
        drawFillSegment(ctx, points, fillColor);
      }
      points.length = 0;
      continue;
    }
    points.push({
      x: timeScale.indexToX(i),
      upperY: priceScale.priceToY(u),
      lowerY: priceScale.priceToY(l),
    });
  }

  if (points.length > 1) {
    drawFillSegment(ctx, points, fillColor);
  }
}

function drawFillSegment(
  ctx: CanvasRenderingContext2D,
  points: { x: number; upperY: number; lowerY: number }[],
  fillColor: string,
): void {
  ctx.fillStyle = fillColor;
  ctx.beginPath();

  // Upper line (left to right)
  ctx.moveTo(points[0].x, points[0].upperY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].upperY);
  }

  // Lower line (right to left)
  for (let i = points.length - 1; i >= 0; i--) {
    ctx.lineTo(points[i].x, points[i].lowerY);
  }

  ctx.closePath();
  ctx.fill();
}

/** Compute price range across all band channels */
export function bandPriceRange(
  upper: readonly (number | null)[],
  lower: readonly (number | null)[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  return reduceRange(lower, startIndex, endIndex, reduceRange(upper, startIndex, endIndex));
}
