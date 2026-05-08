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
  /**
   * Draw a filled circle at each bar's value point. Makes it explicit
   * that the underlying data is discrete-per-bar and the line is just
   * linear interpolation — useful for SMA / EMA / RSI etc. where the
   * exact bar position of a crossing matters. Pass radius and color
   * (default radius = 2.5 px, color = `options.color`).
   *
   * Skipped when `barSpacing < 5` to avoid the dots smearing into a
   * solid mass at high zoom-out.
   */
  markers?: { radius: number; color: string };
};

/** Minimum bar spacing (px) at which marker dots are still drawn. */
const MARKER_MIN_BAR_SPACING = 5;

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
  /**
   * When provided, iterates `0..data.length` and uses
   * `indexToX(originalIndices[i])` for screen x — letting LTTB-decimated
   * arrays share the timeScale coordinate space with non-decimated series.
   * `startIndex` is ignored in this mode.
   */
  originalIndices?: readonly number[] | Int32Array,
): void {
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (options.dash) ctx.setLineDash(options.dash);
  else ctx.setLineDash([]);

  let drawing = false;
  ctx.beginPath();

  const bucketed = !!originalIndices;
  const iStart = bucketed ? 0 : startIndex;
  const iEnd = bucketed ? data.length : Math.min(timeScale.endIndex, data.length);

  for (let i = iStart; i < iEnd; i++) {
    const point = data[i];
    if (!point || point.value === null || point.value === undefined) {
      drawing = false;
      continue;
    }

    const x = timeScale.indexToX(bucketed ? originalIndices[i] : i);
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

  // Marker dots — drawn after the stroke so they sit on top of the line.
  // Skipped at high zoom-out (small bar spacing) to avoid a solid smear.
  if (options.markers && timeScale.barSpacing >= MARKER_MIN_BAR_SPACING) {
    const radius = options.markers.radius;
    ctx.fillStyle = options.markers.color;
    for (let i = iStart; i < iEnd; i++) {
      const point = data[i];
      if (!point || point.value === null || point.value === undefined) continue;
      const x = timeScale.indexToX(bucketed ? originalIndices[i] : i);
      const y = priceScale.priceToY(point.value);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
