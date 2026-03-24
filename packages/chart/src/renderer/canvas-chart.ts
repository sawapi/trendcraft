/**
 * CanvasChart — The main chart class and public entry point.
 * Orchestrates data layer, layout, scales, viewport, and rendering.
 */

import { DataLayer, type InternalSeries } from "../core/data-layer";
import { decimateCandles, getDecimationTarget } from "../core/decimation";
import { autoFormatPrice } from "../core/format";
import { LayoutEngine } from "../core/layout";
import { PriceScale, TimeScale } from "../core/scale";
import type {
  CandleData,
  ChartEvent,
  ChartInstance,
  ChartOptions,
  DataPoint,
  Drawing,
  DrawingType,
  LayoutConfig,
  PaneConfig,
  PaneRect,
  SeriesConfig,
  SeriesHandle,
  SignalMarker,
  ThemeColors,
  TimeValue,
  TradeMarker,
} from "../core/types";
import { DARK_THEME, LIGHT_THEME } from "../core/types";
import { Viewport } from "../core/viewport";
import { introspect } from "../integration/series-introspector";
import { renderCandlesticks } from "../series/candlestick";
import { renderVolume } from "../series/histogram";
import { renderGrid, renderPriceAxis, renderReferenceLines, renderTimeAxis } from "./axis-renderer";
import { renderCrosshair } from "./crosshair-renderer";
import { renderDrawings } from "./drawing-renderer";
import { InfoOverlay } from "./info-overlay";
import { LegendOverlay } from "./legend-overlay";
import { renderPriceLine, renderSignals, renderTrades } from "./overlay-renderer";
import { computePaneRange } from "./range-calculator";
import { renderScrollbar } from "./scrollbar-renderer";
import { dispatchSeries } from "./series-dispatcher";

// ============================================
// Default Options
// ============================================

const DEFAULT_OPTIONS: Required<
  Pick<ChartOptions, "height" | "priceAxisWidth" | "timeAxisHeight" | "fontSize">
> = {
  height: 400,
  priceAxisWidth: 60,
  timeAxisHeight: 24,
  fontSize: 11,
};

// ============================================
// CanvasChart Class
// ============================================

export class CanvasChart implements ChartInstance {
  private _container: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _pixelRatio: number;
  private _theme: ThemeColors;
  private _fontSize: number;
  private _priceFormatter: (price: number) => string;
  private _timeFormatter: ((time: number) => string) | undefined;

  private _data = new DataLayer();
  private _layout = new LayoutEngine();
  private _timeScale = new TimeScale();
  private _viewport = new Viewport();
  private _priceScales = new Map<string, PriceScale>();
  private _infoOverlay: InfoOverlay | null = null;
  private _legendOverlay: LegendOverlay | null = null;
  private _watermark: string | undefined;
  private _activeDrawingTool: DrawingType | null = null;
  private _drawingInProgress: { startTime: number; startPrice: number } | null = null;

  private _rafId: number | null = null;
  private _needsRender = true;
  private _detachViewport: (() => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  // Event listeners
  private _listeners = new Map<ChartEvent, Set<(data: unknown) => void>>();

  private _emit(event: ChartEvent, data: unknown): void {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }

  // Auto-generated pane counter
  private _autoSubchartId = 0;

  constructor(container: HTMLElement, options?: ChartOptions) {
    this._container = container;
    this._fontSize = options?.fontSize ?? DEFAULT_OPTIONS.fontSize;
    this._priceFormatter = options?.priceFormatter ?? autoFormatPrice;
    this._timeFormatter = options?.timeFormatter;
    this._pixelRatio =
      options?.pixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1);

    // Resolve theme
    if (typeof options?.theme === "object") {
      this._theme = options.theme;
    } else {
      this._theme = options?.theme === "light" ? LIGHT_THEME : DARK_THEME;
    }

    // Create canvas
    this._canvas = document.createElement("canvas");
    this._canvas.style.display = "block";
    this._canvas.style.width = "100%";
    this._canvas.style.height = "100%";
    this._canvas.style.cursor = "crosshair";
    container.appendChild(this._canvas);

    const ctx = this._canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this._ctx = ctx;

    // Initial sizing
    const width = options?.width ?? container.clientWidth;
    const height = options?.height ?? DEFAULT_OPTIONS.height;
    this._setSize(
      width,
      height,
      options?.priceAxisWidth ?? DEFAULT_OPTIONS.priceAxisWidth,
      options?.timeAxisHeight ?? DEFAULT_OPTIONS.timeAxisHeight,
    );

    // Data change listener
    this._data.setOnChange(() => {
      this._needsRender = true;
    });

    // Auto-remove empty panes when last series is removed
    this._data.setOnPaneEmpty((paneId) => {
      if (this._layout.removePane(paneId)) {
        this._priceScales.delete(paneId);
        this._needsRender = true;
      }
    });

    // Viewport interaction
    this._viewport.setOnUpdate(() => {
      this._needsRender = true;
    });
    this._detachViewport = this._viewport.attach(
      this._canvas,
      this._timeScale,
      () => this._layout.paneRects as PaneRect[],
      () =>
        this._layout.scrollbarHeight > 0
          ? {
              x: 0,
              y: this._layout.scrollbarY,
              width: this._layout.dataAreaWidth,
              height: this._layout.scrollbarHeight,
            }
          : null,
    );

    // Auto-resize
    if (typeof ResizeObserver !== "undefined" && !options?.width) {
      this._resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this._setSize(width, height);
            this._needsRender = true;
          }
        }
      });
      this._resizeObserver.observe(container);
    }

    // Info overlay (DOM-based OHLCV + indicator values)
    this._infoOverlay = new InfoOverlay(container, this._theme);

    // Legend overlay
    if (options?.legend !== false) {
      this._legendOverlay = new LegendOverlay(container, this._theme);
      this._legendOverlay.setOnToggle((seriesId, visible) => {
        const series = this._data.getAllSeries().find((s) => s.id === seriesId);
        if (series) {
          series.visible = visible;
          this._needsRender = true;
        }
      });
    }

    // Watermark
    this._watermark = options?.watermark;

    // Start render loop
    this._renderLoop();
  }

  // ---- Public API: Data ----

  setCandles(candles: CandleData[]): void {
    if (!Array.isArray(candles)) return;
    // Filter invalid candles (NaN, missing fields)
    const valid = candles.filter(
      (c) =>
        c &&
        typeof c.time === "number" &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close) &&
        Number.isFinite(c.volume),
    );
    this._data.setCandles(valid);
    this._timeScale.setTotalCount(this._data.candleCount);
    this._timeScale.scrollToEnd();
    this._needsRender = true;
  }

  updateCandle(candle: CandleData): void {
    if (
      !candle ||
      typeof candle.time !== "number" ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.close)
    )
      return;
    this._data.updateCandle(candle);
    this._timeScale.setTotalCount(this._data.candleCount);
    this._needsRender = true;
  }

  // ---- Public API: Indicators ----

  addIndicator<T>(series: DataPoint<T>[], config?: SeriesConfig): SeriesHandle {
    if (!Array.isArray(series)) {
      // Return a no-op handle for invalid input
      return {
        id: "",
        update: () => {},
        setData: () => {},
        setVisible: () => {},
        remove: () => {},
      };
    }

    // Introspect the series
    const result = introspect(series, config);

    // Resolve pane
    let paneId = result.pane;
    if (paneId === "sub") {
      // Auto-generate a new subchart pane
      paneId = `sub_${this._autoSubchartId++}`;
      const paneConfig: PaneConfig = {
        id: paneId,
        flex: 1,
        yRange: result.yRange,
        referenceLines: result.referenceLines,
      };
      this._layout.addPane(paneConfig);
    } else if (paneId !== "main" && !this._layout.hasPane(paneId)) {
      this._layout.addPane({
        id: paneId,
        flex: 1,
        yRange: result.yRange,
        referenceLines: result.referenceLines,
      });
    }

    // Align series data to candle indices for efficient rendering
    const aligned = this._alignToCandles(series);

    const handle = this._data.addSeries(
      aligned,
      { ...result.config, pane: paneId },
      result.seriesType,
    );
    this._needsRender = true;
    this._emit("seriesAdded", { id: handle.id, label: result.config.label });
    this._legendOverlay?.update(this._data.getAllSeries());
    return handle;
  }

  // ---- Public API: Signals & Trades ----

  addSignals(signals: SignalMarker[]): void {
    this._data.setSignals(signals);
    this._needsRender = true;
  }

  addTrades(trades: TradeMarker[]): void {
    this._data.setTrades(trades);
    this._needsRender = true;
  }

  // ---- Public API: Drawings ----

  addDrawing(drawing: Drawing): void {
    this._data.addDrawing(drawing);
    this._needsRender = true;
  }

  removeDrawing(id: string): void {
    this._data.removeDrawing(id);
    this._needsRender = true;
  }

  getDrawings(): Drawing[] {
    return this._data.getDrawings();
  }

  setDrawingTool(tool: DrawingType | null): void {
    this._activeDrawingTool = tool;
    this._drawingInProgress = null;
    this._canvas.style.cursor = tool ? "crosshair" : "crosshair";
  }

  // ---- Public API: Layout ----

  setLayout(layout: LayoutConfig): void {
    this._layout.setLayout(layout);
    this._needsRender = true;
  }

  // ---- Public API: Viewport ----

  setVisibleRange(start: TimeValue, end: TimeValue): void {
    const startIdx = this._data.indexAtTime(start);
    const endIdx = this._data.indexAtTime(end);
    this._timeScale.setVisibleRange(startIdx, endIdx);
    this._needsRender = true;
  }

  fitContent(): void {
    this._timeScale.fitContent();
    this._needsRender = true;
  }

  // ---- Public API: Events ----

  on<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(handler);
  }

  off<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void {
    this._listeners.get(event)?.delete(handler);
  }

  // ---- Public API: Theme ----

  setTheme(theme: "dark" | "light" | ThemeColors): void {
    if (typeof theme === "object") {
      this._theme = theme;
    } else {
      this._theme = theme === "light" ? LIGHT_THEME : DARK_THEME;
    }
    this._infoOverlay?.setTheme(this._theme);
    this._needsRender = true;
  }

  // ---- Public API: Series Query ----

  getAllSeries(): import("../core/types").SeriesInfo[] {
    return this._data.getAllSeries().map((s) => ({
      id: s.id,
      paneId: s.paneId,
      type: s.type,
      label: s.config.label ?? "",
      visible: s.visible,
    }));
  }

  getVisibleRange(): import("../core/types").VisibleRangeChangeData | null {
    const candles = this._data.candles;
    if (candles.length === 0) return null;
    const startIdx = this._timeScale.startIndex;
    const endIdx = Math.min(this._timeScale.endIndex, candles.length - 1);
    return {
      startTime: candles[Math.max(0, startIdx)]?.time ?? 0,
      endTime: candles[endIdx]?.time ?? 0,
      startIndex: startIdx,
      endIndex: endIdx,
    };
  }

  // ---- Public API: Export ----

  async toImage(type = "image/png", quality = 1): Promise<Blob> {
    // Force a synchronous render
    this._render();
    return new Promise((resolve, reject) => {
      this._canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to export chart image"));
        },
        type,
        quality,
      );
    });
  }

  // ---- Public API: Lifecycle ----

  resize(width: number, height: number): void {
    this._setSize(width, height);
    this._needsRender = true;
  }

  destroy(): void {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._detachViewport?.();
    this._resizeObserver?.disconnect();
    this._infoOverlay?.destroy();
    this._legendOverlay?.destroy();
    this._canvas.remove();
  }

  // ---- Internal: Sizing ----

  private _setSize(
    width: number,
    height: number,
    priceAxisWidth?: number,
    timeAxisHeight?: number,
  ): void {
    const pr = this._pixelRatio;
    this._canvas.width = width * pr;
    this._canvas.height = height * pr;
    this._canvas.style.width = `${width}px`;
    this._canvas.style.height = `${height}px`;
    this._ctx.scale(pr, pr);

    this._layout.setDimensions(width, height, priceAxisWidth, timeAxisHeight);
    this._timeScale.setWidth(this._layout.dataAreaWidth);
  }

  // ---- Internal: Align series to candle indices ----

  private _alignToCandles<T>(series: DataPoint<T>[]): DataPoint<T>[] {
    const candles = this._data.candles;
    if (candles.length === 0 || series.length === 0) return series;

    // Build time → index map for candles
    const timeToIndex = new Map<number, number>();
    for (let i = 0; i < candles.length; i++) {
      timeToIndex.set(candles[i].time, i);
    }

    // Create aligned array (same length as candles, null-padded)
    const aligned: DataPoint<T>[] = new Array(candles.length);
    for (let i = 0; i < candles.length; i++) {
      aligned[i] = { time: candles[i].time, value: null as unknown as T };
    }

    for (const point of series) {
      const idx = timeToIndex.get(point.time);
      if (idx !== undefined) {
        aligned[idx] = point;
      }
    }

    return aligned;
  }

  // ---- Internal: Render Loop ----

  private _renderLoop = (): void => {
    if (this._needsRender) {
      this._needsRender = false;
      this._render();
    }
    this._rafId = requestAnimationFrame(this._renderLoop);
  };

  private _render(): void {
    const ctx = this._ctx;
    const pr = this._pixelRatio;
    const width = this._canvas.width / pr;
    const height = this._canvas.height / pr;

    // Reset transform for clearing
    ctx.setTransform(pr, 0, 0, pr, 0, 0);

    // Clear
    ctx.fillStyle = this._theme.background;
    ctx.fillRect(0, 0, width, height);

    // Watermark
    if (this._watermark) {
      ctx.save();
      ctx.fillStyle = this._theme.textSecondary;
      ctx.globalAlpha = 0.07;
      ctx.font = `bold ${Math.min(width * 0.08, 48)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this._watermark, width / 2, height / 2);
      ctx.restore();
    }

    const paneRects = this._layout.paneRects;
    const candles = this._data.candles;
    const timeScale = this._timeScale;
    const visibleStart = timeScale.startIndex;
    const visibleEnd = timeScale.endIndex;

    // Ensure price scales exist for each pane
    for (const pane of paneRects) {
      if (!this._priceScales.has(pane.id)) {
        this._priceScales.set(pane.id, new PriceScale());
      }
    }

    // Update price scales with visible data ranges
    for (const pane of paneRects) {
      const ps = this._priceScales.get(pane.id);
      if (!ps) continue;
      ps.setHeight(pane.height);
      if (pane.config.yScale) ps.setMode(pane.config.yScale);
      if (pane.config.yRange) ps.setFixedRange(pane.config.yRange);

      const paneSeries = this._data.getSeriesForPane(pane.id);
      const [min, max] = computePaneRange(pane, visibleStart, visibleEnd, candles, paneSeries);
      ps.setDataRange(min, max);
    }

    // Render each pane
    for (const pane of paneRects) {
      const ps = this._priceScales.get(pane.id);
      if (!ps) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(pane.x, pane.y, pane.width, pane.height);
      ctx.clip();

      // Grid
      renderGrid(ctx, ps, pane.x, pane.y, pane.width, pane.height, this._theme, timeScale, candles);

      // Reference lines
      if (pane.config.referenceLines?.length) {
        renderReferenceLines(
          ctx,
          pane.config.referenceLines,
          ps,
          pane.x,
          pane.y,
          pane.width,
          pane.config.referenceLineColor ?? this._theme.textSecondary,
        );
      }

      // Translate so series renderers use y=0 as pane top
      ctx.translate(0, pane.y);

      // Render pane content
      if (pane.id === "main") {
        const decimTarget = getDecimationTarget(
          timeScale.endIndex - timeScale.startIndex,
          timeScale.width,
        );
        const visibleCandles =
          decimTarget > 0
            ? decimateCandles(candles, timeScale.startIndex, timeScale.endIndex, decimTarget)
            : candles;
        renderCandlesticks(ctx, visibleCandles, timeScale, ps, this._theme);
      }

      if (pane.id === "volume") {
        renderVolume(ctx, candles, timeScale, ps, this._theme);
      }

      // Render indicator series for this pane
      const paneSeriesForRender = this._data.getSeriesForPane(pane.id);
      for (const s of paneSeriesForRender) {
        dispatchSeries(ctx, s, timeScale, ps);
      }

      ctx.restore();

      // Price axis
      renderPriceAxis(
        ctx,
        ps,
        pane.x + pane.width,
        pane.y,
        this._layout.priceAxisWidth,
        pane.height,
        this._theme,
        this._fontSize,
        this._priceFormatter,
      );
    }

    // Time axis
    renderTimeAxis(
      ctx,
      candles,
      timeScale,
      0,
      this._layout.timeAxisY,
      this._layout.dataAreaWidth,
      this._layout.timeAxisHeight,
      this._theme,
      this._fontSize,
      this._timeFormatter,
    );

    // Pane titles
    for (const pane of paneRects) {
      if (pane.id === "main") continue;
      const paneSeries = this._data.getSeriesForPane(pane.id);
      const title =
        pane.id === "volume"
          ? "Volume"
          : paneSeries
              .map((s) => s.config.label ?? "")
              .filter(Boolean)
              .join(", ");
      if (title) {
        ctx.fillStyle = this._theme.textSecondary;
        ctx.font = `${this._fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(title, 4, pane.y + 4);
      }
    }

    // Scrollbar
    if (this._layout.scrollbarHeight > 0) {
      renderScrollbar(
        ctx,
        timeScale,
        0,
        this._layout.scrollbarY,
        this._layout.dataAreaWidth,
        this._layout.scrollbarHeight,
        this._theme,
      );
    }

    // Drawings (under overlays)
    renderDrawings(
      ctx,
      this._data.drawings,
      paneRects,
      this._priceScales,
      timeScale,
      this._data,
      this._theme,
      this._fontSize,
    );

    // Overlays: price line, signals, trades
    renderPriceLine(ctx, candles, paneRects, this._priceScales, this._theme, this._fontSize);
    renderSignals(
      ctx,
      this._data.signals,
      candles,
      this._data,
      paneRects,
      this._priceScales,
      timeScale,
    );
    renderTrades(ctx, this._data.trades, this._data, paneRects, this._priceScales, timeScale);

    // Crosshair (on top of everything)
    renderCrosshair(
      ctx,
      this._viewport.state,
      paneRects,
      this._priceScales,
      timeScale,
      this._layout.dataAreaWidth,
      this._layout.timeAxisY,
      this._theme,
      this._fontSize,
      candles,
    );

    // Info overlay (DOM) — update with crosshair position
    const seriesByPane = new Map<string, InternalSeries[]>();
    for (const pane of paneRects) {
      seriesByPane.set(pane.id, this._data.getSeriesForPane(pane.id));
    }
    this._infoOverlay?.update(
      this._viewport.state.crosshairIndex,
      candles,
      paneRects,
      seriesByPane,
    );

    // Legend
    this._legendOverlay?.update(this._data.getAllSeries());

    // Emit crosshair event
    if (this._viewport.state.crosshairIndex !== null) {
      const idx = this._viewport.state.crosshairIndex;
      const candle = candles[idx];
      if (candle) {
        this._emit("crosshairMove", {
          time: candle.time,
          index: idx,
          ohlcv: {
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          },
          paneId: this._viewport.state.activePaneId,
        });
      }
    }
  }
}
