/**
 * S/R Zone Confluence Plugin — Visualizes multi-source support/resistance zones
 * as strength-colored horizontal bands.
 *
 * Zone opacity and width scale with strength score (0-100).
 * Sources are labeled: swing, pivot, VWAP, round, volumeProfile, custom.
 *
 * @example
 * ```typescript
 * import { createChart, connectSrConfluence } from '@trendcraft/chart';
 * import { srZones } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const result = srZones(candles);
 * const handle = connectSrConfluence(chart, result.zones);
 * ```
 */

import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance } from "../core/types";

// ---- Types (duck-typed) ----

type SrZoneData = {
  price: number;
  low: number;
  high: number;
  strength: number;
  touchCount?: number;
  sourceDiversity?: number;
  sources?: string[];
};

type SrConfluenceState = {
  zones: readonly SrZoneData[];
};

// ---- Colors ----

// Strength gradient: low=blue, mid=yellow, high=red
function strengthToRgb(strength: number): string {
  if (strength <= 50) {
    const t = strength / 50;
    const r = Math.round(33 + (255 - 33) * t);
    const g = Math.round(150 + (193 - 150) * t);
    const b = Math.round(243 * (1 - t) + 7 * t);
    return `${r},${g},${b}`;
  }
  const t = (strength - 50) / 50;
  const r = Math.round(255 * (1 - t * 0.06));
  const g = Math.round(193 * (1 - t * 0.56));
  const b = Math.round(7 + 73 * t);
  return `${r},${g},${b}`;
}

// ---- Render ----

function renderSrConfluence(
  { ctx, pane, priceScale }: PrimitiveRenderContext,
  state: SrConfluenceState,
): void {
  const { zones } = state;
  if (zones.length === 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();

  // Bands fill the entire pane horizontally and labels pin to the right
  // edge of the pane — both are independent of the visible index range so
  // they don't flicker as the user pans/zooms.
  const left = pane.x;
  const right = pane.x + pane.width;
  const width = pane.width;

  for (const zone of zones) {
    const topY = priceScale.priceToY(zone.high);
    const bottomY = priceScale.priceToY(zone.low);
    const h = bottomY - topY;
    if (h <= 0) continue;

    const rgb = strengthToRgb(zone.strength);
    const alpha = 0.06 + (zone.strength / 100) * 0.12;

    ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.fillRect(left, topY, width, h);

    ctx.strokeStyle = `rgba(${rgb},${(alpha * 2.5).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(left, topY);
    ctx.lineTo(right, topY);
    ctx.moveTo(left, bottomY);
    ctx.lineTo(right, bottomY);
    ctx.stroke();

    const centerY = (topY + bottomY) / 2;
    ctx.fillStyle = `rgba(${rgb},0.7)`;
    ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`S${zone.strength.toFixed(0)}`, right - 4, centerY);
  }

  ctx.restore();
}

// ---- Factory ----

export function createSrConfluence(
  zones: readonly SrZoneData[],
): PrimitivePlugin<SrConfluenceState> {
  return definePrimitive<SrConfluenceState>({
    name: "srConfluence",
    pane: "main",
    zOrder: "below",
    defaultState: { zones },
    render: renderSrConfluence,
  });
}

// ---- Convenience connector ----

type SrConfluenceHandle = {
  update(zones: readonly SrZoneData[]): void;
  remove(): void;
};

export function connectSrConfluence(
  chart: ChartInstance,
  zones: readonly SrZoneData[],
): SrConfluenceHandle {
  chart.registerPrimitive(createSrConfluence(zones));

  return {
    update(newZones) {
      chart.registerPrimitive(createSrConfluence(newZones));
    },
    remove() {
      chart.removePrimitive("srConfluence");
    },
  };
}
