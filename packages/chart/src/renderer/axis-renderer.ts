/**
 * Axis Renderer — Draws price (Y) and time (X) axes.
 */

import { canvasFont, DEFAULT_FONT_FAMILY } from "../core/font";
import {
  autoFormatTime,
  estimateBarIntervalMs,
  formatShortDate,
  formatShortTime,
  measureTextWidth,
  pickNiceStep,
  tickPriceFormatter,
} from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

/** A Y range (canvas coordinates) that tick labels must not overlap. */
export type AxisExcludeRange = { y: number; half: number };

/** Options for {@link renderPriceAxis}. All fields are optional. */
export type PriceAxisOptions = {
  position?: "left" | "right";
  /**
   * Max number of tick labels. Defaults to 6 for back-compat, but callers
   * should pass a value computed from pane height (≈ `height / 32`) to avoid
   * label crowding on short sub-panes.
   */
  maxTicks?: number;
  /**
   * @deprecated Use {@link excludeYRanges}. Kept for back-compat with the
   * single current-price-badge exclusion the main pane originally needed.
   */
  excludeY?: number;
  /** @deprecated Use {@link excludeYRanges}. */
  excludeHalfHeight?: number;
  /**
   * Y ranges tick labels must avoid (e.g. current-price badge + every
   * series last-value badge). Tick labels whose Y falls inside any
   * `y ± (half + 2)` are skipped.
   */
  excludeYRanges?: readonly AxisExcludeRange[];
};

/**
 * Render the price axis for a pane.
 * Supports both left and right positioning for dual-scale panes.
 */
export function renderPriceAxis(
  ctx: CanvasRenderingContext2D,
  priceScale: PriceScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
  fontSize: number,
  priceFormatter?: (price: number) => string,
  options: PriceAxisOptions | "left" | "right" = {},
  fontFamily: string = DEFAULT_FONT_FAMILY,
): void {
  // Back-compat: position can be passed as a bare string.
  const opts: PriceAxisOptions = typeof options === "string" ? { position: options } : options;
  const position = opts.position ?? "right";
  const maxTicks = Math.max(2, opts.maxTicks ?? 6);
  const ticks = priceScale.getTicks(maxTicks);
  // Without a formatter from the caller, every tick label gets the decimals
  // the tick step needs, or on a log axis its own digits. A caller's own
  // formatter is used as given.
  const formatTick = priceFormatter ?? tickPriceFormatter(ticks, priceScale.mode === "log");

  // Suppress labels too close to pane edges (avoids visual collision with the
  // adjacent pane's edge label) or overlapping foreground labels like the
  // current-price badge or last-value series badges.
  const EDGE_PAD = Math.min(8, fontSize); // ~one label half-height
  const excludeRanges: readonly AxisExcludeRange[] =
    opts.excludeYRanges ??
    (opts.excludeY !== undefined ? [{ y: opts.excludeY, half: opts.excludeHalfHeight ?? 0 }] : []);

  ctx.fillStyle = theme.background;
  if (position === "left") {
    ctx.fillRect(x - width, y, width, height);
  } else {
    ctx.fillRect(x, y, width, height);
  }

  // Border line
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (position === "left") {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
  }
  ctx.stroke();

  // Tick labels. Near pane edges, flip the baseline to "top" / "bottom" so
  // the label nudges inward instead of being clipped or hidden — important
  // for short panes (e.g. a volume pane where the nice-step tick generator
  // lands ticks at exactly the min/max of the range).
  ctx.fillStyle = theme.textSecondary;
  ctx.font = canvasFont(fontSize, fontFamily);
  ctx.textAlign = position === "left" ? "right" : "left";
  const labelX = position === "left" ? x - 6 : x + 6;

  outer: for (const tick of ticks) {
    const tickY = priceScale.priceToY(tick) + y;
    if (tickY < y || tickY > y + height) continue;
    for (const r of excludeRanges) {
      if (Math.abs(tickY - r.y) < r.half + 2) continue outer;
    }

    // Flip baseline near edges so labels stay within the pane.
    if (tickY < y + EDGE_PAD) {
      ctx.textBaseline = "top";
      ctx.fillText(formatTick(tick), labelX, y + 1);
    } else if (tickY > y + height - EDGE_PAD) {
      ctx.textBaseline = "bottom";
      ctx.fillText(formatTick(tick), labelX, y + height - 1);
    } else {
      ctx.textBaseline = "middle";
      ctx.fillText(formatTick(tick), labelX, tickY);
    }
  }
}

/**
 * Render the time axis (bottom).
 */
export function renderTimeAxis(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
  fontSize: number,
  timeFormatter?: (time: number) => string,
  fontFamily: string = DEFAULT_FONT_FAMILY,
): void {
  ctx.fillStyle = theme.background;
  ctx.fillRect(x, y, width + 100, height);

  // Top border
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();

  ctx.fillStyle = theme.textSecondary;
  ctx.font = canvasFont(fontSize, fontFamily);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // --- Two-row mode: wall-clock time ticks + date anchors (requires time data) ---
  const intradayThresholdMs = 6 * 60 * 60 * 1000;
  const medianMs = timeScale.medianBarIntervalMs;
  const twoRow =
    !timeFormatter && timeScale.hasTimeData && medianMs > 0 && medianMs <= intradayThresholdMs;

  if (twoRow && height >= 28) {
    renderTwoRowAxis(ctx, timeScale, x, y, width, height);
    return;
  }

  // --- Legacy single-row mode: labels at fixed pixel spacing ---
  const minLabelSpacing = 80;
  const barSpacing = timeScale.barSpacing;
  const labelInterval = Math.max(1, Math.ceil(minLabelSpacing / barSpacing));

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const firstAnchor = Math.ceil(start / labelInterval) * labelInterval;
  let prevLabelTime: number | null = null;

  // Dominant bar interval, used to decide whether the first label's wall-clock
  // time is meaningful (intraday) or a timezone artifact (daily+). Derived
  // straight from the candle timestamps — not timeScale.medianBarIntervalMs,
  // which is only populated in time-proportional layout mode and is 0 here.
  const barIntervalMs = estimateBarIntervalMs(candles);

  let lastRight = Number.NEGATIVE_INFINITY;
  for (let i = firstAnchor; i < end && i < candles.length; i += labelInterval) {
    const candle = candles[i];
    if (!candle) continue;

    const labelX = timeScale.indexToX(i);
    const label = timeFormatter
      ? timeFormatter(candle.time)
      : autoFormatTime(candle.time, prevLabelTime, barIntervalMs, timeScale.timeZone);

    const right = drawClampedAxisLabel(ctx, label, labelX, y + 6, x, x + width, lastRight);
    // A skipped label is not "the previous label": the next one is formatted
    // against the last label actually shown, so a dropped month or date
    // anchor is not silently implied.
    if (right !== null) {
      lastRight = right;
      prevLabelTime = candle.time;
    }
  }
}

/** Minimum horizontal gap, in px, between two time-axis labels. */
const LABEL_GAP = 6;

/**
 * Draw an axis label horizontally clamped inside `[leftBound, rightBound]`. A
 * centered label whose tick sits at the plot boundary loses ~half its text to
 * clipping, so the first label is left-aligned (and nudged in) and one
 * overflowing the right edge is right-aligned; the rest stay centered. Mirrors
 * the inward-nudge the price axis does via textBaseline. Mutates ctx.textAlign.
 *
 * Skips the label, returning `null`, when it would start within LABEL_GAP of
 * `prevRight` (the right edge of the previous label in the row): a clamped
 * edge label grows inward and would otherwise run into its neighbour.
 * Returns the drawn label's right edge.
 */
function drawClampedAxisLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  centerX: number,
  y: number,
  leftBound: number,
  rightBound: number,
  prevRight = Number.NEGATIVE_INFINITY,
): number | null {
  const width = measureTextWidth(ctx, label);
  const half = width / 2;
  let align: CanvasTextAlign = "center";
  let at = centerX;
  let left = centerX - half;
  if (centerX - half < leftBound) {
    align = "left";
    at = Math.max(centerX, leftBound + 2);
    left = at;
  } else if (centerX + half > rightBound) {
    align = "right";
    at = Math.min(centerX, rightBound - 2);
    left = at - width;
  }
  if (left < prevRight + LABEL_GAP) return null;
  ctx.textAlign = align;
  ctx.fillText(label, at, y);
  return left + width;
}

/**
 * Estimate the dominant bar interval (ms) from candle timestamps by taking the
 * minimum positive gap across a bounded sample. Minimum (rather than
 * mean/median) returns the regular bar spacing while ignoring the larger gaps
 * introduced by weekends and holidays. Returns 0 when it cannot be determined
 * (no time data or <2 candles).
 */

/**
 * Render a two-row time axis: upper = wall-clock HH:MM ticks at regular
 * intervals, lower = date anchors at local-TZ day boundaries.
 */
function renderTwoRowAxis(
  ctx: CanvasRenderingContext2D,
  timeScale: TimeScale,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  // Pick tick step based on visible time span and target label density.
  const range = timeScale.getVisibleTimeRange();
  if (!range) return;
  const [t0, t1] = range;
  const minLabelPx = 70;
  const maxTicks = Math.max(2, Math.floor(width / minLabelPx));
  const step = pickNiceStep(t1 - t0, maxTicks);

  const timeTicks = timeScale.getTimeTicks(step);
  const dateTicks = timeScale.getDateTicks();

  // Upper row: HH:MM at time ticks. Show date when HH:MM is 00:00 to avoid a
  // confusing "naked 00:00" that in 24h format might look like a tick near
  // midnight but without date context (the date row will anchor it below).
  const topY = y + 4;
  const rightBound = x + width;
  let lastTop = Number.NEGATIVE_INFINITY;
  for (const t of timeTicks) {
    lastTop =
      drawClampedAxisLabel(
        ctx,
        formatShortTime(t.time, timeScale.timeZone),
        x + t.x,
        topY,
        x,
        rightBound,
        lastTop,
      ) ?? lastTop;
  }

  // Lower row: date at day boundaries. Edge ticks are clamped inward (rather
  // than clipped) by drawClampedAxisLabel, so a date at the very-left/right
  // boundary of a partial view stays fully readable.
  const bottomY = y + Math.max(18, height / 2);
  let prevDateTime: number | null = null;
  let lastDate = Number.NEGATIVE_INFINITY;
  for (const d of dateTicks) {
    const label = formatShortDate(d.time, prevDateTime, timeScale.timeZone);
    const right = drawClampedAxisLabel(ctx, label, x + d.x, bottomY, x, rightBound, lastDate);
    if (right !== null) {
      lastDate = right;
      prevDateTime = d.time;
    }
  }
}

/**
 * Render horizontal grid lines for a pane.
 * Optionally renders vertical grid lines aligned with time axis ticks.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  priceScale: PriceScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
  timeScale?: TimeScale,
  candles?: readonly CandleData[],
  maxTicks?: number,
): void {
  const ticks = priceScale.getTicks(Math.max(2, maxTicks ?? 6));

  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;

  // Horizontal grid lines
  for (const tick of ticks) {
    const tickY = Math.round(priceScale.priceToY(tick) + y) + 0.5;
    if (tickY < y || tickY > y + height) continue;
    ctx.beginPath();
    ctx.moveTo(x, tickY);
    ctx.lineTo(x + width, tickY);
    ctx.stroke();
  }

  // Vertical grid lines (aligned with time axis labels)
  if (timeScale && candles) {
    const minLabelSpacing = 80;
    const labelInterval = Math.max(1, Math.ceil(minLabelSpacing / timeScale.barSpacing));
    const start = timeScale.startIndex;
    const end = timeScale.endIndex;
    const firstAnchor = Math.ceil(start / labelInterval) * labelInterval;

    for (let i = firstAnchor; i < end && i < candles.length; i += labelInterval) {
      const gridX = Math.round(timeScale.indexToX(i)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(gridX, y);
      ctx.lineTo(gridX, y + height);
      ctx.stroke();
    }
  }
}

/**
 * Render reference lines (e.g., 30/70 for RSI).
 */
export function renderReferenceLines(
  ctx: CanvasRenderingContext2D,
  lines: number[],
  priceScale: PriceScale,
  x: number,
  y: number,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  for (const val of lines) {
    const lineY = Math.round(priceScale.priceToY(val) + y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + width, lineY);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

// Formatting delegated to core/format.ts
