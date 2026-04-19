/**
 * Line Series Renderer
 * Renders a continuous line from Series<number> or decomposed channels.
 */

import { strokeNullableLine } from "../core/draw-helper";
import type { PriceScale, TimeScale } from "../core/scale";
import type { DataPoint } from "../core/types";
import { reduceRange } from "../core/value-range";

export type LineRenderOptions = {
  color: string;
  lineWidth: number;
  /** Dash pattern (e.g., [4, 2] for dashed) */
  dash?: number[];
};

/**
 * Render a line series on the canvas.
 * Handles null gaps by breaking the line.
 */
export function renderLine(
  ctx: CanvasRenderingContext2D,
  data: readonly DataPoint<number | null>[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  startIndex: number,
  options: LineRenderOptions,
): void {
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (options.dash) ctx.setLineDash(options.dash);
  else ctx.setLineDash([]);

  const end = timeScale.endIndex;
  let drawing = false;

  ctx.beginPath();
  for (let i = timeScale.startIndex; i < end && i < data.length; i++) {
    const point = data[i];
    if (!point || point.value === null || point.value === undefined) {
      drawing = false;
      continue;
    }

    const x = timeScale.indexToX(i);
    const y = priceScale.priceToY(point.value);

    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Render a line from a pre-aligned number array (channel data).
 * Index in the array corresponds directly to candle index.
 */
export function renderChannelLine(
  ctx: CanvasRenderingContext2D,
  values: readonly (number | null)[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  options: LineRenderOptions,
): void {
  strokeNullableLine(ctx, values, timeScale, priceScale, {
    color: options.color,
    lineWidth: options.lineWidth,
    dash: options.dash,
  });
}

/** Compute min/max of visible data for auto-ranging */
export function linePriceRange(
  data: readonly DataPoint<number | null>[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const lim = Math.min(endIndex, data.length);
  for (let i = startIndex; i < lim; i++) {
    const val = data[i]?.value;
    if (val === null || val === undefined) continue;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return [min, max];
}

/** Compute min/max from channel values array */
export function channelPriceRange(
  values: readonly (number | null)[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  return reduceRange(values, startIndex, endIndex);
}
