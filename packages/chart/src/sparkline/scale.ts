export type YScale = {
  /** Map a data value to a CSS-pixel y coordinate. */
  yOf: (v: number) => number;
  /** Extent actually used (raw extent widened to include the baseline). */
  min: number;
  max: number;
};

/**
 * Build the vertical scale shared by the line and candle sparkline renderers.
 * `min`/`max` are the raw data extent the caller scanned (line: close range;
 * candle: low/high range). When `baselineValue` is set it is folded into the
 * extent so the dashed baseline stays on-canvas. A 1px vertical pad keeps the
 * extremes off the edge, and a zero-height range collapses to `1` to avoid a
 * divide-by-zero.
 */
export function computeYScale(
  min: number,
  max: number,
  baselineValue: number | null,
  height: number,
): YScale {
  if (baselineValue != null) {
    if (baselineValue < min) min = baselineValue;
    if (baselineValue > max) max = baselineValue;
  }
  const padY = 1;
  const innerH = Math.max(1, height - padY * 2);
  const range = max - min || 1;
  return {
    min,
    max,
    yOf: (v: number) => padY + innerH - ((v - min) / range) * innerH,
  };
}

/**
 * Draw the dashed sparkline baseline at `baselineValue`. No-op when the
 * baseline is null. Saves/restores ctx so the dash pattern doesn't leak.
 */
export function drawSparkBaseline(
  ctx: CanvasRenderingContext2D,
  yOf: (v: number) => number,
  baselineValue: number | null,
  width: number,
  baselineColor: string,
): void {
  if (baselineValue == null) return;
  ctx.save();
  ctx.strokeStyle = baselineColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  const by = yOf(baselineValue);
  ctx.moveTo(0, by);
  ctx.lineTo(width, by);
  ctx.stroke();
  ctx.restore();
}
