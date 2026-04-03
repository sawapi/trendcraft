/**
 * Box Series Renderer
 * Renders rectangular zones (Order Blocks, FVG, etc.).
 */

import type { DataLayer } from "../core/data-layer";
import type { PriceScale, TimeScale } from "../core/scale";

export type BoxData = {
  startTime: number;
  endTime: number;
  highPrice: number;
  lowPrice: number;
  color?: string;
  label?: string;
};

export type BoxRenderOptions = {
  fillColor: string;
  borderColor: string;
  borderWidth: number;
};

const DEFAULT_BOX_OPTIONS: BoxRenderOptions = {
  fillColor: "rgba(33,150,243,0.1)",
  borderColor: "rgba(33,150,243,0.4)",
  borderWidth: 1,
};

/**
 * Render box zones from decomposed channel data.
 * Expects channels with startTime, endTime, highPrice, lowPrice arrays.
 */
export function renderBoxes(
  ctx: CanvasRenderingContext2D,
  data: readonly { value: unknown }[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  dataLayer: DataLayer,
  options: Partial<BoxRenderOptions> = {},
): void {
  const opts = { ...DEFAULT_BOX_OPTIONS, ...options };

  for (let i = timeScale.startIndex; i < timeScale.endIndex && i < data.length; i++) {
    const point = data[i];
    if (!point?.value || typeof point.value !== "object") continue;

    const val = point.value as Record<string, unknown>;
    const zone = val.zone as { start: number; end: number; high: number; low: number } | undefined;
    if (!zone) continue;

    const startIdx = dataLayer.indexAtTime(zone.start);
    const endIdx = dataLayer.indexAtTime(zone.end);

    const x1 = timeScale.indexToX(startIdx);
    const x2 = timeScale.indexToX(endIdx);
    const y1 = priceScale.priceToY(zone.high);
    const y2 = priceScale.priceToY(zone.low);

    const boxColor = val.type === "bullish" ? "rgba(38,166,154," : "rgba(239,83,80,";

    // Fill
    ctx.fillStyle = `${boxColor}0.1)`;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    // Border
    ctx.strokeStyle = `${boxColor}0.5)`;
    ctx.lineWidth = opts.borderWidth;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
}
