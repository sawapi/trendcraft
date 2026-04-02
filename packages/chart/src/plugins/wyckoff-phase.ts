/**
 * Wyckoff Phase Timeline Plugin — Visualizes Wyckoff phases as colored bar
 * at the bottom of the chart pane + optional VSA bar classification markers.
 *
 * Phase colors:
 * - accumulation → green
 * - markup → blue
 * - distribution → red
 * - markdown → orange
 * - unknown → gray
 *
 * @example
 * ```typescript
 * import { createChart, connectWyckoffPhase } from '@trendcraft/chart';
 * import { wyckoffPhases } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const handle = connectWyckoffPhase(chart, { phases: wyckoffPhases(candles) });
 * ```
 */

import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance, DataPoint } from "../core/types";

// ---- Types (duck-typed) ----

type WyckoffDataPoint = DataPoint<{
  phase: string;
  confidence?: number;
  event?: string | null;
  rangeHigh?: number | null;
  rangeLow?: number | null;
}>;

type VsaDataPoint = DataPoint<{
  barType: string;
  isEffortDivergence?: boolean;
}>;

type WyckoffPhaseState = {
  phases: readonly WyckoffDataPoint[];
  vsa: readonly VsaDataPoint[];
};

// ---- Colors ----

const PHASE_COLORS: Record<string, string> = {
  accumulation: "38,166,154",
  markup: "33,150,243",
  distribution: "239,83,80",
  markdown: "255,152,0",
  unknown: "120,123,134",
};

const VSA_MARKER_COLORS: Record<string, string> = {
  spring: "38,166,154",
  test: "38,166,154",
  upthrust: "239,83,80",
  climacticAction: "255,152,0",
  stoppingVolume: "33,150,243",
  absorption: "156,39,176",
  noSupply: "76,175,80",
  noDemand: "244,67,54",
};

const PHASE_BAR_HEIGHT = 6;

// ---- Render ----

function renderWyckoffPhase(
  { ctx, pane, timeScale }: PrimitiveRenderContext,
  state: WyckoffPhaseState,
): void {
  const { phases, vsa } = state;
  if (phases.length === 0) return;

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const barWidth = Math.max(1, timeScale.barSpacing);
  const barY = pane.y + pane.height - PHASE_BAR_HEIGHT;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();

  // Phase bar at bottom
  for (let i = start; i < end && i < phases.length; i++) {
    const point = phases[i];
    if (!point?.value) continue;

    const { phase, confidence } = point.value;
    const rgb = PHASE_COLORS[phase] ?? PHASE_COLORS.unknown;
    const alpha = 0.4 + ((confidence ?? 50) / 100) * 0.5;
    const x = timeScale.indexToX(i);

    ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.fillRect(x - barWidth / 2, barY, barWidth, PHASE_BAR_HEIGHT);
  }

  // VSA event markers (small dots above phase bar)
  if (vsa.length > 0) {
    const markerY = barY - 4;
    for (let i = start; i < end && i < vsa.length; i++) {
      const point = vsa[i];
      if (!point?.value) continue;

      const { barType } = point.value;
      if (barType === "normal") continue;

      const rgb = VSA_MARKER_COLORS[barType];
      if (!rgb) continue;

      const x = timeScale.indexToX(i);
      ctx.fillStyle = `rgba(${rgb},0.8)`;
      ctx.beginPath();
      ctx.arc(x, markerY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ---- Factory ----

export function createWyckoffPhase(
  phases: readonly WyckoffDataPoint[],
  vsa: readonly VsaDataPoint[] = [],
): PrimitivePlugin<WyckoffPhaseState> {
  return definePrimitive<WyckoffPhaseState>({
    name: "wyckoffPhase",
    pane: "main",
    zOrder: "above",
    defaultState: { phases, vsa },
    render: renderWyckoffPhase,
  });
}

// ---- Convenience connector ----

type WyckoffPhaseHandle = {
  update(phases: readonly WyckoffDataPoint[], vsa?: readonly VsaDataPoint[]): void;
  remove(): void;
};

export function connectWyckoffPhase(
  chart: ChartInstance,
  sources: { phases: readonly WyckoffDataPoint[]; vsa?: readonly VsaDataPoint[] },
): WyckoffPhaseHandle {
  chart.registerPrimitive(createWyckoffPhase(sources.phases, sources.vsa));

  return {
    update(phases, vsa = []) {
      chart.registerPrimitive(createWyckoffPhase(phases, vsa));
    },
    remove() {
      chart.removePrimitive("wyckoffPhase");
    },
  };
}
