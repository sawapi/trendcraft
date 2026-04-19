/**
 * Session Kill Zone Plugin — Visualizes ICT kill zones as time-based
 * background shading on the chart.
 *
 * Colors:
 * - Asian KZ → purple
 * - London Open KZ → blue
 * - NY Open KZ → green
 * - London Close KZ → orange
 *
 * @example
 * ```typescript
 * import { createChart, connectSessionZones } from '@trendcraft/chart';
 * import { killZones } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const handle = connectSessionZones(chart, killZones(candles));
 * ```
 */

import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance, DataPoint } from "../core/types";

// ---- Types (duck-typed) ----

type KillZoneDataPoint = DataPoint<{
  zone: string | null;
  inKillZone: boolean;
  characteristic?: string | null;
}>;

type SessionZonesState = {
  data: readonly KillZoneDataPoint[];
};

// ---- Colors ----

const ZONE_COLORS: Record<string, string> = {
  "Asian KZ": "156,39,176",
  "London Open KZ": "33,150,243",
  "NY Open KZ": "38,166,154",
  "London Close KZ": "255,152,0",
  // Fallbacks for session names without "KZ"
  Asia: "156,39,176",
  London: "33,150,243",
  "NY AM": "38,166,154",
  "NY PM": "255,152,0",
};

function zoneToRgb(zone: string): string {
  return ZONE_COLORS[zone] ?? "120,123,134";
}

// ---- Render ----

function renderSessionZones(
  { ctx, pane, timeScale }: PrimitiveRenderContext,
  state: SessionZonesState,
): void {
  const { data } = state;
  if (data.length === 0) return;

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const barWidth = Math.max(1, timeScale.barSpacing);

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();

  // Track zone spans for label placement
  let spanStart = -1;
  let spanZone = "";

  for (let i = start; i < end && i < data.length; i++) {
    const point = data[i];
    if (!point?.value) continue;

    const { zone, inKillZone } = point.value;

    if (inKillZone && zone) {
      const rgb = zoneToRgb(zone);
      const x = timeScale.indexToX(i);

      ctx.fillStyle = `rgba(${rgb},0.18)`;
      ctx.fillRect(x - barWidth / 2, pane.y, barWidth, pane.height);

      // Track span for label
      if (zone !== spanZone) {
        // Render label for previous span
        if (spanStart >= 0 && spanZone) {
          renderZoneLabel(ctx, spanZone, spanStart, timeScale.indexToX(i - 1), pane.y);
        }
        spanStart = i;
        spanZone = zone;
      }
    } else {
      // End of span
      if (spanStart >= 0 && spanZone) {
        renderZoneLabel(
          ctx,
          spanZone,
          timeScale.indexToX(spanStart),
          timeScale.indexToX(i - 1),
          pane.y,
        );
        spanStart = -1;
        spanZone = "";
      }
    }
  }

  // Render label for last span if still open
  if (spanStart >= 0 && spanZone) {
    const lastIdx = Math.min(end - 1, data.length - 1);
    renderZoneLabel(
      ctx,
      spanZone,
      timeScale.indexToX(spanStart),
      timeScale.indexToX(lastIdx),
      pane.y,
    );
  }

  ctx.restore();
}

function renderZoneLabel(
  ctx: CanvasRenderingContext2D,
  zone: string,
  startX: number,
  endX: number,
  paneY: number,
): void {
  const midX = (startX + endX) / 2;
  const rgb = zoneToRgb(zone);

  ctx.fillStyle = `rgba(${rgb},0.4)`;
  ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(zone, midX, paneY + 3);
}

// ---- Factory ----

export function createSessionZones(
  data: readonly KillZoneDataPoint[],
): PrimitivePlugin<SessionZonesState> {
  return definePrimitive<SessionZonesState>({
    name: "sessionZones",
    pane: "main",
    zOrder: "below",
    defaultState: { data },
    render: renderSessionZones,
  });
}

// ---- Convenience connector ----

type SessionZonesHandle = {
  update(data: readonly KillZoneDataPoint[]): void;
  remove(): void;
};

export function connectSessionZones(
  chart: ChartInstance,
  data: readonly KillZoneDataPoint[],
): SessionZonesHandle {
  chart.registerPrimitive(createSessionZones(data));

  return {
    update(newData) {
      chart.registerPrimitive(createSessionZones(newData));
    },
    remove() {
      chart.removePrimitive("sessionZones");
    },
  };
}
