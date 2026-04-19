/**
 * DrawHelper — Lightweight drawing helper for plugin renderers.
 *
 * Wraps coordinate conversion, null-gap handling, and common canvas
 * patterns. The raw `ctx` is always available for advanced use.
 *
 * @example
 * ```typescript
 * render: ({ draw }) => {
 *   draw.line(values, { color: '#2196F3', lineWidth: 1.5 });
 *   draw.hline(100, { color: '#FF9800', dash: [4, 2] });
 *   draw.circle(42, 150.5, 3, { color: '#26a69a' });
 * }
 * ```
 */

import type { PriceScale, TimeScale } from "./scale";

/** Style options for stroke-based drawing methods */
export type StrokeStyle = {
  color: string;
  lineWidth?: number;
  dash?: number[];
};

/** Style options for fill-based drawing methods */
export type FillStyle = {
  color: string;
};

export class DrawHelper {
  public ctx: CanvasRenderingContext2D;
  public timeScale: TimeScale;
  public priceScale: PriceScale;

  constructor(ctx: CanvasRenderingContext2D, timeScale: TimeScale, priceScale: PriceScale) {
    this.ctx = ctx;
    this.timeScale = timeScale;
    this.priceScale = priceScale;
  }

  /** Update references for reuse across frames (avoids re-allocation) */
  reset(ctx: CanvasRenderingContext2D, timeScale: TimeScale, priceScale: PriceScale): void {
    this.ctx = ctx;
    this.timeScale = timeScale;
    this.priceScale = priceScale;
  }

  // ---- Coordinate conversion ----

  /** Convert bar index to x pixel */
  x(index: number): number {
    return this.timeScale.indexToX(index);
  }

  /** Convert price to y pixel */
  y(price: number): number {
    return this.priceScale.priceToY(price);
  }

  // ---- Visible range shorthand ----

  get startIndex(): number {
    return this.timeScale.startIndex;
  }
  get endIndex(): number {
    return this.timeScale.endIndex;
  }
  get barSpacing(): number {
    return this.timeScale.barSpacing;
  }

  // ---- Drawing methods ----

  /**
   * Draw a line with automatic null-gap handling.
   * Values are indexed by candle index (values[startIndex..endIndex]).
   */
  line(values: readonly (number | null)[], style: StrokeStyle): void {
    strokeNullableLine(this.ctx, values, this.timeScale, this.priceScale, style);
  }

  /**
   * Draw a filled rectangle in index/price space.
   * Covers from (index, priceTop) to (index + widthBars, priceBottom).
   */
  rect(
    index: number,
    priceTop: number,
    widthBars: number,
    priceBottom: number,
    fill: FillStyle,
    stroke?: StrokeStyle,
  ): void {
    const { ctx, timeScale, priceScale } = this;
    const x1 = timeScale.indexToX(index);
    const x2 = timeScale.indexToX(index + widthBars);
    const y1 = priceScale.priceToY(priceTop);
    const y2 = priceScale.priceToY(priceBottom);
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    ctx.fillStyle = fill.color;
    ctx.fillRect(left, top, w, h);

    if (stroke) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth ?? 1;
      ctx.setLineDash(stroke.dash ?? []);
      ctx.strokeRect(left, top, w, h);
      ctx.setLineDash([]);
    }
  }

  /**
   * Fill area between two value arrays (upper/lower bands).
   * Handles null gaps by segmenting.
   */
  fillBetween(
    upper: readonly (number | null)[],
    lower: readonly (number | null)[],
    fill: FillStyle,
  ): void {
    const { ctx, timeScale, priceScale } = this;
    const start = timeScale.startIndex;
    const end = timeScale.endIndex;
    const limit = Math.min(end, upper.length, lower.length);

    const segment: { x: number; uy: number; ly: number }[] = [];

    const flushSegment = () => {
      if (segment.length < 2) {
        segment.length = 0;
        return;
      }
      ctx.fillStyle = fill.color;
      ctx.beginPath();
      ctx.moveTo(segment[0].x, segment[0].uy);
      for (let j = 1; j < segment.length; j++) {
        ctx.lineTo(segment[j].x, segment[j].uy);
      }
      for (let j = segment.length - 1; j >= 0; j--) {
        ctx.lineTo(segment[j].x, segment[j].ly);
      }
      ctx.closePath();
      ctx.fill();
      segment.length = 0;
    };

    for (let i = start; i < limit; i++) {
      const u = upper[i];
      const l = lower[i];
      if (u === null || u === undefined || l === null || l === undefined) {
        flushSegment();
        continue;
      }
      segment.push({
        x: timeScale.indexToX(i),
        uy: priceScale.priceToY(u),
        ly: priceScale.priceToY(l),
      });
    }
    flushSegment();
  }

  /**
   * Draw a horizontal line across the full pane width at a given price.
   */
  hline(price: number, style: StrokeStyle): void {
    const { ctx, timeScale, priceScale } = this;
    const py = priceScale.priceToY(price);

    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth ?? 1;
    ctx.setLineDash(style.dash ?? []);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(timeScale.width, py);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Draw a circle marker at (index, price). Radius is in pixels.
   */
  circle(index: number, price: number, radius: number, fill: FillStyle): void {
    const { ctx, timeScale, priceScale } = this;
    const px = timeScale.indexToX(index);
    const py = priceScale.priceToY(price);

    ctx.fillStyle = fill.color;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a text label at (index, price).
   */
  text(
    label: string,
    index: number,
    price: number,
    options?: {
      color?: string;
      font?: string;
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
    },
  ): void {
    const { ctx, timeScale, priceScale } = this;
    const px = timeScale.indexToX(index);
    const py = priceScale.priceToY(price);

    if (options?.font) ctx.font = options.font;
    ctx.fillStyle = options?.color ?? "#d1d4dc";
    ctx.textAlign = options?.align ?? "center";
    ctx.textBaseline = options?.baseline ?? "bottom";
    ctx.fillText(label, px, py);
  }

  /**
   * Scoped block with automatic save/restore.
   * Ensures all canvas state changes (lineDash, transforms, etc.) are cleaned up.
   */
  scope(fn: (ctx: CanvasRenderingContext2D) => void): void {
    this.ctx.save();
    fn(this.ctx);
    this.ctx.restore();
  }
}

/**
 * Stroke a polyline over the currently-visible bar range, breaking the path
 * at any null/undefined sample (so indicators with warm-up gaps render as
 * disconnected segments rather than a line back to the origin).
 *
 * Shared by {@link DrawHelper.line} and the series renderers (band, line,
 * cloud) so the null-gap rule lives in exactly one place.
 */
export function strokeNullableLine(
  ctx: CanvasRenderingContext2D,
  values: readonly (number | null | undefined)[],
  timeScale: { startIndex: number; endIndex: number; indexToX: (i: number) => number },
  priceScale: { priceToY: (p: number) => number },
  style: StrokeStyle,
): void {
  const start = timeScale.startIndex;
  const end = Math.min(timeScale.endIndex, values.length);

  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth ?? 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(style.dash ?? []);

  let drawing = false;
  ctx.beginPath();
  for (let i = start; i < end; i++) {
    const val = values[i];
    if (val === null || val === undefined) {
      drawing = false;
      continue;
    }
    const px = timeScale.indexToX(i);
    const py = priceScale.priceToY(val);
    if (!drawing) {
      ctx.moveTo(px, py);
      drawing = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Clip the given canvas to a pane rect for the duration of `fn`.
 * Always pairs save/restore, even if `fn` throws.
 */
export function withPaneClip(
  ctx: CanvasRenderingContext2D,
  pane: { x: number; y: number; width: number; height: number },
  fn: () => void,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();
  fn();
  ctx.restore();
}
