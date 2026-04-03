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

  for (let i = start; i < end && i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) continue;

    const x = timeScale.indexToX(i);
    const y = priceScale.priceToY(val);

    ctx.beginPath();
    ctx.arc(x, y, opts.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
