/**
 * Heatmap Series Renderer
 * Renders a rolling Volume Profile's POC, VAH and VAL as stepped lines: each
 * bar draws its own window's levels, so the lines follow the data, not the
 * scroll position. (Per-level volume bars are not drawn; see
 * HeatmapRenderOptions.)
 */

import type { PriceScale, TimeScale } from "../core/scale";

export type HeatmapLevel = {
  price: number;
  width: number; // Normalized 0-1 (fraction of max volume at level)
};

export type HeatmapRenderOptions = {
  /** Reserved for per-level volume bars, which are not drawn yet: no effect. */
  barColor: string;
  pocColor: string;
  vahValColor: string;
  /** Reserved for per-level volume bars, which are not drawn yet: no effect. */
  maxBarWidth: number;
};

const DEFAULT_HEATMAP_OPTIONS: HeatmapRenderOptions = {
  barColor: "rgba(33,150,243,0.2)",
  pocColor: "#FF9800",
  vahValColor: "rgba(255,152,0,0.4)",
  maxBarWidth: 0.3,
};

/** Draw one channel as a step line: a flat segment across each bar's slot. */
function strokeSteps(
  ctx: CanvasRenderingContext2D,
  values: readonly (number | null | undefined)[],
  timeScale: TimeScale,
  priceScale: PriceScale,
): void {
  const half = timeScale.barSpacing / 2;
  ctx.beginPath();
  let open = false;
  let drawn = false;
  for (
    let i = Math.max(0, timeScale.startIndex);
    i < timeScale.endIndex && i < values.length;
    i++
  ) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      open = false;
      continue;
    }
    const x = timeScale.indexToX(i);
    const y = Math.round(priceScale.priceToY(v)) + 0.5;
    if (open) ctx.lineTo(x - half, y);
    else ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
    open = true;
    drawn = true;
  }
  if (drawn) ctx.stroke();
}

/**
 * Render a rolling Volume Profile's POC (solid) and VAH / VAL (dashed) as
 * stepped lines over the visible bars.
 */
export function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  channels: Map<string, (number | null)[]>,
  timeScale: TimeScale,
  priceScale: PriceScale,
  _paneWidth: number,
  options: Partial<HeatmapRenderOptions> = {},
): void {
  const opts = { ...DEFAULT_HEATMAP_OPTIONS, ...options };
  const poc = channels.get("poc");
  const vah = channels.get("vah");
  const val = channels.get("val");

  if (poc) {
    ctx.strokeStyle = opts.pocColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    strokeSteps(ctx, poc, timeScale, priceScale);
  }
  ctx.strokeStyle = opts.vahValColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  if (vah) strokeSteps(ctx, vah, timeScale, priceScale);
  if (val) strokeSteps(ctx, val, timeScale, priceScale);
  ctx.setLineDash([]);
}
