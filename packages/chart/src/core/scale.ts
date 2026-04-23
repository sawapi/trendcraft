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
 * Time-proportional config for {@link TimeScale.setTimeProportional}.
 */
export type TimeProportionalOptions = {
  /** Typical bar interval in ms. Default: auto (median of consecutive deltas). */
  medianMs?: number;
  /** Deltas exceeding this compress to `sessionGapBars` instead of proportional. Default: 4h. */
  sessionThresholdMs?: number;
  /** Width (in bar-units) of a compressed session gap. Default: 1.5. */
  sessionGapBars?: number;
};

/**
 * Maps candle indices (and optionally wall-clock time) to x-pixel positions.
 *
 * - **Index mode** (default): bars are laid out at uniform `barSpacing`;
 *   `indexToX(i) = (i - startIndex + 0.5) * barSpacing`. Fast and cheap.
 * - **Virtual mode**: each bar has an explicit virtual position in `_virt`,
 *   enabling:
 *     - {@link setGapsBefore} — fixed extra space before specific indices
 *       (legacy day-boundary gap API).
 *     - {@link setTimeProportional} — spacing within a session proportional
 *       to the bar's wall-clock delta, with long session breaks compressed
 *       to a fixed visual gap. Enables {@link timeToX}, {@link getTimeTicks},
 *       {@link getDateTicks} for a Yahoo / TradingView style time axis.
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

  /**
   * Virtual position of each bar (length = totalCount when populated).
   * `_virt[i]` is the virtual x-coordinate (in bar-units) of real bar i.
   * Empty = index mode (fast path: virtual = real index).
   */
  private _virt: Float64Array = new Float64Array(0);
  /**
   * Wall-clock timestamps of each bar — populated by setTimeProportional only.
   * Used by timeToX / getTimeTicks / getDateTicks. Empty in other modes.
   */
  private _candleTimes: Float64Array = new Float64Array(0);

  get startIndex(): number {
    return Math.floor(this._startIndex);
  }

  /** Raw (non-floored) startIndex for smooth animation/bounce calculations */
  get rawStartIndex(): number {
    return this._startIndex;
  }

  get endIndex(): number {
    if (this._virt.length === 0) {
      return Math.min(Math.floor(this._startIndex) + this._visibleCount, this._totalCount);
    }
    const startV = this.virtAt(this._startIndex);
    const end = Math.ceil(this.realAtVirt(startV + this._visibleCount));
    return Math.min(end, this._totalCount);
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
    // Reset virtual/time mode — caller must re-apply if needed.
    if (this._virt.length !== 0 && this._virt.length !== count) {
      this._virt = new Float64Array(0);
      this._candleTimes = new Float64Array(0);
    }
    this.clamp();
  }

  /**
   * Install visual gaps at specific real indices. Each entry reserves `size`
   * bar-widths of empty space strictly before that real index. Pass an empty
   * array to clear all gaps. Legacy API — prefer {@link setTimeProportional}
   * for wall-clock-aware spacing.
   *
   * @example
   * ```ts
   * // Insert a half-bar gap before indices 390 (Mon open) and 780 (Tue open)
   * timeScale.setGapsBefore([
   *   { index: 390, size: 0.5 },
   *   { index: 780, size: 0.5 },
   * ]);
   * ```
   */
  setGapsBefore(gaps: ReadonlyArray<{ index: number; size: number }>): void {
    const n = this._totalCount;
    if (n === 0 || gaps.length === 0) {
      this._virt = new Float64Array(0);
      this._candleTimes = new Float64Array(0);
      this.clamp();
      return;
    }
    const gapMap = new Map<number, number>();
    for (const g of gaps) {
      if (g.size <= 0) continue;
      gapMap.set(g.index, (gapMap.get(g.index) ?? 0) + g.size);
    }
    const virt = new Float64Array(n);
    virt[0] = gapMap.get(0) ?? 0;
    for (let i = 1; i < n; i++) {
      virt[i] = virt[i - 1] + 1 + (gapMap.get(i) ?? 0);
    }
    this._virt = virt;
    this._candleTimes = new Float64Array(0);
    this.clamp();
  }

  /**
   * Configure the axis to lay bars out proportionally to their wall-clock
   * time deltas, compressing long session breaks to a fixed gap.
   *
   * @param candleTimes - Per-bar epoch-ms timestamps (length must equal totalCount).
   * @param options     - see {@link TimeProportionalOptions}.
   */
  setTimeProportional(candleTimes: ArrayLike<number>, options: TimeProportionalOptions = {}): void {
    const n = candleTimes.length;
    if (n !== this._totalCount || n === 0) {
      this._virt = new Float64Array(0);
      this._candleTimes = new Float64Array(0);
      this.clamp();
      return;
    }
    const median = options.medianMs ?? TimeScale.computeMedianInterval(candleTimes);
    const sessionThreshold = options.sessionThresholdMs ?? 4 * 60 * 60 * 1000;
    const sessionGapBars = options.sessionGapBars ?? 1.5;

    const times = new Float64Array(n);
    for (let i = 0; i < n; i++) times[i] = candleTimes[i];

    const virt = new Float64Array(n);
    virt[0] = 0;
    for (let i = 1; i < n; i++) {
      const delta = times[i] - times[i - 1];
      let gap: number;
      if (delta > sessionThreshold) {
        gap = sessionGapBars;
      } else if (median > 0 && delta > 0) {
        gap = Math.max(0.001, delta / median);
      } else {
        gap = 1;
      }
      virt[i] = virt[i - 1] + gap;
    }
    this._virt = virt;
    this._candleTimes = times;
    this._cachedMedian = median;
    this.clamp();
  }

  clearGaps(): void {
    if (this._virt.length === 0) return;
    this._virt = new Float64Array(0);
    this._candleTimes = new Float64Array(0);
    this._cachedMedian = 0;
    this.clamp();
  }

  get hasGaps(): boolean {
    return this._virt.length > 0;
  }

  /** True when setTimeProportional has been applied and time-based APIs work. */
  get hasTimeData(): boolean {
    return this._candleTimes.length > 0;
  }

  private static computeMedianInterval(times: ArrayLike<number>): number {
    const n = times.length;
    if (n < 2) return 60_000;
    const deltas: number[] = [];
    const stride = Math.max(1, Math.floor(n / 64));
    for (let i = stride; i < n; i += stride) {
      const d = (times[i] - times[i - stride]) / stride;
      if (d > 0) deltas.push(d);
    }
    if (deltas.length === 0) return 60_000;
    deltas.sort((a, b) => a - b);
    return deltas[Math.floor(deltas.length / 2)];
  }

  /** Virtual position of a (possibly fractional) real index. */
  private virtAt(i: number): number {
    const virt = this._virt;
    if (virt.length === 0) return i;
    const n = virt.length;
    if (i <= 0) return virt[0] + i;
    if (i >= n - 1) return virt[n - 1] + (i - (n - 1));
    const lo = Math.floor(i);
    const frac = i - lo;
    return virt[lo] + (virt[lo + 1] - virt[lo]) * frac;
  }

  /** Inverse of virtAt: map virtual coord back to (possibly fractional) real index. */
  private realAtVirt(v: number): number {
    const virt = this._virt;
    if (virt.length === 0) return v;
    const n = virt.length;
    if (v <= virt[0]) return v - virt[0];
    if (v >= virt[n - 1]) return n - 1 + (v - virt[n - 1]);
    // Binary search for largest i with virt[i] <= v
    let lo = 0;
    let hi = n - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (virt[mid] <= v) lo = mid;
      else hi = mid;
    }
    const span = virt[hi] - virt[lo];
    if (span <= 0) return lo;
    return lo + (v - virt[lo]) / span;
  }

  setWidth(width: number): void {
    this._width = width;
    this.recalcVisibleCount();
  }

  /** Index to center-x pixel position within data area */
  indexToX(index: number): number {
    if (this._virt.length === 0) {
      return (index - this._startIndex + 0.5) * this._barSpacing;
    }
    const vi = this.virtAt(index);
    const vs = this.virtAt(this._startIndex);
    return (vi - vs + 0.5) * this._barSpacing;
  }

  /** X pixel to candle index at that position */
  xToIndex(x: number): number {
    if (this._virt.length === 0) {
      return Math.floor(x / this._barSpacing + this._startIndex);
    }
    const vs = this.virtAt(this._startIndex);
    const vTarget = vs + x / this._barSpacing;
    return Math.floor(this.realAtVirt(vTarget));
  }

  /**
   * Convert a wall-clock time (epoch ms) to an x pixel position.
   * Returns `null` if the time falls inside a compressed session gap
   * (no bar to position against).
   * Only usable after {@link setTimeProportional} has been called.
   */
  timeToX(time: number): number | null {
    const times = this._candleTimes;
    const n = times.length;
    if (n === 0) return null;
    if (time <= times[0]) return this.indexToX(0) + (time - times[0]) * this.pxPerMsAt(0);
    if (time >= times[n - 1])
      return this.indexToX(n - 1) + (time - times[n - 1]) * this.pxPerMsAt(n - 2);

    // Binary search: largest i with times[i] <= time
    let lo = 0;
    let hi = n - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time) lo = mid;
      else hi = mid;
    }
    // Exact bar match — always place at the bar's index position,
    // even if the following segment is a compressed session gap.
    if (times[lo] === time) return this.indexToX(lo);
    if (times[lo + 1] === time) return this.indexToX(lo + 1);

    const dt = times[lo + 1] - times[lo];
    if (dt <= 0) return this.indexToX(lo);
    // Detect compressed gap: much larger spacing than virtual spacing suggests.
    const virtSpan = this._virt[lo + 1] - this._virt[lo];
    if (virtSpan < dt / this.medianMsHeuristic() / 2) {
      return null; // inside a compressed session gap
    }
    const frac = (time - times[lo]) / dt;
    const virtI = this._virt[lo] + frac * virtSpan;
    const vs = this.virtAt(this._startIndex);
    return (virtI - vs + 0.5) * this._barSpacing;
  }

  private pxPerMsAt(segmentStart: number): number {
    const times = this._candleTimes;
    const virt = this._virt;
    if (segmentStart < 0 || segmentStart >= times.length - 1) return 0;
    const dt = times[segmentStart + 1] - times[segmentStart];
    if (dt <= 0) return 0;
    const dv = virt[segmentStart + 1] - virt[segmentStart];
    return (dv / dt) * this._barSpacing;
  }

  private _cachedMedian = 0;
  private medianMsHeuristic(): number {
    if (this._cachedMedian > 0) return this._cachedMedian;
    this._cachedMedian = TimeScale.computeMedianInterval(this._candleTimes);
    return this._cachedMedian;
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
    if (this._virt.length === 0) {
      this._startIndex = Math.max(0, this._totalCount - this._visibleCount);
      return;
    }
    const virtEnd = this._virt[this._virt.length - 1] + 1; // last bar + 1 slot for padding
    const targetVirt = Math.max(0, virtEnd - this._visibleCount);
    this._startIndex = Math.max(0, this.realAtVirt(targetVirt));
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
    if (this._totalCount <= 0) return null;
    const virtTotal =
      this._virt.length > 0 ? this._virt[this._virt.length - 1] + 1 : this._totalCount;
    if (this._visibleCount >= virtTotal) return null;
    const rightPad = Math.ceil(this._visibleCount * 0.2);
    const maxStartVirt = Math.max(0, virtTotal + rightPad - this._visibleCount);
    if (this._virt.length === 0) return maxStartVirt;
    return this.realAtVirt(maxStartVirt);
  }

  /**
   * Get visible time range [t0, t1] if time data is available.
   */
  getVisibleTimeRange(): readonly [number, number] | null {
    if (this._candleTimes.length === 0) return null;
    const n = this._candleTimes.length;
    const start = Math.max(0, Math.min(n - 1, this.startIndex));
    const end = Math.max(0, Math.min(n - 1, this.endIndex - 1));
    if (end < start) return null;
    return [this._candleTimes[start], this._candleTimes[end]];
  }

  /**
   * Generate time ticks at wall-clock regular intervals. Requires prior
   * {@link setTimeProportional}. Tick times falling inside compressed session
   * gaps are skipped. Returns empty array when no time data is available.
   */
  getTimeTicks(stepMs: number): Array<{ time: number; x: number }> {
    if (this._candleTimes.length === 0 || stepMs <= 0) return [];
    const range = this.getVisibleTimeRange();
    if (!range) return [];
    const [t0, t1] = range;
    const out: Array<{ time: number; x: number }> = [];
    const first = Math.ceil(t0 / stepMs) * stepMs;
    for (let t = first; t <= t1; t += stepMs) {
      const x = this.timeToX(t);
      if (x !== null && x >= 0 && x <= this._width) {
        out.push({ time: t, x });
      }
    }
    return out;
  }

  /**
   * Generate date ticks at local-TZ calendar-day boundaries within the
   * visible range. Requires prior {@link setTimeProportional}.
   */
  getDateTicks(): Array<{ time: number; x: number }> {
    if (this._candleTimes.length === 0) return [];
    const times = this._candleTimes;
    const start = Math.max(0, this.startIndex);
    const end = Math.min(times.length - 1, this.endIndex - 1);
    if (end < start) return [];
    const out: Array<{ time: number; x: number }> = [];
    let prevKey = start > 0 ? localDayKey(times[start - 1]) : -1;
    for (let i = start; i <= end; i++) {
      const key = localDayKey(times[i]);
      if (key !== prevKey) {
        out.push({ time: times[i], x: this.indexToX(i) });
        prevKey = key;
      }
    }
    return out;
  }

  /** Median bar interval in ms (0 if time data not available). */
  get medianBarIntervalMs(): number {
    if (this._candleTimes.length === 0) return 0;
    return this.medianMsHeuristic();
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

/** Local-TZ calendar day key (year*10000 + month*100 + date) */
function localDayKey(time: number): number {
  const d = new Date(time);
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
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
  /** Cached log values — recomputed only when _min/_max change */
  private _logMin = 0;
  private _logMax = 0;
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
    this._updateLogCache();
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
      this._updateLogCache();
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
    this._updateLogCache();
  }

  private _updateLogCache(): void {
    if (this._mode === "log") {
      this._logMin = Math.log(Math.max(this._min, 1e-10));
      this._logMax = Math.log(Math.max(this._max, 1e-10));
    }
  }

  /** Price to y pixel (0 = top of pane) */
  priceToY(price: number): number {
    if (this._height <= 0) return 0;

    let normalized: number;
    if (this._mode === "log") {
      const logPrice = Math.log(Math.max(price, 1e-10));
      normalized = (logPrice - this._logMin) / (this._logMax - this._logMin || 1);
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
      return Math.exp(this._logMin + normalized * (this._logMax - this._logMin));
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
