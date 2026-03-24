/**
 * Band Series Renderer
 * Renders upper/middle/lower bands with filled area (BB, KC, Donchian).
 */

import type { PriceScale, TimeScale } from "../core/scale";

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
  renderBandLine(ctx, upper, start, end, timeScale, priceScale, opts.upperColor, opts.lineWidth);
  renderBandLine(ctx, middle, start, end, timeScale, priceScale, opts.middleColor, opts.lineWidth);
  renderBandLine(ctx, lower, start, end, timeScale, priceScale, opts.lowerColor, opts.lineWidth);
}

function renderBandLine(
  ctx: CanvasRenderingContext2D,
  values: readonly (number | null)[],
  start: number,
  end: number,
  timeScale: TimeScale,
  priceScale: PriceScale,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.setLineDash([]);

  let drawing = false;
  ctx.beginPath();
  for (let i = start; i < end && i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) {
      drawing = false;
      continue;
    }
    const x = timeScale.indexToX(i);
    const y = priceScale.priceToY(val);
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
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
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = startIndex; i < endIndex; i++) {
    const u = i < upper.length ? upper[i] : null;
    const l = i < lower.length ? lower[i] : null;
    if (u !== null && u !== undefined) {
      if (u > max) max = u;
      if (u < min) min = u;
    }
    if (l !== null && l !== undefined) {
      if (l > max) max = l;
      if (l < min) min = l;
    }
  }
  return [min, max];
}
