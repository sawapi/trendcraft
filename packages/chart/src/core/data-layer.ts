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
  private _dirty = true;
  private _onChange: (() => void) | null = null;
  private _onPaneEmpty: ((paneId: string) => void) | null = null;

  /** Register a callback for data changes */
  setOnChange(cb: () => void): void {
    this._onChange = cb;
  }

  /** Register a callback when a pane has no more visible series */
  setOnPaneEmpty(cb: (paneId: string) => void): void {
    this._onPaneEmpty = cb;
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
    return [...this._series.values()].filter((s) => s.visible);
  }

  getAllSeries(): InternalSeries[] {
    return [...this._series.values()];
  }

  /** Get all series assigned to a specific pane */
  getSeriesForPane(paneId: string): InternalSeries[] {
    return [...this._series.values()].filter((s) => s.visible && s.paneId === paneId);
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
  type: SeriesType;
  config: SeriesConfig;
  data: DataPoint<unknown>[];
  visible: boolean;
};
