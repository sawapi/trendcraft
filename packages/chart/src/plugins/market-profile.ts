/**
 * Market Profile (TPO) Plugin — Renders a horizontal time-at-price
 * histogram on the left side of the chart pane, plus horizontal lines at
 * POC / VAH / VAL.
 *
 * Accepts the last non-null value from a `Series<MarketProfileValue>` (the
 * output of core's `marketProfile()`), or a single `MarketProfileValue`.
 * Using a series lets the histogram advance as new TPO sessions complete;
 * the plugin internally reads the most recent completed profile within the
 * current visible range.
 *
 * @example
 * ```typescript
 * import { createChart, connectMarketProfile } from '@trendcraft/chart';
 * import { marketProfile } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const handle = connectMarketProfile(chart, marketProfile(candles));
 * ```
 */

import { withPaneClip } from "../core/draw-helper";
import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance } from "../core/types";

// ---- Types (duck-typed to avoid a core dependency) ----

/** Matches core's `MarketProfileValue`. */
export type MarketProfileValue = {
  poc: number | null;
  valueAreaHigh: number | null;
  valueAreaLow: number | null;
  profile: Map<number, number> | null;
};

export type MarketProfileSeries = ReadonlyArray<{ time: number; value: MarketProfileValue }>;

export type MarketProfileOptions = {
  /** Strip width as pane-width fraction (0-1) or absolute px (>1). Default 0.15. */
  widthFraction?: number;
  /** Fill color for bars outside the value area. */
  barColor?: string;
  /** Fill color for bars inside the value area. */
  valueAreaColor?: string;
  /** Fill + line color for POC. */
  pocColor?: string;
  /** VAH / VAL line color. */
  vaEdgeColor?: string;
};

type MarketProfileState = {
  data: MarketProfileSeries;
  options: Required<MarketProfileOptions>;
};

// ---- Defaults ----

const DEFAULTS: Required<MarketProfileOptions> = {
  widthFraction: 0.15,
  barColor: "rgba(33,150,243,0.07)",
  valueAreaColor: "rgba(33,150,243,0.22)",
  pocColor: "rgba(255,152,0,0.85)",
  vaEdgeColor: "rgba(255,152,0,0.4)",
};

// ---- Render ----

function renderMarketProfile(
  { ctx, pane, priceScale, timeScale }: PrimitiveRenderContext,
  state: MarketProfileState,
): void {
  const { data, options } = state;
  if (data.length === 0) return;

  const lastIdx = Math.min(timeScale.endIndex - 1, data.length - 1);
  if (lastIdx < 0) return;

  // Walk backwards to find the most recent non-empty profile — near the
  // start of a session the latest bar's profile may still be empty.
  let value: MarketProfileValue | null = null;
  for (let i = lastIdx; i >= Math.max(0, timeScale.startIndex); i--) {
    const v = data[i]?.value;
    if (v?.profile && v.profile.size > 0) {
      value = v;
      break;
    }
  }
  if (!value?.profile || value.profile.size === 0) return;

  const { poc, valueAreaHigh, valueAreaLow, profile } = value;

  let maxCount = 0;
  for (const count of profile.values()) if (count > maxCount) maxCount = count;
  if (maxCount === 0) return;

  const reservedWidth =
    options.widthFraction > 1
      ? Math.min(options.widthFraction, pane.width)
      : pane.width * options.widthFraction;
  if (reservedWidth <= 0) return;
  const barLeft = pane.x + 8;
  const profileRight = barLeft + reservedWidth;

  withPaneClip(ctx, pane, () => {
    const prices = [...profile.keys()].sort((a, b) => a - b);
    const tickSize = prices.length > 1 ? prices[1] - prices[0] : 1;
    const barH = Math.max(2, Math.abs(priceScale.priceToY(0) - priceScale.priceToY(tickSize)) - 1);

    for (const [price, count] of profile) {
      const y = priceScale.priceToY(price);
      const barW = (count / maxCount) * reservedWidth;
      const isPoc = price === poc;
      const inVA =
        valueAreaLow != null &&
        valueAreaHigh != null &&
        price >= valueAreaLow &&
        price <= valueAreaHigh;

      ctx.fillStyle = isPoc ? options.pocColor : inVA ? options.valueAreaColor : options.barColor;
      ctx.fillRect(barLeft, y - barH / 2, barW, barH);

      if (isPoc) {
        ctx.strokeStyle = options.pocColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(barLeft, y - barH / 2, barW, barH);
      }
    }

    // VAH / VAL dashed lines + labels
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "bottom";
    for (const [label, price] of [
      ["VAH", valueAreaHigh],
      ["VAL", valueAreaLow],
    ] as const) {
      if (price == null) continue;
      const y = Math.round(priceScale.priceToY(price)) + 0.5;
      ctx.strokeStyle = options.vaEdgeColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(barLeft, y);
      ctx.lineTo(profileRight + 20, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = options.vaEdgeColor;
      ctx.fillText(label, profileRight + 4, y - 2);
    }

    // POC solid line + label
    if (poc != null) {
      const y = Math.round(priceScale.priceToY(poc)) + 0.5;
      ctx.strokeStyle = options.pocColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(barLeft, y);
      ctx.lineTo(profileRight + 20, y);
      ctx.stroke();
      ctx.fillStyle = options.pocColor;
      ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("POC", profileRight + 4, y - 2);
    }
  });
}

// ---- Factory ----

function resolveOptions(options: MarketProfileOptions = {}): Required<MarketProfileOptions> {
  return { ...DEFAULTS, ...options };
}

export function createMarketProfile(
  data: MarketProfileSeries,
  options: MarketProfileOptions = {},
): PrimitivePlugin<MarketProfileState> {
  return definePrimitive<MarketProfileState>({
    name: "marketProfile",
    pane: "main",
    zOrder: "above",
    defaultState: { data, options: resolveOptions(options) },
    render: renderMarketProfile,
  });
}

// ---- Convenience connector ----

type MarketProfileHandle = {
  update(data: MarketProfileSeries, options?: MarketProfileOptions): void;
  remove(): void;
};

export function connectMarketProfile(
  chart: ChartInstance,
  data: MarketProfileSeries,
  options: MarketProfileOptions = {},
): MarketProfileHandle {
  chart.registerPrimitive(createMarketProfile(data, options));

  return {
    update(newData, newOptions) {
      chart.registerPrimitive(createMarketProfile(newData, newOptions ?? options));
    },
    remove() {
      chart.removePrimitive("marketProfile");
    },
  };
}
