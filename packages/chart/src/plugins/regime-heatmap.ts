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

import { withPaneClip } from "../core/draw-helper";
import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance, DataPoint } from "../core/types";

// ---- Types (duck-typed, no core dependency) ----

type RegimeDataPoint = DataPoint<{
  regime: number;
  label?: string;
  confidence?: number;
}>;

type RegimeHeatmapState = {
  data: readonly RegimeDataPoint[];
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
  { ctx, pane, timeScale }: PrimitiveRenderContext,
  state: RegimeHeatmapState,
): void {
  const { data } = state;
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
}

// ---- Factory ----

/**
 * Create a PrimitivePlugin that renders regime heatmap background.
 *
 * @param data - Series data from hmmRegimes() or any compatible shape
 * @returns PrimitivePlugin to register via chart.registerPrimitive()
 */
export function createRegimeHeatmap(
  data: readonly RegimeDataPoint[],
): PrimitivePlugin<RegimeHeatmapState> {
  return definePrimitive<RegimeHeatmapState>({
    name: "regimeHeatmap",
    pane: "main",
    zOrder: "below",
    defaultState: { data },
    render: renderRegimeHeatmap,
  });
}

// ---- Convenience connector ----

type RegimeHeatmapHandle = {
  /** Update with new regime data */
  update(data: readonly RegimeDataPoint[]): void;
  /** Remove the heatmap from the chart */
  remove(): void;
};

/**
 * Connect regime heatmap to a chart instance.
 *
 * @param chart - ChartInstance to attach to
 * @param data - Series data from hmmRegimes()
 * @returns Handle for updating or removing the heatmap
 */
export function connectRegimeHeatmap(
  chart: ChartInstance,
  data: readonly RegimeDataPoint[],
): RegimeHeatmapHandle {
  const plugin = createRegimeHeatmap(data);
  chart.registerPrimitive(plugin);

  return {
    update(newData: readonly RegimeDataPoint[]) {
      // Re-register with new data (replaces existing primitive of same name)
      chart.registerPrimitive(createRegimeHeatmap(newData));
    },
    remove() {
      chart.removePrimitive("regimeHeatmap");
    },
  };
}
