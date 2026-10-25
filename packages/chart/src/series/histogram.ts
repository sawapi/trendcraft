/**
 * Histogram Series Renderer
 * Renders vertical bars for volume, MACD histogram, etc.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

export type HistogramRenderOptions = {
  /** Positive bar color */
  upColor: string;
  /** Negative bar color */
  downColor: string;
  /** Bar width as fraction of bar spacing (default: 0.6) */
  widthFraction?: number;
};

/**
 * Histogram bars of two colours, drawn with one `fillStyle` per colour. Bars
 * closer than a pixel overlap, so the bars of one colour that start in the
 * same pixel column fold into a single rect spanning them all: zoomed out to
 * 0.1px spacing, a frame draws one rect per column instead of one per bar
 * (ops #124). Each bar touches the zero line, and bars at least a pixel wide
 * that start within a pixel of each other leave no gap, so the fold covers
 * the pixels its bars did: from the first bar's left edge to the last one's
 * right edge, from the highest top to the lowest bottom. (A short bar beside
 * a tall one gains the tall one's height for its sub-pixel offset.) Where a
 * column holds both colours, the taller rect is
 * drawn behind the shorter one, so both stay visible as they did when the
 * bars overlapped one by one.
 */
export class BarBatch {
  /**
   * Folded rects as x, width, top, bottom tuples, by layer and colour:
   * behind-up, behind-down, front-up, front-down.
   */
  private readonly _rects: number[][] = [[], [], [], []];
  private _col = Number.NaN;
  /** Per colour, the left edges of the first and the last bar in the column. */
  private readonly _first = [0, 0];
  private readonly _last = [0, 0];
  private readonly _top = [0, 0];
  private readonly _bottom = [0, 0];

  constructor(private readonly _width: number) {
    this._reset();
  }

  /** Add the bar at screen `x` (its left edge) from `top` to `bottom`. */
  add(x: number, top: number, bottom: number, down: boolean): void {
    const col = Math.floor(x);
    if (col !== this._col) {
      this._flush();
      this._col = col;
    }
    const k = down ? 1 : 0;
    if (this._top[k] > this._bottom[k]) this._first[k] = x;
    this._last[k] = x;
    if (top < this._top[k]) this._top[k] = top;
    if (bottom > this._bottom[k]) this._bottom[k] = bottom;
  }

  /** Draw every bar added, at most four `fillStyle` changes in all. */
  fill(ctx: CanvasRenderingContext2D, upColor: string, downColor: string): void {
    this._flush();
    for (let g = 0; g < 4; g++) {
      const r = this._rects[g];
      if (!r.length) continue;
      ctx.fillStyle = g % 2 ? downColor : upColor;
      for (let j = 0; j < r.length; j += 4) {
        ctx.fillRect(r[j], r[j + 2], r[j + 1], r[j + 3] - r[j + 2]);
      }
    }
  }

  private _flush(): void {
    const [upTop, downTop] = this._top;
    const [upBottom, downBottom] = this._bottom;
    // The shorter colour goes in front; a colour alone goes behind.
    const front = upBottom - upTop < downBottom - downTop ? 0 : 1;
    for (let k = 0; k < 2; k++) {
      if (this._top[k] <= this._bottom[k]) {
        const both = this._top[1 - k] <= this._bottom[1 - k];
        this._rects[(both && k === front ? 2 : 0) + k].push(
          this._first[k],
          this._last[k] - this._first[k] + this._width,
          this._top[k],
          this._bottom[k],
        );
      }
    }
    this._reset();
  }

  private _reset(): void {
    this._top[0] = this._top[1] = Number.POSITIVE_INFINITY;
    this._bottom[0] = this._bottom[1] = Number.NEGATIVE_INFINITY;
  }
}

/**
 * Render volume bars colored by candle direction.
 */
export function renderVolume(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  theme: ThemeColors,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const barWidth = Math.max(1, timeScale.barSpacing * 0.6);
  const halfBar = barWidth / 2;
  const zeroY = priceScale.priceToY(0);
  const bars = new BarBatch(barWidth);

  for (let i = start; i < end && i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const volY = priceScale.priceToY(candle.volume);
    bars.add(
      timeScale.indexToX(i) - halfBar,
      Math.min(volY, zeroY),
      Math.max(volY, zeroY),
      candle.close < candle.open,
    );
  }
  bars.fill(ctx, theme.volumeUp, theme.volumeDown);
}

/**
 * Render a generic histogram (e.g., MACD histogram).
 * Bars above zero use upColor, bars below use downColor.
 */
export function renderHistogram(
  ctx: CanvasRenderingContext2D,
  values: readonly (number | null)[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  options: HistogramRenderOptions,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const widthFraction = options.widthFraction ?? 0.6;
  const barWidth = Math.max(1, timeScale.barSpacing * widthFraction);
  const halfBar = barWidth / 2;
  const zeroY = priceScale.priceToY(0);
  const bars = new BarBatch(barWidth);

  for (let i = start; i < end && i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) continue;

    const valY = priceScale.priceToY(val);
    const top = Math.min(valY, zeroY);
    bars.add(
      timeScale.indexToX(i) - halfBar,
      top,
      top + Math.max(1, Math.abs(valY - zeroY)),
      val < 0,
    );
  }
  bars.fill(ctx, options.upColor, options.downColor);
}

/** Compute volume range for visible candles */
export function volumeRange(
  candles: readonly CandleData[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  let max = 0;
  for (let i = startIndex; i < endIndex && i < candles.length; i++) {
    const v = candles[i]?.volume;
    if (v !== undefined && Number.isFinite(v) && v > max) max = v;
  }
  return [0, max];
}
