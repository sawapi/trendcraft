/**
 * Scale system — Maps data coordinates to pixel coordinates.
 *
 * TimeScale: time/index → x pixel
 * PriceScale: price → y pixel
 */

import type { ScaleMode } from "./types";

// ============================================
// TimeScale
// ============================================

/**
 * Maps candle indices to x-pixel positions.
 * Uses index-based positioning (not continuous time) to avoid gaps
 * from non-trading hours.
 */
export class TimeScale {
  /** First visible candle index */
  private _startIndex = 0;
  /** Number of visible candles */
  private _visibleCount = 100;
  /** Available width in pixels for data area */
  private _width = 0;
  /** Total number of candles */
  private _totalCount = 0;
  /** Bar spacing in pixels */
  private _barSpacing = 8;
  /** Minimum bar spacing */
  private readonly _minBarSpacing = 2;
  /** Maximum bar spacing */
  private readonly _maxBarSpacing = 50;

  get startIndex(): number {
    return Math.floor(this._startIndex);
  }

  /** Raw (non-floored) startIndex for smooth animation/bounce calculations */
  get rawStartIndex(): number {
    return this._startIndex;
  }

  get endIndex(): number {
    return Math.min(Math.floor(this._startIndex) + this._visibleCount, this._totalCount);
  }

  get visibleCount(): number {
    return this._visibleCount;
  }

  get totalCount(): number {
    return this._totalCount;
  }

  get barSpacing(): number {
    return this._barSpacing;
  }

  get width(): number {
    return this._width;
  }

  setTotalCount(count: number): void {
    this._totalCount = count;
    this.clamp();
  }

  setWidth(width: number): void {
    this._width = width;
    this.recalcVisibleCount();
  }

  /** Index to center-x pixel position within data area */
  indexToX(index: number): number {
    return (index - this._startIndex + 0.5) * this._barSpacing;
  }

  /** X pixel to candle index at that position */
  xToIndex(x: number): number {
    return Math.floor(x / this._barSpacing + this._startIndex);
  }

  /** Scroll by delta candles (positive = scroll right) */
  scrollBy(deltaBars: number): void {
    this._startIndex += deltaBars;
    this.clamp();
  }

  /** Scroll to absolute index without changing barSpacing or visibleCount */
  scrollTo(index: number): void {
    this._startIndex = index;
    this.clamp();
  }

  /** Scroll to show last candles */
  scrollToEnd(): void {
    this._startIndex = Math.max(0, this._totalCount - this._visibleCount);
  }

  /** Zoom around a pixel position (Google Maps style — anchor stays under cursor) */
  zoom(factor: number, anchorX?: number): void {
    // Compute anchor as a fractional index before zoom
    // indexToX: x = (index - startIndex + 0.5) * barSpacing
    // → index = x / barSpacing - 0.5 + startIndex
    const ax = anchorX ?? this._width / 2;
    const anchorIndex = ax / this._barSpacing - 0.5 + this._startIndex;

    // Zoom-out minimum: 1px per bar. This ensures decimated candles render correctly.
    // fitContent() can go below 1px internally but interactive zoom stops here.
    const newSpacing = Math.max(1, Math.min(this._maxBarSpacing, this._barSpacing * factor));
    if (Math.abs(newSpacing - this._barSpacing) < 0.01) return;

    this._barSpacing = newSpacing;
    this.recalcVisibleCount();

    // After zoom, place startIndex so anchorIndex maps back to the same pixel ax
    // ax = (anchorIndex - newStart + 0.5) * newSpacing
    // → newStart = anchorIndex + 0.5 - ax / newSpacing
    this._startIndex = anchorIndex + 0.5 - ax / newSpacing;
    this.clamp();
  }

  /** Set visible range by start/end index */
  setVisibleRange(start: number, end: number): void {
    const count = end - start;
    if (count <= 0) return;
    this._barSpacing = Math.max(
      this._minBarSpacing,
      Math.min(this._maxBarSpacing, this._width / count),
    );
    this._visibleCount = Math.ceil(this._width / this._barSpacing);
    this._startIndex = start;
    this.clamp();
  }

  /** Fit all candles in view.
   *  barSpacing may go below 1px; the render pipeline remaps decimated
   *  candles to fill the canvas correctly in that case. */
  fitContent(): void {
    if (this._totalCount <= 0 || this._width <= 0) return;
    this._barSpacing = Math.min(this._maxBarSpacing, this._width / this._totalCount);
    this._barSpacing = Math.max(0.1, this._barSpacing);
    this.recalcVisibleCount();
    this._startIndex = 0;
  }

  /** Set startIndex and barSpacing directly (used by animation frames) */
  setImmediate(startIndex: number, barSpacing: number): void {
    this._barSpacing = Math.max(0.1, barSpacing);
    this.recalcVisibleCount();
    this._startIndex = startIndex;
    this.clamp();
  }

  /** Set startIndex without clamping (used for rubber-band overscroll) */
  setStartIndexUnclamped(startIndex: number): void {
    this._startIndex = startIndex;
  }

  /** Candle body width (fraction of bar spacing) */
  get candleWidth(): number {
    return Math.max(1, this._barSpacing * 0.6);
  }

  private recalcVisibleCount(): void {
    this._visibleCount = this._width > 0 ? Math.ceil(this._width / this._barSpacing) : 0;
  }

  /** Returns how far past the edge the viewport is (0 = within bounds).
   *  Negative = past left edge, positive = past right edge. */
  get overscroll(): number {
    const maxStart = this.maxStartIndex;
    if (maxStart === null) return 0;
    if (this._startIndex < 0) return this._startIndex;
    if (this._startIndex > maxStart) return this._startIndex - maxStart;
    return 0;
  }

  /** Scroll without clamping (allows overscroll for bounce effect) */
  scrollByUnclamped(deltaBars: number): void {
    this._startIndex += deltaBars;
    // Soft clamp: allow overscroll but with increasing resistance
    const maxStart = this.maxStartIndex;
    if (maxStart === null) {
      this.clamp();
      return;
    }
    if (this._startIndex < 0) {
      this._startIndex *= 0.4; // Rubber-band resistance
    } else if (this._startIndex > maxStart) {
      const over = this._startIndex - maxStart;
      this._startIndex = maxStart + over * 0.4;
    }
  }

  /** Snap back to the nearest edge (for bounce-back after overscroll) */
  get clampedStartIndex(): number {
    const maxStart = this.maxStartIndex;
    if (maxStart === null) return 0;
    return Math.max(0, Math.min(maxStart, this._startIndex));
  }

  /** Maximum allowed startIndex, or null if all data fits in view */
  private get maxStartIndex(): number | null {
    if (this._totalCount <= 0 || this._visibleCount >= this._totalCount) return null;
    const rightPad = Math.ceil(this._visibleCount * 0.2);
    return Math.max(0, this._totalCount + rightPad - this._visibleCount);
  }

  private clamp(): void {
    if (this._totalCount <= 0) {
      this._startIndex = 0;
      return;
    }
    if (this._visibleCount >= this._totalCount) {
      this._startIndex = 0;
      return;
    }
    const maxStart = this.maxStartIndex ?? 0;
    this._startIndex = Math.max(0, Math.min(maxStart, this._startIndex));
  }
}

// ============================================
// PriceScale
// ============================================

/**
 * Maps price values to y-pixel positions within a pane.
 * Supports linear, logarithmic, and percent scaling.
 */
export class PriceScale {
  private _mode: ScaleMode = "linear";
  private _min = 0;
  private _max = 100;
  private _ticksCacheKey = "";
  private _ticksCache: number[] = [];
  private _height = 0;
  /** Padding fraction for auto-range (e.g., 0.05 = 5% padding) */
  private _padding = 0.05;
  /** Fixed range override */
  private _fixedRange: [number, number] | null = null;

  get mode(): ScaleMode {
    return this._mode;
  }

  get min(): number {
    return this._min;
  }

  get max(): number {
    return this._max;
  }

  get height(): number {
    return this._height;
  }

  setMode(mode: ScaleMode): void {
    this._mode = mode;
  }

  setHeight(height: number): void {
    this._height = height;
  }

  setFixedRange(range: [number, number] | null): void {
    this._fixedRange = range;
  }

  /** Update data range from visible candles/series */
  setDataRange(min: number, max: number): void {
    if (this._fixedRange) {
      this._min = this._fixedRange[0];
      this._max = this._fixedRange[1];
      return;
    }

    let lo = min;
    let hi = max;
    if (lo === hi) {
      // Avoid zero-height range
      lo = lo * 0.99;
      hi = hi * 1.01;
    }

    const range = hi - lo;
    const pad = range * this._padding;
    this._min = lo - pad;
    this._max = hi + pad;
  }

  /** Price to y pixel (0 = top of pane) */
  priceToY(price: number): number {
    if (this._height <= 0) return 0;

    let normalized: number;
    if (this._mode === "log") {
      const logMin = Math.log(Math.max(this._min, 1e-10));
      const logMax = Math.log(Math.max(this._max, 1e-10));
      const logPrice = Math.log(Math.max(price, 1e-10));
      normalized = (logPrice - logMin) / (logMax - logMin || 1);
    } else {
      normalized = (price - this._min) / (this._max - this._min || 1);
    }

    // Invert: higher price = lower y
    return this._height * (1 - normalized);
  }

  /** Y pixel to price */
  yToPrice(y: number): number {
    if (this._height <= 0) return this._min;

    const normalized = 1 - y / this._height;

    if (this._mode === "log") {
      const logMin = Math.log(Math.max(this._min, 1e-10));
      const logMax = Math.log(Math.max(this._max, 1e-10));
      return Math.exp(logMin + normalized * (logMax - logMin));
    }

    return this._min + normalized * (this._max - this._min);
  }

  /** Generate nice tick values for the y-axis (memoized per min/max/maxTicks) */
  getTicks(maxTicks = 6): number[] {
    const key = `${this._min}:${this._max}:${maxTicks}`;
    if (key === this._ticksCacheKey) return this._ticksCache;

    const range = this._max - this._min;
    if (range <= 0) {
      this._ticksCacheKey = key;
      this._ticksCache = [];
      return [];
    }

    const rawStep = range / maxTicks;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;

    let niceStep: number;
    if (normalized <= 1.5) niceStep = 1;
    else if (normalized <= 3.5) niceStep = 2;
    else if (normalized <= 7.5) niceStep = 5;
    else niceStep = 10;
    niceStep *= magnitude;

    const ticks: number[] = [];
    const start = Math.ceil(this._min / niceStep) * niceStep;
    for (let v = start; v <= this._max; v += niceStep) {
      ticks.push(v);
    }

    this._ticksCacheKey = key;
    this._ticksCache = ticks;
    return [...ticks];
  }
}
