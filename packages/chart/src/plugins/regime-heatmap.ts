/**
 * Regime Heatmap Plugin — Visualizes HMM regime detection as background coloring.
 *
 * Renders per-bar background rectangles colored by regime state:
 * - trending-up → green
 * - ranging → yellow
 * - trending-down → red
 *
 * Alpha is modulated by confidence (higher confidence = more opaque).
 *
 * @example
 * ```typescript
 * import { createChart, connectRegimeHeatmap } from '@trendcraft/chart';
 * import { hmmRegimes } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const regimes = hmmRegimes(candles);
 * const handle = connectRegimeHeatmap(chart, regimes);
 * // Later: handle.remove();
 * ```
 */

import { roundRectPath, withPaneClip } from "../core/draw-helper";
import { canvasFont } from "../core/font";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import { definePrimitive } from "../core/plugin-types";
import type { ChartInstance, DataPoint } from "../core/types";

// ---- Types (duck-typed, no core dependency) ----

type RegimeDataPoint = DataPoint<{
  regime: number;
  label?: string;
  confidence?: number;
}>;

export type RegimeHeatmapOptions = {
  /**
   * Whether to draw a corner badge showing the current regime + confidence.
   * Mirrors the convention used by TradingView regime indicators
   * (EXCAVO / LuxAlgo / RWCS_LTD): "trending-up · 72%" style pill in the
   * top-left so the analyst can read the active regime without decoding
   * background colors. Default `true`.
   */
  showBadge?: boolean;
};

type RegimeHeatmapState = {
  data: readonly RegimeDataPoint[];
  options: Required<RegimeHeatmapOptions>;
};

// ---- Colors ----

const REGIME_COLORS: Record<string, string> = {
  "trending-up": "38,166,154",
  ranging: "255,193,7",
  "trending-down": "239,83,80",
};

/** Fallback color by regime index when label is absent */
const REGIME_INDEX_COLORS = ["239,83,80", "255,193,7", "38,166,154"];

function regimeToRgb(regime: number, label?: string): string {
  if (label && REGIME_COLORS[label]) return REGIME_COLORS[label];
  return REGIME_INDEX_COLORS[regime] ?? "255,193,7";
}

// ---- Render ----

function renderRegimeHeatmap(
  { ctx, pane, timeScale, fontFamily }: PrimitiveRenderContext,
  state: RegimeHeatmapState,
): void {
  const { data, options } = state;
  if (data.length === 0) return;

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const barWidth = Math.max(1, timeScale.barSpacing);

  withPaneClip(ctx, pane, () => {
    for (let i = start; i < end && i < data.length; i++) {
      const point = data[i];
      if (!point?.value) continue;

      const { regime, label, confidence } = point.value;
      const rgb = regimeToRgb(regime, label);
      const alpha = 0.15 + (confidence ?? 0.5) * 0.25;
      const x = timeScale.indexToX(i);

      ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
      ctx.fillRect(x - barWidth / 2, pane.y, barWidth, pane.height);
    }
  });

  if (options.showBadge) {
    renderRegimeBadge(ctx, pane, data, start, end, fontFamily);
  }
}

/**
 * Top-left corner pill: "trending-up · 72%" using the active regime's color.
 * The regime is read from the most recent *visible* bar in `data` — we walk
 * back from `end-1` only as far as `start`, so panning into a sparse region
 * with no regime data can't surface a stale label from an off-screen bar.
 * No visible regime → no badge at all.
 */
function renderRegimeBadge(
  ctx: CanvasRenderingContext2D,
  pane: { x: number; y: number; width: number; height: number },
  data: readonly RegimeDataPoint[],
  visibleStart: number,
  visibleEnd: number,
  fontFamily: string,
): void {
  const lastVisibleIdx = Math.min(visibleEnd - 1, data.length - 1);
  const firstVisibleIdx = Math.max(0, visibleStart);
  let value: RegimeDataPoint["value"] | null = null;
  for (let i = lastVisibleIdx; i >= firstVisibleIdx; i--) {
    const v = data[i]?.value;
    if (v) {
      value = v;
      break;
    }
  }
  if (!value) return;

  const rgb = regimeToRgb(value.regime, value.label);
  // Treat empty string the same as missing — upstream normalizers sometimes
  // emit `""` for "no label", and `??` would otherwise produce `" · 72%"`
  // or a blank pill.
  const text = value.label && value.label.length > 0 ? value.label : `regime ${value.regime}`;
  const conf = value.confidence;
  const display = conf != null ? `${text} · ${Math.round(conf * 100)}%` : text;

  ctx.save();
  ctx.font = canvasFont(11, fontFamily, "bold");
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const padX = 8;
  const padY = 4;
  const metrics = ctx.measureText(display);
  const textW = metrics.width;
  const textH = 11;
  const pillX = pane.x + 8;
  const pillY = pane.y + 8;
  const pillW = textW + padX * 2;
  const pillH = textH + padY * 2;

  // Pill background — saturated regime tint with rounded corners.
  ctx.fillStyle = `rgba(${rgb},0.85)`;
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();

  // White text — high contrast against the saturated pill regardless of
  // the host theme (light vs dark).
  ctx.fillStyle = "#fff";
  ctx.fillText(display, pillX + padX, pillY + padY);
  ctx.restore();
}

// ---- Factory ----

const DEFAULT_OPTIONS: Required<RegimeHeatmapOptions> = {
  showBadge: true,
};

function resolveOptions(options: RegimeHeatmapOptions = {}): Required<RegimeHeatmapOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

/**
 * Create a PrimitivePlugin that renders regime heatmap background.
 *
 * @param data - Series data from hmmRegimes() or any compatible shape
 * @param options - Visual customization (badge on/off, etc.)
 * @returns PrimitivePlugin to register via chart.registerPrimitive()
 */
export function createRegimeHeatmap(
  data: readonly RegimeDataPoint[],
  options: RegimeHeatmapOptions = {},
): PrimitivePlugin<RegimeHeatmapState> {
  return definePrimitive<RegimeHeatmapState>({
    name: "regimeHeatmap",
    pane: "main",
    zOrder: "below",
    defaultState: { data, options: resolveOptions(options) },
    render: renderRegimeHeatmap,
  });
}

// ---- Convenience connector ----

type RegimeHeatmapHandle = {
  /** Update with new regime data */
  update(data: readonly RegimeDataPoint[], options?: RegimeHeatmapOptions): void;
  /** Remove the heatmap from the chart */
  remove(): void;
};

/**
 * Connect regime heatmap to a chart instance.
 *
 * @param chart - ChartInstance to attach to
 * @param data - Series data from hmmRegimes()
 * @param options - Visual customization (badge on/off, etc.)
 * @returns Handle for updating or removing the heatmap
 */
export function connectRegimeHeatmap(
  chart: ChartInstance,
  data: readonly RegimeDataPoint[],
  options: RegimeHeatmapOptions = {},
): RegimeHeatmapHandle {
  // Track the last-applied options so a host that toggles the badge once
  // (`handle.update(data, { showBadge: false })`) and then keeps streaming
  // data (`handle.update(nextData)`) doesn't see the toggle silently revert
  // to the original options on the next refresh.
  let appliedOptions = options;
  chart.registerPrimitive(createRegimeHeatmap(data, appliedOptions));

  return {
    update(newData: readonly RegimeDataPoint[], newOptions?: RegimeHeatmapOptions) {
      if (newOptions !== undefined) appliedOptions = newOptions;
      chart.registerPrimitive(createRegimeHeatmap(newData, appliedOptions));
    },
    remove() {
      chart.removePrimitive("regimeHeatmap");
    },
  };
}
