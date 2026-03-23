/**
 * Area Series Renderer
 * Renders a line with filled area below it.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { DataPoint } from "../core/types";

export type AreaRenderOptions = {
  lineColor: string;
  fillColor: string;
  lineWidth: number;
  /** Fill to this value (default: bottom of pane) */
  baseline?: number;
};

const DEFAULT_AREA_OPTIONS: AreaRenderOptions = {
  lineColor: "#2196F3",
  fillColor: "rgba(33,150,243,0.15)",
  lineWidth: 1.5,
};

/**
 * Render an area series (line + fill below).
 */
export function renderArea(
  ctx: CanvasRenderingContext2D,
  data: readonly DataPoint<number | null>[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  options: Partial<AreaRenderOptions> = {},
): void {
  const opts = { ...DEFAULT_AREA_OPTIONS, ...options };
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const baselineY =
    opts.baseline !== undefined ? priceScale.priceToY(opts.baseline) : priceScale.height;

  // Collect valid segments
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  for (let i = start; i < end && i < data.length; i++) {
    const point = data[i];
    if (!point || point.value === null || point.value === undefined) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push({
      x: timeScale.indexToX(i),
      y: priceScale.priceToY(point.value),
    });
  }
  if (current.length > 0) segments.push(current);

  // Render each segment
  for (const seg of segments) {
    if (seg.length < 2) continue;

    // Fill
    ctx.fillStyle = opts.fillColor;
    ctx.beginPath();
    ctx.moveTo(seg[0].x, baselineY);
    for (const p of seg) ctx.lineTo(p.x, p.y);
    ctx.lineTo(seg[seg.length - 1].x, baselineY);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = opts.lineColor;
    ctx.lineWidth = opts.lineWidth;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.stroke();
  }
}
