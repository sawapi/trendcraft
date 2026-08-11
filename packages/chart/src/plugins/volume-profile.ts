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

import { withPaneClip } from "../core/draw-helper";
import { canvasFont } from "../core/font";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import { definePrimitive } from "../core/plugin-types";
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
  /**
   * Whether to draw horizontal lines and labels at the Value Area High and
   * Low (VAH / VAL). Default true. The shaded fill from
   * `highlightValueArea` only marks which levels are *inside* the area —
   * these explicit lines are what TradingView, Bookmap and most volume
   * profile tools draw so the upper and lower bounds are readable as
   * specific price levels at a glance.
   */
  showValueAreaBounds?: boolean;
  /** Bar fill color (outside the value area). */
  barColor?: string;
  /** Bar fill color inside the value area (overrides barColor when highlightValueArea). */
  valueAreaColor?: string;
  /** POC line color. */
  pocColor?: string;
  /** Color of the VAH and VAL boundary lines. */
  valueAreaBoundsColor?: string;
};

// ---- Defaults ----

const DEFAULT_BAR_COLOR = "rgba(100,149,237,0.35)";
const DEFAULT_VALUE_AREA_COLOR = "rgba(100,149,237,0.55)";
const DEFAULT_POC_COLOR = "rgba(255,193,7,0.85)";
// Same hue as the value-area shading but opaque enough to read as a line.
const DEFAULT_VALUE_AREA_BOUNDS_COLOR = "rgba(100,149,237,0.75)";

// ---- Render ----

function renderVolumeProfile(
  { ctx, pane, priceScale, fontFamily }: PrimitiveRenderContext,
  state: VolumeProfileState,
): void {
  const {
    profile,
    widthFraction = 0.18,
    highlightValueArea = true,
    showPoc = true,
    showValueAreaBounds = true,
    barColor = DEFAULT_BAR_COLOR,
    valueAreaColor = DEFAULT_VALUE_AREA_COLOR,
    pocColor = DEFAULT_POC_COLOR,
    valueAreaBoundsColor = DEFAULT_VALUE_AREA_BOUNDS_COLOR,
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

  withPaneClip(ctx, pane, () => {
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

    // VAH / VAL — boundary lines for the value area. Drawn before POC so a
    // POC that sits exactly on VAH or VAL gets the brighter highlight on top.
    if (showValueAreaBounds) {
      ctx.strokeStyle = valueAreaBoundsColor;
      ctx.fillStyle = valueAreaBoundsColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.font = canvasFont(10, fontFamily);
      ctx.textAlign = "right";

      const vahY = priceScale.priceToY(profile.vah);
      ctx.beginPath();
      ctx.moveTo(pane.x, vahY);
      ctx.lineTo(rightEdge, vahY);
      ctx.stroke();
      ctx.textBaseline = "bottom";
      ctx.fillText("VAH", rightEdge - 4, vahY - 2);

      const valY = priceScale.priceToY(profile.val);
      ctx.beginPath();
      ctx.moveTo(pane.x, valY);
      ctx.lineTo(rightEdge, valY);
      ctx.stroke();
      ctx.textBaseline = "top";
      ctx.fillText("VAL", rightEdge - 4, valY + 2);

      ctx.setLineDash([]);
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
      ctx.font = canvasFont(10, fontFamily);
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
  });
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
