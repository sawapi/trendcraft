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
 * Horizontal pitch, in CSS pixels, between two consecutive candles.
 *
 * The single owner of that number. In slot mode it is the canvas divided by the
 * slot count. In session mode it is the median distance between the pixels the
 * layout actually places the candles at — asked of the layout, not re-derived
 * from timestamps.
 *
 * Two things make the timestamp form wrong there. The pitch is unrelated to the
 * bar count, so the slot-mode formula the density fallback in `group.ts` used to
 * apply in both cases under-triggered exactly where candles get too thin to see
 * and left `drawMiniCandles` painting a row of 1px sticks — the clamp its
 * `Math.max(1, …)` exists for. And a pair straddling a break is not
 * `dt * pxPerMs` apart: the layout drops the break's duration and puts a fixed
 * `breakGap` there instead. On a 10px canvas with a 1px gap, candles at
 * t=40/60/61 of a 0–100 session broken at 40–60 sit 1px and 0.11px apart, while
 * the timestamp formula reported 2.25px and kept them as candles.
 *
 * The four cases, in order:
 * - no candle is painted (all outside the session or inside a break) → `0`, so
 *   callers can tell "no pitch" from "pitch below the threshold";
 * - one painted candle → the full canvas width, since a lone candle is never
 *   too thin to draw;
 * - several painted candles that all share a pixel → an equal share of the
 *   canvas each, matching what slot mode would give them;
 * - otherwise → the median distance between consecutive painted candles.
 *
 * Candles the layout does not place are excluded from every count.
 */
export function candlePitchPx(args: {
  data: readonly SparklineCandle[];
  width: number;
  totalSlots: number;
  sessionLayout?: SessionLayout;
}): number {
  const { data, width, totalSlots, sessionLayout } = args;
  if (data.length === 0) return 0;
  if (!sessionLayout) {
    const slots = Math.max(data.length, totalSlots);
    return slots > 0 ? width / slots : 0;
  }
  // Only the candles the layout gives a position to are painted, so only those
  // can have a spacing. Counting the rest is what made a chart go blank: with
  // one visible candle among a hundred that fall inside a break, dividing by
  // the total gave 80/101 = 0.79px, the fallback chose a line, and a line needs
  // two visible points — so nothing was drawn at all.
  const positions: number[] = [];
  for (const candle of data) {
    const x = sessionLayout.timeToX(candle.time);
    if (x !== null) positions.push(x);
  }
  // Nothing is painted, so there is no pitch. `group.ts` reads 0 as "no pitch"
  // rather than "too thin" and leaves the mode alone.
  if (positions.length === 0) return 0;

  const spacings: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    const step = positions[i] - positions[i - 1];
    if (step > 0) spacings.push(step);
  }
  if (spacings.length === 0) {
    // No two visible candles land on distinct pixels — either there is just one,
    // or they all share a timestamp and stack. Give each visible candle an equal
    // share of the canvas, which for a single candle is the whole of it and
    // therefore never reads as "too thin to draw".
    return width / positions.length;
  }
  spacings.sort((a, b) => a - b);
  return spacings[Math.floor(spacings.length / 2)];
}

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

  const slot = candlePitchPx({ data, width, totalSlots, sessionLayout });
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
