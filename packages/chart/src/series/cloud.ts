/**
 * Cloud Series Renderer
 * Renders Ichimoku-style cloud (filled area between two lines) + additional lines.
 */

import { strokeNullableLine } from "../core/draw-helper";
import type { PriceScale, TimeScale } from "../core/scale";
import { type MinMax, emptyRange, reduceRange } from "../core/value-range";

export type CloudRenderOptions = {
  lineColors: Record<string, string>;
  bullishFillColor: string;
  bearishFillColor: string;
  lineWidth: number;
};

const DEFAULT_CLOUD_OPTIONS: CloudRenderOptions = {
  lineColors: {
    tenkan: "#0496ff",
    kijun: "#991515",
    senkouA: "#26a69a",
    senkouB: "#ef5350",
    chikou: "#9c27b0",
  },
  bullishFillColor: "rgba(76,175,80,0.15)",
  bearishFillColor: "rgba(244,67,54,0.15)",
  lineWidth: 1,
};

/**
 * Render Ichimoku cloud with fill between senkouA and senkouB.
 */
export function renderCloud(
  ctx: CanvasRenderingContext2D,
  channels: Map<string, (number | null)[]>,
  timeScale: TimeScale,
  priceScale: PriceScale,
  options: Partial<CloudRenderOptions> = {},
): void {
  const opts = { ...DEFAULT_CLOUD_OPTIONS, ...options };
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;

  const senkouA = channels.get("senkouA") ?? [];
  const senkouB = channels.get("senkouB") ?? [];

  // Fill cloud between senkouA and senkouB
  renderCloudFill(ctx, senkouA, senkouB, start, end, timeScale, priceScale, opts);

  // Render lines
  for (const [key, color] of Object.entries(opts.lineColors)) {
    const values = channels.get(key);
    if (!values) continue;
    strokeNullableLine(ctx, values, timeScale, priceScale, { color, lineWidth: opts.lineWidth });
  }
}

function renderCloudFill(
  ctx: CanvasRenderingContext2D,
  senkouA: readonly (number | null)[],
  senkouB: readonly (number | null)[],
  start: number,
  end: number,
  timeScale: TimeScale,
  priceScale: PriceScale,
  opts: CloudRenderOptions,
): void {
  const points: { x: number; aY: number; bY: number; bullish: boolean }[] = [];

  for (let i = start; i < end && i < senkouA.length && i < senkouB.length; i++) {
    const a = senkouA[i];
    const b = senkouB[i];
    if (a === null || a === undefined || b === null || b === undefined) {
      if (points.length > 1) drawCloudSegment(ctx, points, priceScale, opts);
      points.length = 0;
      continue;
    }
    points.push({
      x: timeScale.indexToX(i),
      aY: priceScale.priceToY(a),
      bY: priceScale.priceToY(b),
      bullish: a >= b,
    });
  }
  if (points.length > 1) drawCloudSegment(ctx, points, priceScale, opts);
}

function drawCloudSegment(
  ctx: CanvasRenderingContext2D,
  points: { x: number; aY: number; bY: number; bullish: boolean }[],
  _priceScale: PriceScale,
  opts: CloudRenderOptions,
): void {
  // Split by bullish/bearish segments for correct coloring
  let segStart = 0;
  for (let i = 1; i <= points.length; i++) {
    if (i === points.length || points[i].bullish !== points[segStart].bullish) {
      const seg = points.slice(segStart, i + (i < points.length ? 1 : 0));
      if (seg.length >= 2) {
        ctx.fillStyle = seg[0].bullish ? opts.bullishFillColor : opts.bearishFillColor;
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].aY);
        for (let j = 1; j < seg.length; j++) ctx.lineTo(seg[j].x, seg[j].aY);
        for (let j = seg.length - 1; j >= 0; j--) ctx.lineTo(seg[j].x, seg[j].bY);
        ctx.closePath();
        ctx.fill();
      }
      segStart = i;
    }
  }
}

/** Compute price range across all cloud channels */
export function cloudPriceRange(
  channels: Map<string, (number | null)[]>,
  startIndex: number,
  endIndex: number,
): [number, number] {
  let acc: MinMax = emptyRange();
  for (const [, vals] of channels) {
    acc = reduceRange(vals, startIndex, endIndex, acc);
  }
  return acc;
}
