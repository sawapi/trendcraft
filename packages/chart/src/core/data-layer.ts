/**
 * DataLayer — Central time-series data store for the chart.
 * Manages candles, indicator series, signals, and trades.
 */

import type {
  CandleData,
  DataPoint,
  Drawing,
  ResolvedSeries,
  SeriesConfig,
  SeriesHandle,
  SeriesType,
  SignalMarker,
  TimeframeOverlay,
  TradeMarker,
} from "./types";

export class DataLayer {
  private _nextSeriesId = 1;
  private _candles: CandleData[] = [];
  private _series: Map<string, InternalSeries> = new Map();
  private _signals: SignalMarker[] = [];
  private _trades: TradeMarker[] = [];
  private _drawings: Map<string, Drawing> = new Map();
  private _timeframes: Map<string, TimeframeOverlay> = new Map();
  private _backtestResult: import("./types").BacktestResultData | null = null;
  private _patterns: import("./types").ChartPatternSignal[] = [];
  private _scores: DataPoint<number | null>[] = [];
  private _timeToIndex = new Map<number, number>();
  private _dirty = true;
  private _onChange: (() => void) | null = null;
  private _onPaneEmpty: ((paneId: string) => void) | null = null;
  private _onWarn: ((message: string) => void) | null = null;

  /** Register a callback for data changes */
  setOnChange(cb: () => void): void {
    this._onChange = cb;
  }

  /** Register a callback when a pane has no more visible series */
  setOnPaneEmpty(cb: (paneId: string) => void): void {
    this._onPaneEmpty = cb;
  }

  /** Register a callback for diagnostic warnings (e.g. duplicate timestamps) */
  setOnWarn(cb: (message: string) => void): void {
    this._onWarn = cb;
  }

  private markDirty(): void {
    this._dirty = true;
    this._onChange?.();
  }

  private checkPaneEmpty(paneId: string): void {
    const hasVisibleSeries = [...this._series.values()].some(
      (s) => s.paneId === paneId && s.visible,
    );
    if (!hasVisibleSeries) {
      this._onPaneEmpty?.(paneId);
    }
  }

  get dirty(): boolean {
    return this._dirty;
  }

  clearDirty(): void {
    this._dirty = false;
  }

  // ---- Candles ----

  get candles(): readonly CandleData[] {
    return this._candles;
  }

  get candleCount(): number {
    return this._candles.length;
  }

  setCandles(candles: CandleData[]): void {
    const copy = candles.slice();
    // Only sort if not already sorted (O(n) check vs O(n log n) sort)
    if (!isSorted(copy)) {
      copy.sort((a, b) => a.time - b.time);
    }
    this._candles = copy;
    this._rebuildTimeIndex();
    this.markDirty();
  }

  updateCandle(candle: CandleData): void {
    const len = this._candles.length;
    if (len > 0 && this._candles[len - 1].time === candle.time) {
      // Update last candle in place
      this._candles[len - 1] = candle;
    } else {
      // Append new candle
      this._candles.push(candle);
      this._timeToIndex.set(candle.time, this._candles.length - 1);
    }
    this.markDirty();
  }

  /** Get time value by candle index */
  timeAt(index: number): number | undefined {
    return this._candles[index]?.time;
  }

  /** Binary search for candle index by time */
  indexAtTime(time: number): number {
    const candles = this._candles;
    let lo = 0;
    let hi = candles.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (candles[mid].time < time) lo = mid + 1;
      else if (candles[mid].time > time) hi = mid - 1;
      else return mid;
    }
    return lo;
  }

  // ---- Indicator Series ----

  addSeries<T>(data: DataPoint<T>[], config: SeriesConfig, resolvedType: SeriesType): SeriesHandle {
    const id = `s${this._nextSeriesId++}`;
    const internal: InternalSeries = {
      id,
      paneId: config.pane ?? "main",
      scaleId: config.scaleId ?? "right",
      type: resolvedType,
      config: { ...config },
      data: data as DataPoint<unknown>[],
      visible: config.visible !== false,
    };
    this._series.set(id, internal);
    this.markDirty();

    const handle: SeriesHandle = {
      id,
      update: (point: DataPoint) => {
        const s = this._series.get(id);
        if (!s) return;
        const arr = s.data;
        if (arr.length > 0 && arr[arr.length - 1].time === point.time) {
          arr[arr.length - 1] = point;
        } else {
          arr.push(point);
        }
        this.markDirty();
      },
      setData: <U>(newData: DataPoint<U>[]) => {
        const s = this._series.get(id);
        if (!s) return;
        s.data = newData as DataPoint<unknown>[];
        this.markDirty();
      },
      setVisible: (v: boolean) => {
        const s = this._series.get(id);
        if (!s) return;
        s.visible = v;
        this.markDirty();
      },
      remove: () => {
        const s = this._series.get(id);
        const paneId = s?.paneId;
        this._series.delete(id);
        this.markDirty();
        if (paneId) this.checkPaneEmpty(paneId);
      },
    };
    return handle;
  }

  getVisibleSeries(): InternalSeries[] {
    const result: InternalSeries[] = [];
    for (const s of this._series.values()) {
      if (s.visible) result.push(s);
    }
    return result;
  }

  getAllSeries(): InternalSeries[] {
    return [...this._series.values()];
  }

  /** Get all series assigned to a specific pane */
  getSeriesForPane(paneId: string): InternalSeries[] {
    const result: InternalSeries[] = [];
    for (const s of this._series.values()) {
      if (s.visible && s.paneId === paneId) result.push(s);
    }
    return result;
  }

  /** Get series assigned to a specific pane and scale */
  getSeriesForScale(paneId: string, scaleId: "left" | "right"): InternalSeries[] {
    const result: InternalSeries[] = [];
    for (const s of this._series.values()) {
      if (s.visible && s.paneId === paneId && s.scaleId === scaleId) result.push(s);
    }
    return result;
  }

  /** Check if a pane has any series on a given scale */
  hasSeriesOnScale(paneId: string, scaleId: "left" | "right"): boolean {
    for (const s of this._series.values()) {
      if (s.visible && s.paneId === paneId && s.scaleId === scaleId) return true;
    }
    return false;
  }

  // ---- Signals ----

  get signals(): readonly SignalMarker[] {
    return this._signals;
  }

  setSignals(signals: SignalMarker[]): void {
    this._signals = signals;
    this.markDirty();
  }

  // ---- Trades ----

  get trades(): readonly TradeMarker[] {
    return this._trades;
  }

  setTrades(trades: TradeMarker[]): void {
    this._trades = trades;
    this.markDirty();
  }

  // ---- Drawings ----

  get drawings(): readonly Drawing[] {
    return [...this._drawings.values()];
  }

  addDrawing(drawing: Drawing): void {
    this._drawings.set(drawing.id, drawing);
    this.markDirty();
  }

  removeDrawing(id: string): void {
    this._drawings.delete(id);
    this.markDirty();
  }

  getDrawings(): Drawing[] {
    return [...this._drawings.values()];
  }

  // ---- Timeframe Overlays ----

  get timeframes(): readonly TimeframeOverlay[] {
    return [...this._timeframes.values()];
  }

  addTimeframe(overlay: TimeframeOverlay): void {
    this._timeframes.set(overlay.id, overlay);
    this.markDirty();
  }

  removeTimeframe(id: string): void {
    this._timeframes.delete(id);
    this.markDirty();
  }

  // ---- Backtest Result ----

  get backtestResult(): import("./types").BacktestResultData | null {
    return this._backtestResult;
  }

  setBacktestResult(result: import("./types").BacktestResultData): void {
    this._backtestResult = result;
    this.markDirty();
  }

  // ---- Patterns ----

  get patterns(): readonly import("./types").ChartPatternSignal[] {
    return this._patterns;
  }

  setPatterns(patterns: import("./types").ChartPatternSignal[]): void {
    this._patterns = patterns;
    this.markDirty();
  }

  // ---- Scores ----

  get scores(): readonly DataPoint<number | null>[] {
    return this._scores;
  }

  setScores(scores: DataPoint<number | null>[]): void {
    this._scores = scores;
    this.markDirty();
  }
  // ---- Time Index ----

  private _rebuildTimeIndex(): void {
    this._timeToIndex.clear();
    const candles = this._candles;
    for (let i = 0; i < candles.length; i++) {
      const time = candles[i].time;
      if (this._timeToIndex.has(time)) {
        this._onWarn?.(
          `Duplicate timestamp ${time} at index ${i} (overwrites index ${this._timeToIndex.get(time)})`,
        );
      }
      this._timeToIndex.set(time, i);
    }
  }

  /** Align indicator series to candle indices (null-padded to candle length) */
  alignToCandles<T>(series: DataPoint<T>[]): DataPoint<T | null>[] {
    const candles = this._candles;
    if (candles.length === 0 || series.length === 0) return series;

    const aligned: DataPoint<T | null>[] = new Array(candles.length);
    for (let i = 0; i < candles.length; i++) {
      aligned[i] = { time: candles[i].time, value: null };
    }

    for (const point of series) {
      const idx = this._timeToIndex.get(point.time);
      if (idx !== undefined) {
        aligned[idx] = point;
      }
    }

    return aligned;
  }
}

function isSorted(candles: CandleData[]): boolean {
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].time < candles[i - 1].time) return false;
  }
  return true;
}

/** Internal series representation */
export type InternalSeries = {
  id: string;
  paneId: string;
  /** Scale assignment: 'right' (default) or 'left' for dual-scale panes */
  scaleId: "left" | "right";
  type: SeriesType;
  config: SeriesConfig;
  data: DataPoint<unknown>[];
  visible: boolean;
};
