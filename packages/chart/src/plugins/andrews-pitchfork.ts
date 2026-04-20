/**
 * Andrew's Pitchfork Plugin — Renders three parallel trend lines from a
 * median pivot (P0) through the midpoint of two subsequent swings (P1, P2).
 *
 * Unlike the drawing-level `trendline` type, the pitchfork uses three swing
 * anchors directly and extends forward indefinitely, so a dedicated primitive
 * plugin is the natural fit rather than a static drawing.
 *
 * Anchors use candle **indices** (matching the chart's index-based x-axis),
 * so the caller maps `time → index` via the candles array on their side.
 *
 * @example
 * ```typescript
 * import { createChart, connectAndrewsPitchfork } from '@trendcraft/chart';
 * import { getAlternatingSwingPoints } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 *
 * // getAlternatingSwingPoints already carries `index` for every swing.
 * const last3 = getAlternatingSwingPoints(candles, 3, { leftBars: 10, rightBars: 10 });
 * if (last3.length === 3) {
 *   connectAndrewsPitchfork(chart, {
 *     p0: { index: last3[0].index, price: last3[0].price },
 *     p1: { index: last3[1].index, price: last3[1].price },
 *     p2: { index: last3[2].index, price: last3[2].price },
 *   });
 * }
 * ```
 */

import { withPaneClip } from "../core/draw-helper";
import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance } from "../core/types";

// ---- Public types ----

export type PitchforkAnchor = {
  /** Candle index (0-based) along the chart's x-axis. */
  index: number;
  /** Price value along the y-axis. */
  price: number;
};

export type PitchforkAnchors = {
  p0: PitchforkAnchor;
  p1: PitchforkAnchor;
  p2: PitchforkAnchor;
};

export type AndrewsPitchforkState = {
  anchors: PitchforkAnchors;
  /** Stroke color for the three parallel lines (rgba or named). */
  color?: string;
  /** Fill color for the area between upper and lower handles. */
  fillColor?: string;
};

// ---- Render ----

function renderAndrewsPitchfork(
  { ctx, pane, timeScale, priceScale }: PrimitiveRenderContext,
  state: AndrewsPitchforkState,
): void {
  const { p0, p1, p2 } = state.anchors;

  const x0 = timeScale.indexToX(p0.index);
  const x1 = timeScale.indexToX(p1.index);
  const x2 = timeScale.indexToX(p2.index);

  const y0 = priceScale.priceToY(p0.price);
  const y1 = priceScale.priceToY(p1.price);
  const y2 = priceScale.priceToY(p2.price);

  // Midpoint of P1-P2 in pixel space
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Median line: P0 → midpoint, extended to the right edge
  const rightEdgeX = pane.x + pane.width;
  const dxMed = midX - x0;
  const dyMed = midY - y0;
  if (dxMed === 0) return; // Degenerate: anchors too close vertically

  const extendRatio = (rightEdgeX - x0) / dxMed;
  const medianEndX = x0 + dxMed * extendRatio;
  const medianEndY = y0 + dyMed * extendRatio;

  // Upper handle: parallel to median, passing through whichever of P1/P2 is higher
  // (lower Y value in pixel space since Y grows downward).
  const upperAnchorX = y1 < y2 ? x1 : x2;
  const upperAnchorY = y1 < y2 ? y1 : y2;
  const lowerAnchorX = y1 < y2 ? x2 : x1;
  const lowerAnchorY = y1 < y2 ? y2 : y1;

  // Parallel line through (ax, ay) with same direction as median: end at rightEdgeX.
  const upperEndX = rightEdgeX;
  const upperEndY = upperAnchorY + (dyMed / dxMed) * (rightEdgeX - upperAnchorX);
  const lowerEndX = rightEdgeX;
  const lowerEndY = lowerAnchorY + (dyMed / dxMed) * (rightEdgeX - lowerAnchorX);

  withPaneClip(ctx, pane, () => {
    const stroke = state.color ?? "rgba(100,149,237,0.9)";
    const fill = state.fillColor ?? "rgba(100,149,237,0.08)";

    // Fill the region between upper and lower handles (from their anchor points forward).
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(upperAnchorX, upperAnchorY);
    ctx.lineTo(upperEndX, upperEndY);
    ctx.lineTo(lowerEndX, lowerEndY);
    ctx.lineTo(lowerAnchorX, lowerAnchorY);
    ctx.closePath();
    ctx.fill();

    // Handle connector (P1 ↔ P2 short dashed segment)
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Median line (solid)
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(medianEndX, medianEndY);
    ctx.stroke();

    // Upper + lower handle lines (solid, thinner)
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(upperAnchorX, upperAnchorY);
    ctx.lineTo(upperEndX, upperEndY);
    ctx.moveTo(lowerAnchorX, lowerAnchorY);
    ctx.lineTo(lowerEndX, lowerEndY);
    ctx.stroke();

    // Small anchor dots
    ctx.fillStyle = stroke;
    for (const [ax, ay] of [
      [x0, y0],
      [x1, y1],
      [x2, y2],
    ]) {
      ctx.beginPath();
      ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ---- Factory ----

export function createAndrewsPitchfork(
  anchors: PitchforkAnchors,
  options: { color?: string; fillColor?: string } = {},
): PrimitivePlugin<AndrewsPitchforkState> {
  return definePrimitive<AndrewsPitchforkState>({
    name: "andrewsPitchfork",
    pane: "main",
    zOrder: "below",
    defaultState: { anchors, color: options.color, fillColor: options.fillColor },
    render: renderAndrewsPitchfork,
  });
}

// ---- Convenience connector ----

type AndrewsPitchforkHandle = {
  update(anchors: PitchforkAnchors, options?: { color?: string; fillColor?: string }): void;
  remove(): void;
};

export function connectAndrewsPitchfork(
  chart: ChartInstance,
  anchors: PitchforkAnchors,
  options: { color?: string; fillColor?: string } = {},
): AndrewsPitchforkHandle {
  chart.registerPrimitive(createAndrewsPitchfork(anchors, options));

  return {
    update(newAnchors, newOptions) {
      chart.registerPrimitive(createAndrewsPitchfork(newAnchors, newOptions ?? options));
    },
    remove() {
      chart.removePrimitive("andrewsPitchfork");
    },
  };
}
