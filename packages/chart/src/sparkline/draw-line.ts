import type { StrokeAndFill } from "./color-resolve";
import type { SessionLayout } from "./session";
import type { ResolvedColors, SparklineCandle } from "./types";

export type LineDrawArgs = {
  ctx: CanvasRenderingContext2D;
  /** CSS-pixel width of the canvas. */
  width: number;
  /** CSS-pixel height of the canvas. */
  height: number;
  /** Closes (numbers) or candles (uses .close). */
  data: number[] | SparklineCandle[];
  colors: StrokeAndFill;
  themeColors: ResolvedColors;
  fill: boolean;
  /** Pixel y of baseline, or null to omit baseline drawing. */
  baselineValue: number | null;
  /**
   * Total horizontal slots; data covers the first `data.length` of these.
   * When > data.length, the right side stays blank.
   * Ignored when `session` is provided.
   */
  totalSlots: number;
  /**
   * Pre-built session layout. When provided, x positions are derived from
   * each data point's `.time` (Candle data only); breaks are skipped and
   * a visible gap is rendered between adjacent segments.
   */
  sessionLayout?: SessionLayout;
};

function getClose(d: number | SparklineCandle): number {
  return typeof d === "number" ? d : d.close;
}

/**
 * Draw a sparkline line. ctx is expected to be already scaled by DPR
 * (i.e. coordinates are in CSS pixels).
 */
export function drawMiniLine(args: LineDrawArgs): void {
  const {
    ctx,
    width,
    height,
    data,
    colors,
    themeColors,
    fill,
    baselineValue,
    totalSlots,
    sessionLayout,
  } = args;

  ctx.clearRect(0, 0, width, height);
  if (data.length < 2) return;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const d of data) {
    const v = getClose(d);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (baselineValue != null) {
    if (baselineValue < min) min = baselineValue;
    if (baselineValue > max) max = baselineValue;
  }

  const padY = 1;
  const innerH = Math.max(1, height - padY * 2);
  const range = max - min || 1;

  const yOf = (v: number) => padY + innerH - ((v - min) / range) * innerH;

  // Compute x positions per point. Session mode maps by time and emits
  // separate path segments per break; slot mode places points at evenly
  // spaced slot indices in a single segment.
  const useSession =
    sessionLayout != null &&
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    "time" in data[0];

  // Build segments (each is a contiguous polyline). Slot mode → 1 segment.
  const segments: Array<Array<[number, number]>> = [];
  if (useSession) {
    let cur: Array<[number, number]> = [];
    let curSegIdx = -2;
    for (const d of data) {
      const t = (d as SparklineCandle).time;
      const x = sessionLayout.timeToX(t);
      const segIdx = sessionLayout.segmentIndexOf(t);
      // null x or break-internal point: close current segment, skip.
      if (x === null || segIdx < 0) {
        if (cur.length > 0) {
          segments.push(cur);
          cur = [];
          curSegIdx = -2;
        }
        continue;
      }
      // Crossed into a new active segment: close current, start fresh
      // so the polyline never bridges a break gap.
      if (cur.length > 0 && segIdx !== curSegIdx) {
        segments.push(cur);
        cur = [];
      }
      curSegIdx = segIdx;
      cur.push([x, yOf(getClose(d))]);
    }
    if (cur.length > 0) segments.push(cur);
  } else {
    const slots = Math.max(data.length, totalSlots);
    const xStep = slots > 1 ? width / (slots - 1) : 0;
    const seg: Array<[number, number]> = [];
    for (let i = 0; i < data.length; i++) {
      seg.push([i * xStep, yOf(getClose(data[i]))]);
    }
    segments.push(seg);
  }
  const drawableSegments = segments.filter((s) => s.length >= 2);
  if (drawableSegments.length === 0) return;

  // Fill — one closed path per segment so the fill never crosses the gap.
  if (fill) {
    const baseY = baselineValue != null ? yOf(baselineValue) : height;
    ctx.globalAlpha = themeColors.fillAlpha;
    ctx.fillStyle = colors.fill;
    for (const seg of drawableSegments) {
      ctx.beginPath();
      ctx.moveTo(seg[0][0], baseY);
      for (const [x, y] of seg) ctx.lineTo(x, y);
      ctx.lineTo(seg[seg.length - 1][0], baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Baseline (drawn under stroke).
  if (baselineValue != null) {
    ctx.save();
    ctx.strokeStyle = themeColors.baseline;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    const by = yOf(baselineValue);
    ctx.moveTo(0, by);
    ctx.lineTo(width, by);
    ctx.stroke();
    ctx.restore();
  }

  // Stroke — one polyline per segment, so the line breaks at each gap.
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1.25;
  ctx.lineJoin = "round";
  for (const seg of drawableSegments) {
    ctx.beginPath();
    ctx.moveTo(seg[0][0], seg[0][1]);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i][0], seg[i][1]);
    ctx.stroke();
  }
}
