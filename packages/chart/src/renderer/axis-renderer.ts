/**
 * Axis Renderer — Draws price (Y) and time (X) axes.
 */

import {
  autoFormatPrice,
  autoFormatTime,
  formatShortDate,
  formatShortTime,
  pickNiceStep,
} from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

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
   * Vertical center (canvas coords) of a foreground label that tick labels
   * should avoid (e.g. the current-price badge on the main pane). Ticks whose
   * Y falls within `excludeY ± excludeHalfHeight` are skipped.
   */
  excludeY?: number;
  excludeHalfHeight?: number;
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
  priceFormatter: (price: number) => string = autoFormatPrice,
  options: PriceAxisOptions | "left" | "right" = {},
): void {
  // Back-compat: position can be passed as a bare string.
  const opts: PriceAxisOptions = typeof options === "string" ? { position: options } : options;
  const position = opts.position ?? "right";
  const maxTicks = Math.max(2, opts.maxTicks ?? 6);
  const ticks = priceScale.getTicks(maxTicks);

  // Suppress labels too close to pane edges (avoids visual collision with the
  // adjacent pane's edge label) or overlapping the current-price badge.
  const EDGE_PAD = Math.min(8, fontSize); // ~one label half-height
  const excludeY = opts.excludeY;
  const excludeHalf = opts.excludeHalfHeight ?? 0;

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
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = position === "left" ? "right" : "left";
  const labelX = position === "left" ? x - 6 : x + 6;

  for (const tick of ticks) {
    const tickY = priceScale.priceToY(tick) + y;
    if (tickY < y || tickY > y + height) continue;
    if (excludeY !== undefined && Math.abs(tickY - excludeY) < excludeHalf + 2) {
      continue;
    }

    // Flip baseline near edges so labels stay within the pane.
    if (tickY < y + EDGE_PAD) {
      ctx.textBaseline = "top";
      ctx.fillText(priceFormatter(tick), labelX, y + 1);
    } else if (tickY > y + height - EDGE_PAD) {
      ctx.textBaseline = "bottom";
      ctx.fillText(priceFormatter(tick), labelX, y + height - 1);
    } else {
      ctx.textBaseline = "middle";
      ctx.fillText(priceFormatter(tick), labelX, tickY);
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
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
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

  for (let i = firstAnchor; i < end && i < candles.length; i += labelInterval) {
    const candle = candles[i];
    if (!candle) continue;

    const labelX = timeScale.indexToX(i);
    const label = timeFormatter
      ? timeFormatter(candle.time)
      : autoFormatTime(candle.time, prevLabelTime);
    prevLabelTime = candle.time;

    ctx.fillText(label, labelX, y + 6);
  }
}

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
  for (const t of timeTicks) {
    ctx.fillText(formatShortTime(t.time), x + t.x, topY);
  }

  // Lower row: date at day boundaries. Skip the first tick if it would collide
  // with the very-left edge (likely a partial view).
  const bottomY = y + Math.max(18, height / 2);
  let prevDateTime: number | null = null;
  for (const d of dateTicks) {
    const label = formatShortDate(d.time, prevDateTime);
    ctx.fillText(label, x + d.x, bottomY);
    prevDateTime = d.time;
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
