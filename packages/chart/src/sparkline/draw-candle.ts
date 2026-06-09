import type { StrokeAndFill } from "./color-resolve";
import { computeYScale, drawSparkBaseline } from "./scale";
import type { SessionLayout } from "./session";
import type { ResolvedColors, SparklineCandle } from "./types";

export type CandleDrawArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  data: SparklineCandle[];
  colors: StrokeAndFill;
  themeColors: ResolvedColors;
  baselineValue: number | null;
  /** Total horizontal slots; candles fill the first `data.length`. Ignored when `sessionLayout` is set. */
  totalSlots: number;
  /** Pre-built session layout; when set, candles are placed by `.time`. */
  sessionLayout?: SessionLayout;
};

/**
 * Draw mini candles. ctx must be already DPR-scaled (CSS-pixel coords).
 * Caller is responsible for max-candle truncation; this function draws all of `data`.
 */
export function drawMiniCandles(args: CandleDrawArgs): void {
  const {
    ctx,
    width,
    height,
    data,
    colors,
    themeColors,
    baselineValue,
    totalSlots,
    sessionLayout,
  } = args;

  ctx.clearRect(0, 0, width, height);
  if (data.length === 0) return;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const c of data) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }

  const { yOf } = computeYScale(min, max, baselineValue, height);

  // Compute slot/body width. Session mode bases the slot on the median bar
  // interval mapped to pixels via the layout's pxPerMs; slot mode uses simple
  // even slots across the whole canvas.
  let slot: number;
  if (sessionLayout) {
    const intervals: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const dt = data[i].time - data[i - 1].time;
      if (dt > 0) intervals.push(dt);
    }
    intervals.sort((a, b) => a - b);
    const medianMs =
      intervals.length > 0
        ? intervals[Math.floor(intervals.length / 2)]
        : sessionLayout.activeMs > 0 && data.length > 0
          ? sessionLayout.activeMs / data.length
          : 1;
    const pxPerMs =
      sessionLayout.activeMs > 0 ? sessionLayout.usablePx / sessionLayout.activeMs : 0;
    slot = pxPerMs > 0 ? medianMs * pxPerMs : width / Math.max(1, data.length);
  } else {
    const slots = Math.max(data.length, totalSlots);
    slot = width / slots;
  }
  const bodyW = Math.max(1, Math.floor(slot * 0.7));

  // Baseline (under candles)
  drawSparkBaseline(ctx, yOf, baselineValue, width, themeColors.baseline);

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    let cx: number;
    if (sessionLayout) {
      const x = sessionLayout.timeToX(c.time);
      if (x === null) continue; // outside session or in a break
      cx = x;
    } else {
      cx = (i + 0.5) * slot;
    }
    const isUp = colors.perCandle ? c.close >= c.open : true;
    const color = colors.perCandle ? (isUp ? colors.up : colors.down) : colors.stroke;

    // Body — pixel-aligned rectangle.
    const bodyX = Math.round(cx - bodyW / 2);
    const yOpen = yOf(c.open);
    const yClose = yOf(c.close);
    const top = Math.min(yOpen, yClose);
    const h = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillStyle = color;
    ctx.fillRect(bodyX, Math.round(top), bodyW, Math.round(h));

    // Wick — center on the body center so even-width bodies stay aligned.
    // (Math.round(cx) + 0.5 is off by 0.5px when bodyW is even, producing
    // a 1px visible shift.)
    const wickX = bodyX + bodyW / 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wickX, yOf(c.high));
    ctx.lineTo(wickX, yOf(c.low));
    ctx.stroke();
  }
}
