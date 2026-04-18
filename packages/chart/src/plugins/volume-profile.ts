/**
 * Volume Profile Plugin — Renders a horizontal histogram of volume by price
 * level along the right edge of the chart.
 *
 * Each price bucket becomes a horizontal bar whose length is proportional
 * to the volume traded at that level. The Point of Control (POC) and
 * Value Area (VAH/VAL) are highlighted separately so the fair-value band
 * reads at a glance.
 *
 * @example
 * ```typescript
 * import { createChart, connectVolumeProfile } from '@trendcraft/chart';
 * import { volumeProfile } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 *
 * const profile = volumeProfile(candles, { levels: 30, period: 60 });
 * const handle = connectVolumeProfile(chart, profile);
 * // Later: handle.remove();
 * ```
 */

import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance } from "../core/types";

// ---- Public types ----

/**
 * Minimal duck-typed shape matching core's `VolumeProfileValue`.
 * Defined locally so the chart package stays runtime-free of `trendcraft`.
 */
export type VolumeProfileLevel = {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  volume: number;
  volumePercent: number;
};

export type VolumeProfileData = {
  levels: readonly VolumeProfileLevel[];
  poc: number;
  vah: number;
  val: number;
  periodHigh: number;
  periodLow: number;
};

export type VolumeProfileState = {
  profile: VolumeProfileData;
  /**
   * Width allocated to the histogram as a fraction of the pane width (0-1),
   * or as an absolute pixel count (> 1). Default 0.18 (18% of pane).
   */
  widthFraction?: number;
  /** Whether to draw inside the value area differently. Default true. */
  highlightValueArea?: boolean;
  /** Whether to draw a horizontal line at the POC. Default true. */
  showPoc?: boolean;
  /** Bar fill color (outside the value area). */
  barColor?: string;
  /** Bar fill color inside the value area (overrides barColor when highlightValueArea). */
  valueAreaColor?: string;
  /** POC line color. */
  pocColor?: string;
};

// ---- Defaults ----

const DEFAULT_BAR_COLOR = "rgba(100,149,237,0.35)";
const DEFAULT_VALUE_AREA_COLOR = "rgba(100,149,237,0.55)";
const DEFAULT_POC_COLOR = "rgba(255,193,7,0.85)";

// ---- Render ----

function renderVolumeProfile(
  { ctx, pane, priceScale }: PrimitiveRenderContext,
  state: VolumeProfileState,
): void {
  const {
    profile,
    widthFraction = 0.18,
    highlightValueArea = true,
    showPoc = true,
    barColor = DEFAULT_BAR_COLOR,
    valueAreaColor = DEFAULT_VALUE_AREA_COLOR,
    pocColor = DEFAULT_POC_COLOR,
  } = state;

  if (profile.levels.length === 0) return;

  // Max percent for normalization. Falls back to any positive value so a
  // single-level profile still renders.
  let maxPercent = 0;
  for (const lvl of profile.levels) {
    if (lvl.volumePercent > maxPercent) maxPercent = lvl.volumePercent;
  }
  if (maxPercent <= 0) return;

  // Reserve a strip on the right side of the pane for the histogram.
  const reservedWidth =
    widthFraction > 1 ? Math.min(widthFraction, pane.width) : pane.width * widthFraction;
  if (reservedWidth <= 0) return;
  const rightEdge = pane.x + pane.width;
  const stripLeft = rightEdge - reservedWidth;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();

  for (const level of profile.levels) {
    const topY = priceScale.priceToY(level.priceHigh);
    const bottomY = priceScale.priceToY(level.priceLow);
    const barHeight = Math.max(1, bottomY - topY);

    const barLen = (level.volumePercent / maxPercent) * reservedWidth;
    if (barLen <= 0) continue;

    const inValueArea = level.priceMid >= profile.val && level.priceMid <= profile.vah;
    ctx.fillStyle = highlightValueArea && inValueArea ? valueAreaColor : barColor;

    // Bar extends leftward from the right edge.
    ctx.fillRect(rightEdge - barLen, topY, barLen, barHeight);
  }

  // POC line — thin horizontal line across the entire pane width.
  if (showPoc) {
    const pocY = priceScale.priceToY(profile.poc);
    ctx.strokeStyle = pocColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pane.x, pocY);
    ctx.lineTo(rightEdge, pocY);
    ctx.stroke();
    ctx.setLineDash([]);

    // POC label
    ctx.fillStyle = pocColor;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("POC", rightEdge - 4, pocY - 2);
  }

  // Subtle divider between chart and histogram strip.
  ctx.strokeStyle = "rgba(128,128,128,0.2)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(stripLeft, pane.y);
  ctx.lineTo(stripLeft, pane.y + pane.height);
  ctx.stroke();

  ctx.restore();
}

// ---- Factory ----

type VolumeProfileOptions = Omit<VolumeProfileState, "profile">;

export function createVolumeProfile(
  profile: VolumeProfileData,
  options: VolumeProfileOptions = {},
): PrimitivePlugin<VolumeProfileState> {
  return definePrimitive<VolumeProfileState>({
    name: "volumeProfile",
    pane: "main",
    zOrder: "above",
    defaultState: { profile, ...options },
    render: renderVolumeProfile,
  });
}

// ---- Convenience connector ----

type VolumeProfileHandle = {
  update(profile: VolumeProfileData, options?: VolumeProfileOptions): void;
  remove(): void;
};

export function connectVolumeProfile(
  chart: ChartInstance,
  profile: VolumeProfileData,
  options: VolumeProfileOptions = {},
): VolumeProfileHandle {
  chart.registerPrimitive(createVolumeProfile(profile, options));

  return {
    update(newProfile, newOptions) {
      chart.registerPrimitive(createVolumeProfile(newProfile, newOptions ?? options));
    },
    remove() {
      chart.removePrimitive("volumeProfile");
    },
  };
}
