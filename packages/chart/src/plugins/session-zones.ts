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

import { withPaneClip } from "../core/draw-helper";
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

/** Shortened display forms — keeps intraday timelines readable when every
 * day repeats the same four zones. */
const ZONE_SHORT_LABELS: Record<string, string> = {
  "Asian KZ": "Asia",
  "London Open KZ": "LON",
  "NY Open KZ": "NY",
  "London Close KZ": "Close",
};

/** Horizontal padding between consecutive labels before the next one is skipped. */
const LABEL_GAP_PX = 6;

function zoneToRgb(zone: string): string {
  return ZONE_COLORS[zone] ?? "120,123,134";
}

function zoneToShortLabel(zone: string): string {
  return ZONE_SHORT_LABELS[zone] ?? zone;
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

  withPaneClip(ctx, pane, () => {
    // Collect spans first, then render labels with collision avoidance so
    // dense intraday ranges don't produce an unreadable wall of text.
    type Span = { zone: string; startIndex: number; endIndex: number };
    const spans: Span[] = [];
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

        if (zone !== spanZone) {
          if (spanStart >= 0 && spanZone) {
            spans.push({ zone: spanZone, startIndex: spanStart, endIndex: i - 1 });
          }
          spanStart = i;
          spanZone = zone;
        }
      } else if (spanStart >= 0 && spanZone) {
        spans.push({ zone: spanZone, startIndex: spanStart, endIndex: i - 1 });
        spanStart = -1;
        spanZone = "";
      }
    }
    if (spanStart >= 0 && spanZone) {
      const lastIdx = Math.min(end - 1, data.length - 1);
      spans.push({ zone: spanZone, startIndex: spanStart, endIndex: lastIdx });
    }

    renderZoneLabels(ctx, spans, timeScale, pane.y);
  });
}

function renderZoneLabels(
  ctx: CanvasRenderingContext2D,
  spans: Array<{ zone: string; startIndex: number; endIndex: number }>,
  timeScale: { indexToX: (i: number) => number },
  paneY: number,
): void {
  if (spans.length === 0) return;

  ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  let lastLabelRight = Number.NEGATIVE_INFINITY;

  for (const span of spans) {
    const startX = timeScale.indexToX(span.startIndex);
    const endX = timeScale.indexToX(span.endIndex);
    const midX = (startX + endX) / 2;
    const text = zoneToShortLabel(span.zone);
    const width = ctx.measureText(text).width;
    const leftEdge = midX - width / 2;
    const rightEdge = midX + width / 2;

    // Skip if this label would overlap the previously drawn one.
    if (leftEdge < lastLabelRight + LABEL_GAP_PX) continue;

    const rgb = zoneToRgb(span.zone);
    ctx.fillStyle = `rgba(${rgb},0.4)`;
    ctx.fillText(text, midX, paneY + 3);
    lastLabelRight = rightEdge;
  }
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
