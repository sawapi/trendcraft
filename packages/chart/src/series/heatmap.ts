/**
 * Heatmap Series Renderer
 * Renders Volume Profile as horizontal bars at price levels.
 */

import type { PriceScale, TimeScale } from "../core/scale";

export type HeatmapLevel = {
  price: number;
  width: number; // Normalized 0-1 (fraction of max volume at level)
};

export type HeatmapRenderOptions = {
  barColor: string;
  pocColor: string;
  vahValColor: string;
  maxBarWidth: number; // Max width as fraction of pane width (default: 0.3)
};

const DEFAULT_HEATMAP_OPTIONS: HeatmapRenderOptions = {
  barColor: "rgba(33,150,243,0.2)",
  pocColor: "#FF9800",
  vahValColor: "rgba(255,152,0,0.4)",
  maxBarWidth: 0.3,
};

/**
 * Render Volume Profile heatmap on the main pane.
 * Each level is a horizontal bar whose width represents volume at that price.
 */
export function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  channels: Map<string, (number | null)[]>,
  timeScale: TimeScale,
  priceScale: PriceScale,
  paneWidth: number,
  options: Partial<HeatmapRenderOptions> = {},
): void {
  const opts = { ...DEFAULT_HEATMAP_OPTIONS, ...options };
  const poc = channels.get("poc");
  const vah = channels.get("vah");
  const val = channels.get("val");

  // Draw POC line
  if (poc) {
    for (let i = timeScale.startIndex; i < timeScale.endIndex && i < poc.length; i++) {
      const v = poc[i];
      if (v === null || v === undefined) continue;
      const y = priceScale.priceToY(v);
      ctx.strokeStyle = opts.pocColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(paneWidth, Math.round(y) + 0.5);
      ctx.stroke();
      break; // POC is typically one value per period
    }
  }

  // Draw VAH/VAL lines
  for (const [key, values] of [
    ["vah", vah],
    ["val", val],
  ] as const) {
    if (!values) continue;
    for (let i = timeScale.startIndex; i < timeScale.endIndex && i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined) continue;
      const y = priceScale.priceToY(v);
      ctx.strokeStyle = opts.vahValColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(paneWidth, Math.round(y) + 0.5);
      ctx.stroke();
      break;
    }
  }
  ctx.setLineDash([]);
}
