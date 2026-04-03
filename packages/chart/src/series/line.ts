/**
 * Line Series Renderer
 * Renders a continuous line from Series<number> or decomposed channels.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { DataPoint } from "../core/types";

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
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (options.dash) ctx.setLineDash(options.dash);
  else ctx.setLineDash([]);

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
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
  ctx.setLineDash([]);
}

/** Compute min/max of visible data for auto-ranging */
export function linePriceRange(
  data: readonly DataPoint<number | null>[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = startIndex; i < endIndex && i < data.length; i++) {
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
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = startIndex; i < endIndex && i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) continue;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return [min, max];
}
