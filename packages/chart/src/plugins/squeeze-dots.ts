/**
 * Squeeze Dots Plugin — Visualizes Bollinger squeeze events as a horizontal
 * row of dots at the bottom of the price pane, modeled after the TTM Squeeze
 * convention (Carter): red dot on bars where volatility is in the lowest
 * percentile (squeeze active), green dot on the bar where the squeeze
 * releases.
 *
 * The dots ride along a faint guide rail near the pane's bottom edge so they
 * never collide with candles.
 *
 * @example
 * ```typescript
 * import { createChart, connectSqueezeDots } from '@trendcraft/chart';
 * import { bollingerSqueeze } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const signals = bollingerSqueeze(candles);
 * const handle = connectSqueezeDots(chart, signals, candles);
 * // Later: handle.remove();
 * ```
 */

import { withPaneClip } from "../core/draw-helper";
import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance } from "../core/types";

// ---- Types (duck-typed; no core dependency) ----

type SqueezeSignal = {
  time: number;
  type: "squeeze";
  bandwidth?: number;
  percentile?: number;
};

type CandleRef = { time: number };

export type SqueezeDotsOptions = {
  /** Color for active-squeeze dots (rgba components, e.g. "239,83,80") */
  squeezeColor?: string;
  /** Color for release dots (rgba components) */
  releaseColor?: string;
  /** Dot radius in pixels */
  radius?: number;
  /** Vertical offset from the pane's bottom edge */
  offsetFromBottom?: number;
  /** Whether to draw the faint guide rail */
  showRail?: boolean;
};

type SqueezeDotsState = {
  /** Sorted, unique candle indices where squeeze is active */
  squeezeIndices: readonly number[];
  /** Indices where the squeeze has just released (squeeze→no-squeeze transition) */
  releaseIndices: readonly number[];
  options: Required<SqueezeDotsOptions>;
};

// ---- Defaults ----

const DEFAULT_OPTIONS: Required<SqueezeDotsOptions> = {
  squeezeColor: "239,83,80",
  releaseColor: "38,166,154",
  radius: 2.5,
  offsetFromBottom: 10,
  showRail: true,
};

// ---- Helpers ----

function computeIndices(
  signals: readonly SqueezeSignal[],
  candles: readonly CandleRef[],
): { squeezeIndices: number[]; releaseIndices: number[] } {
  const timeToIdx = new Map<number, number>();
  for (let i = 0; i < candles.length; i++) timeToIdx.set(candles[i].time, i);

  const squeezeSet = new Set<number>();
  for (const s of signals) {
    const idx = timeToIdx.get(s.time);
    if (idx != null) squeezeSet.add(idx);
  }
  const squeezeIndices = Array.from(squeezeSet).sort((a, b) => a - b);

  // Release = the bar immediately after a squeeze bar that itself isn't a squeeze bar.
  const releaseIndices: number[] = [];
  for (const i of squeezeIndices) {
    const next = i + 1;
    if (next < candles.length && !squeezeSet.has(next)) releaseIndices.push(next);
  }

  return { squeezeIndices, releaseIndices };
}

// ---- Render ----

function renderSqueezeDots(
  { ctx, pane, timeScale }: PrimitiveRenderContext,
  state: SqueezeDotsState,
): void {
  const { squeezeIndices, releaseIndices, options } = state;
  if (squeezeIndices.length === 0 && releaseIndices.length === 0) return;

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  // The TTM ribbon sits as a thin colored bar row at the pane bottom. Bar
  // width tracks bar spacing so it always reads as "this bar is in squeeze".
  const ribbonHeight = options.radius * 2;
  const ribbonY = pane.y + pane.height - options.offsetFromBottom - ribbonHeight / 2;
  const barWidth = Math.max(2, timeScale.barSpacing * 0.9);

  withPaneClip(ctx, pane, () => {
    // Faint guide rail spanning the visible range
    if (options.showRail) {
      ctx.save();
      ctx.setLineDash([1, 3]);
      ctx.strokeStyle = "rgba(120,123,134,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pane.x, ribbonY + ribbonHeight / 2);
      ctx.lineTo(pane.x + pane.width, ribbonY + ribbonHeight / 2);
      ctx.stroke();
      ctx.restore();
    }

    const drawBar = (i: number, color: string) => {
      if (i < start || i >= end) return;
      const x = timeScale.indexToX(i);
      ctx.fillStyle = color;
      ctx.fillRect(x - barWidth / 2, ribbonY, barWidth, ribbonHeight);
    };

    for (const i of squeezeIndices) drawBar(i, `rgba(${options.squeezeColor},1)`);
    for (const i of releaseIndices) drawBar(i, `rgba(${options.releaseColor},1)`);
  });
}

// ---- Factory ----

/**
 * Create a PrimitivePlugin that renders TTM-style squeeze dots along the
 * bottom of the price pane.
 *
 * @param signals - Output of `bollingerSqueeze()` (or any compatible shape)
 * @param candles - Candle array used to map signal timestamps → bar indices
 * @param options - Visual customization
 */
export function createSqueezeDots(
  signals: readonly SqueezeSignal[],
  candles: readonly CandleRef[],
  options: SqueezeDotsOptions = {},
): PrimitivePlugin<SqueezeDotsState> {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const { squeezeIndices, releaseIndices } = computeIndices(signals, candles);
  return definePrimitive<SqueezeDotsState>({
    name: "squeezeDots",
    pane: "main",
    zOrder: "above",
    defaultState: { squeezeIndices, releaseIndices, options: merged },
    render: renderSqueezeDots,
  });
}

// ---- Convenience connector ----

type SqueezeDotsHandle = {
  /** Replace the squeeze data with a new computation */
  update(signals: readonly SqueezeSignal[], candles: readonly CandleRef[]): void;
  /** Remove the dots from the chart */
  remove(): void;
};

/**
 * Connect squeeze dots to a chart instance.
 *
 * @param chart - ChartInstance to attach to
 * @param signals - Output of `bollingerSqueeze()`
 * @param candles - Candle array used to map signal timestamps → bar indices
 * @param options - Visual customization
 */
export function connectSqueezeDots(
  chart: ChartInstance,
  signals: readonly SqueezeSignal[],
  candles: readonly CandleRef[],
  options: SqueezeDotsOptions = {},
): SqueezeDotsHandle {
  chart.registerPrimitive(createSqueezeDots(signals, candles, options));

  return {
    update(newSignals, newCandles) {
      chart.registerPrimitive(createSqueezeDots(newSignals, newCandles, options));
    },
    remove() {
      chart.removePrimitive("squeezeDots");
    },
  };
}
