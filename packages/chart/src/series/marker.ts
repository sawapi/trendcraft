/**
 * Marker Series Renderer
 * Renders dot markers (e.g., Parabolic SAR points).
 */

import type { PriceScale, TimeScale } from "../core/scale";

export type MarkerRenderOptions = {
  color: string;
  radius: number;
};

const DEFAULT_MARKER_OPTIONS: MarkerRenderOptions = {
  color: "#FF9800",
  radius: 2,
};

/**
 * Render dot markers from a channel of price values.
 */
export function renderMarkers(
  ctx: CanvasRenderingContext2D,
  values: readonly (number | null)[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  options: Partial<MarkerRenderOptions> = {},
): void {
  const opts = { ...DEFAULT_MARKER_OPTIONS, ...options };
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;

  ctx.fillStyle = opts.color;
  // One path and one fill for all dots. A dot within a pixel of the last one
  // drawn covers the same pixels, so it is skipped: zoomed out to 0.1px
  // spacing, most dots are (ops #124).
  ctx.beginPath();
  let lastX = Number.NaN;
  let lastY = 0;

  for (let i = start; i < end && i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) continue;

    const x = timeScale.indexToX(i);
    const y = priceScale.priceToY(val);
    if (Math.abs(x - lastX) < 1 && Math.abs(y - lastY) < 1) continue;
    lastX = x;
    lastY = y;

    ctx.moveTo(x + opts.radius, y);
    ctx.arc(x, y, opts.radius, 0, Math.PI * 2);
  }
  ctx.fill();
}
