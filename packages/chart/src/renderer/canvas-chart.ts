/**
 * CanvasChart — The main chart class and public entry point.
 * Orchestrates data layer, layout, scales, viewport, and rendering.
 */

import { ViewTransition } from "../core/animation";
import { DataLayer } from "../core/data-layer";
import type { DrawHelper } from "../core/draw-helper";
import { autoFormatPrice, setMonthNames } from "../core/format";
import { type ChartLocale, mergeLocale } from "../core/i18n";
import { DEFAULT_LAYOUT, DEFAULT_LAYOUT_NO_VOLUME, LayoutEngine } from "../core/layout";
import type { PrimitivePlugin, SeriesRendererPlugin } from "../core/plugin-types";
import { type PointerInfo, onTap } from "../core/pointer";
import { RendererRegistry } from "../core/renderer-registry";
import { type PriceScale, TimeScale } from "../core/scale";
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
  TimeframeOverlay,
  TradeMarker,
} from "../core/types";
import { DARK_THEME, LIGHT_THEME } from "../core/types";
import { Viewport } from "../core/viewport";
import { introspect } from "../integration/series-introspector";
import { InfoOverlay } from "./info-overlay";
import { LegendOverlay } from "./legend-overlay";
import { renderFrame } from "./render-pipeline";

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
  private _priceScales = new Map<string, { left: PriceScale; right: PriceScale }>();
  private _infoOverlay: InfoOverlay | null = null;
  private _legendOverlay: LegendOverlay | null = null;
  private _watermark: string | undefined;
  private _chartType: import("../core/types").ChartType;
  private _activeDrawingTool: DrawingType | null = null;
  private _drawingInProgress: { startTime: number; startPrice: number } | null = null;
  private _drawingIdCounter = 0;
  private _detachDrawTap: (() => void) | null = null;

  private _rendererRegistry = new RendererRegistry();
  private _drawHelper: DrawHelper | null = null;
  private _timeToIndex: Map<number, number> = new Map();

  private _rafId: number | null = null;
  private _needsRender = true;
  private _batching = false;
  private _batchScrollToEnd = false;
  private _detachViewport: (() => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _ariaLiveEl: HTMLElement | null = null;
  private _ariaLiveTimer: ReturnType<typeof setTimeout> | null = null;
  private _transition = new ViewTransition();
  private _animationDuration: number;
  private _locale: ChartLocale;

  // Event listeners
  private _listeners = new Map<ChartEvent, Set<(data: unknown) => void>>();

  private _emit(event: ChartEvent, data: unknown): void {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }

  /** Emit a warning via console and the 'error' event */
  private _warn(message: string, detail?: unknown): void {
    const payload = { message, detail };
    if (typeof console !== "undefined") {
      console.warn(`[@trendcraft/chart] ${message}`, detail ?? "");
    }
    this._emit("error", payload);
  }

  // Auto-generated pane counter
  private _autoSubchartId = 0;

  constructor(container: HTMLElement, options?: ChartOptions) {
    if (typeof document === "undefined") {
      throw new Error(
        "@trendcraft/chart: CanvasChart requires a browser environment (document is not defined). " +
          "Use @trendcraft/chart/headless for server-side usage.",
      );
    }

    this._container = container;
    this._fontSize = options?.fontSize ?? DEFAULT_OPTIONS.fontSize;
    this._priceFormatter = options?.priceFormatter ?? autoFormatPrice;
    this._timeFormatter = options?.timeFormatter;
    this._animationDuration = options?.animationDuration ?? 300;
    this._locale = mergeLocale(options?.locale);
    setMonthNames(this._locale.months);
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
    this._canvas.style.touchAction = "none";
    this._canvas.style.userSelect = "none";

    // Accessibility
    this._canvas.setAttribute("role", "application");
    this._canvas.setAttribute("aria-roledescription", this._locale.chartDescription);
    this._canvas.setAttribute("tabindex", "0");
    this._canvas.setAttribute("aria-description", this._locale.keyboardShortcuts);
    this._updateAriaLabel();

    // Visually-hidden live region for screen reader announcements
    this._ariaLiveEl = document.createElement("div");
    this._ariaLiveEl.setAttribute("role", "status");
    this._ariaLiveEl.setAttribute("aria-live", "polite");
    this._ariaLiveEl.setAttribute("aria-atomic", "true");
    Object.assign(this._ariaLiveEl.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0,0,0,0)",
      whiteSpace: "nowrap",
      border: "0",
    });

    container.style.position = "relative";

    container.appendChild(this._canvas);
    container.appendChild(this._ariaLiveEl);

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
      this._transition.cancel(); // User interaction cancels animation
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
      (y) => this._layout.gapAtY(y),
      (gapIdx, delta) => {
        this._layout.resizePanes(gapIdx, delta);
        this._needsRender = true;
      },
      options?.scrollSensitivity,
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
    this._infoOverlay = new InfoOverlay(
      container,
      this._theme,
      this._priceFormatter,
      options?.formatInfoOverlay,
      this._locale,
    );
    this._infoOverlay.setRendererRegistry(this._rendererRegistry);

    // Legend overlay
    if (options?.legend !== false) {
      this._legendOverlay = new LegendOverlay(container, this._theme, this._locale);
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
    this._chartType = options?.chartType ?? "candlestick";

    // Volume pane visibility
    if (options?.volume === false) {
      this._layout.setLayout(DEFAULT_LAYOUT_NO_VOLUME);
    }

    // Interactive drawing: unified mouse + touch tap handler
    this._detachDrawTap = onTap(this._canvas, this._handleDrawTap);

    // Start render loop
    this._renderLoop();
  }

  // ---- Public API: Data ----

  setCandles(candles: CandleData[]): void {
    if (!Array.isArray(candles)) {
      this._warn("setCandles: expected an array", typeof candles);
      return;
    }
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
    const removed = candles.length - valid.length;
    this._data.setCandles(valid);
    this._rebuildTimeIndex();
    this._timeScale.setTotalCount(this._data.candleCount);
    this._timeScale.scrollToEnd();
    this._needsRender = true;
    if (removed > 0) {
      this._emit("dataFiltered", { total: candles.length, valid: valid.length, removed });
    }
    this._updateAriaLabel();
  }

  updateCandle(candle: CandleData): void {
    if (
      !candle ||
      typeof candle.time !== "number" ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.close)
    ) {
      this._warn("updateCandle: invalid candle data ignored", candle);
      return;
    }
    // Auto-follow: if last candle is visible before update, keep following
    const wasAtEnd = this._timeScale.endIndex >= this._data.candleCount - 1;

    const prevCount = this._data.candleCount;
    this._data.updateCandle(candle);

    // Keep time→index map in sync for addIndicator alignment
    if (this._data.candleCount > prevCount) {
      this._timeToIndex.set(candle.time, this._data.candleCount - 1);
    }

    this._timeScale.setTotalCount(this._data.candleCount);

    if (wasAtEnd) {
      if (this._batching) {
        this._batchScrollToEnd = true;
      } else {
        this._timeScale.scrollToEnd();
      }
    }
    this._needsRender = true;
  }

  batchUpdates(fn: () => void): void {
    this._batching = true;
    this._batchScrollToEnd = false;
    try {
      fn();
    } finally {
      this._batching = false;
      if (this._batchScrollToEnd) {
        this._timeScale.scrollToEnd();
      }
      this._needsRender = true;
    }
  }

  // ---- Public API: Indicators ----

  addIndicator<T>(series: DataPoint<T>[], config?: SeriesConfig): SeriesHandle {
    if (!Array.isArray(series)) {
      this._warn("addIndicator: expected an array", typeof series);
      return {
        id: "",
        update: () => {},
        setData: () => {},
        setVisible: () => {},
        remove: () => {},
      };
    }
    if (series.length === 0) {
      this._warn("addIndicator: empty series array — indicator will not be visible");
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
    this._updateAriaLabel();
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
    this._canvas.style.cursor = tool ? "cell" : "crosshair";
    this._needsRender = true;
  }

  // ---- Interactive Drawing ----

  private _handleDrawTap = (pos: PointerInfo): void => {
    if (!this._activeDrawingTool) return;

    // Convert pixel to time/price
    const idx = this._timeScale.xToIndex(pos.x);
    const candle = this._data.candles[idx];
    if (!candle) return;
    const time = candle.time;

    const mainPane = this._layout.paneRects.find((p) => p.id === "main");
    if (!mainPane) return;
    const scales = this._priceScales.get("main");
    if (!scales) return;
    const price = scales.right.yToPrice(pos.y - mainPane.y);

    const tool = this._activeDrawingTool;
    const oneClick =
      tool === "hline" || tool === "vline" || tool === "hray" || tool === "textLabel";

    if (oneClick) {
      this._completeDrawing(time, price, time, price);
      return;
    }

    // Two-click tools
    if (!this._drawingInProgress) {
      this._drawingInProgress = { startTime: time, startPrice: price };
      this._needsRender = true;
    } else {
      this._completeDrawing(
        this._drawingInProgress.startTime,
        this._drawingInProgress.startPrice,
        time,
        price,
      );
    }
  };

  private _completeDrawing(
    startTime: number,
    startPrice: number,
    endTime: number,
    endPrice: number,
  ): void {
    const tool = this._activeDrawingTool;
    if (!tool) return;

    const id = `draw_${++this._drawingIdCounter}`;
    let drawing: Drawing;

    switch (tool) {
      case "hline":
        drawing = { id, type: "hline", price: startPrice };
        break;
      case "vline":
        drawing = { id, type: "vline", time: startTime };
        break;
      case "hray":
        drawing = { id, type: "hray", time: startTime, price: startPrice };
        break;
      case "textLabel":
        drawing = {
          id,
          type: "textLabel",
          time: startTime,
          price: startPrice,
          text: this._locale.defaultLabel,
        };
        break;
      case "trendline":
        drawing = { id, type: "trendline", startTime, startPrice, endTime, endPrice };
        break;
      case "ray":
        drawing = { id, type: "ray", startTime, startPrice, endTime, endPrice };
        break;
      case "arrow":
        drawing = { id, type: "arrow", startTime, startPrice, endTime, endPrice };
        break;
      case "rectangle":
        drawing = { id, type: "rectangle", startTime, startPrice, endTime, endPrice };
        break;
      case "fibRetracement":
        drawing = { id, type: "fibRetracement", startTime, startPrice, endTime, endPrice };
        break;
      case "fibExtension":
        drawing = { id, type: "fibExtension", startTime, startPrice, endTime, endPrice };
        break;
      case "channel": {
        // Auto-compute channel width from recent candle range
        const visStart = this._timeScale.startIndex;
        const visEnd = this._timeScale.endIndex;
        let avgRange = 0;
        let count = 0;
        for (let i = visStart; i < visEnd && i < this._data.candleCount; i++) {
          const c = this._data.candles[i];
          if (c) {
            avgRange += c.high - c.low;
            count++;
          }
        }
        const channelWidth =
          count > 0 ? (avgRange / count) * 2 : Math.abs(endPrice - startPrice) * 0.5;
        drawing = { id, type: "channel", startTime, startPrice, endTime, endPrice, channelWidth };
        break;
      }
      default:
        return;
    }

    this.addDrawing(drawing);
    this._emit("drawingComplete", drawing);
    this._activeDrawingTool = null;
    this._drawingInProgress = null;
    this._canvas.style.cursor = "crosshair";
    this._needsRender = true;
  }

  // ---- Public API: Multi-timeframe ----

  addTimeframe(overlay: TimeframeOverlay): void {
    this._data.addTimeframe(overlay);
    this._needsRender = true;
  }

  removeTimeframe(id: string): void {
    this._data.removeTimeframe(id);
    this._needsRender = true;
  }

  // ---- Public API: Backtest Visualization ----

  addBacktest(result: import("../core/types").BacktestResultData): void {
    this._data.setBacktestResult(result);
    // Add equity curve subchart pane
    if (!this._layout.hasPane("equity")) {
      this._layout.addPane({ id: "equity", flex: 0.8 });
    }
    this._needsRender = true;
  }

  addPatterns(patterns: import("../core/types").ChartPatternSignal[]): void {
    this._data.setPatterns(patterns);
    this._needsRender = true;
  }

  addScores(scores: import("../core/types").DataPoint<number | null>[]): void {
    this._data.setScores(scores);
    this._needsRender = true;
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
    this._animateToRange(() => this._timeScale.setVisibleRange(startIdx, endIdx));
  }

  setVisibleRangeByDuration(duration: import("../core/types").RangeDuration): void {
    if (duration === "ALL") {
      this.fitContent();
      return;
    }

    const candles = this._data.candles;
    if (candles.length === 0) return;

    const lastTime = candles[candles.length - 1].time;
    let startTime: number;

    switch (duration) {
      case "1D":
        startTime = lastTime - 86_400_000;
        break;
      case "1W":
        startTime = lastTime - 7 * 86_400_000;
        break;
      case "1M":
        startTime = lastTime - 30 * 86_400_000;
        break;
      case "3M":
        startTime = lastTime - 90 * 86_400_000;
        break;
      case "6M":
        startTime = lastTime - 180 * 86_400_000;
        break;
      case "1Y":
        startTime = lastTime - 365 * 86_400_000;
        break;
      case "YTD": {
        const d = new Date(lastTime);
        startTime = Date.UTC(d.getUTCFullYear(), 0, 1);
        break;
      }
    }

    this.setVisibleRange(startTime, lastTime);
  }

  fitContent(): void {
    this._animateToRange(() => this._timeScale.fitContent());
  }

  /** Animate from current viewport state to the state produced by `applyTarget()` */
  private _animateToRange(applyTarget: () => void): void {
    this._transition.cancel();

    const fromStart = this._timeScale.startIndex;
    const fromSpacing = this._timeScale.barSpacing;

    // Apply target state to get the destination values
    applyTarget();
    const toStart = this._timeScale.startIndex;
    const toSpacing = this._timeScale.barSpacing;

    // Restore original state before animating
    this._timeScale.setImmediate(fromStart, fromSpacing);

    this._transition.animate(
      fromStart,
      fromSpacing,
      toStart,
      toSpacing,
      this._timeScale.width,
      this._animationDuration,
      (startIndex, barSpacing) => {
        this._timeScale.setImmediate(startIndex, barSpacing);
        this._needsRender = true;
      },
    );
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

  setChartType(type: import("../core/types").ChartType): void {
    this._chartType = type;
    this._needsRender = true;
    this._updateAriaLabel();
  }

  setShowVolume(show: boolean): void {
    if (show && !this._layout.hasPane("volume")) {
      this._layout.addPane({ id: "volume", flex: 0.7 });
    } else if (!show && this._layout.hasPane("volume")) {
      this._layout.removePane("volume");
      this._priceScales.delete("volume");
    }
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

  // ---- Public API: Plugins ----

  registerRenderer<TConfig>(plugin: SeriesRendererPlugin<TConfig>): void {
    this._rendererRegistry.registerRenderer(plugin);
    this._needsRender = true;
  }

  registerPrimitive<TState>(plugin: PrimitivePlugin<TState>): void {
    this._rendererRegistry.registerPrimitive(plugin);
    this._needsRender = true;
  }

  removePrimitive(name: string): void {
    this._rendererRegistry.removePrimitive(name);
    this._needsRender = true;
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
    this._transition.cancel();
    this._detachViewport?.();
    this._resizeObserver?.disconnect();
    this._infoOverlay?.destroy();
    this._legendOverlay?.destroy();
    this._rendererRegistry.destroyAll();
    this._detachDrawTap?.();
    this._canvas.remove();
    if (this._ariaLiveTimer !== null) clearTimeout(this._ariaLiveTimer);
    this._ariaLiveEl?.remove();
    this._ariaLiveEl = null;

    // Release retained references to prevent memory leaks
    this._priceScales.clear();
    this._listeners.clear();
    this._timeToIndex.clear();
    this._drawHelper = null;
    this._rafId = null;
  }

  // ---- Internal: Sizing ----

  private _setSize(
    width: number,
    height: number,
    priceAxisWidth?: number,
    timeAxisHeight?: number,
  ): void {
    // Guard against zero/negative dimensions to prevent Infinity in layout math
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const pr = this._pixelRatio;
    this._canvas.width = w * pr;
    this._canvas.height = h * pr;
    this._canvas.style.width = `${w}px`;
    this._canvas.style.height = `${h}px`;
    this._ctx.scale(pr, pr);

    this._layout.setDimensions(w, h, priceAxisWidth, timeAxisHeight);
    const wasFit = this._timeScale.visibleCount >= this._timeScale.totalCount;
    this._timeScale.setWidth(this._layout.dataAreaWidth);
    // Re-fit if all data was visible before resize
    if (wasFit && this._timeScale.totalCount > 0) {
      this._timeScale.fitContent();
    }
  }

  // ---- Internal: Time index cache ----

  private _rebuildTimeIndex(): void {
    this._timeToIndex.clear();
    const candles = this._data.candles;
    for (let i = 0; i < candles.length; i++) {
      this._timeToIndex.set(candles[i].time, i);
    }
  }

  // ---- Internal: Align series to candle indices ----

  private _alignToCandles<T>(series: DataPoint<T>[]): DataPoint<T | null>[] {
    const candles = this._data.candles;
    if (candles.length === 0 || series.length === 0) return series;

    // Create aligned array (same length as candles, null-padded)
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

  // ---- Internal: Render Loop ----

  private _renderLoop = (): void => {
    if (this._needsRender) {
      this._needsRender = false;
      this._render();
    }
    this._rafId = requestAnimationFrame(this._renderLoop);
  };

  private _render(): void {
    const result = renderFrame({
      ctx: this._ctx,
      pixelRatio: this._pixelRatio,
      canvasWidth: this._canvas.width,
      canvasHeight: this._canvas.height,
      theme: this._theme,
      fontSize: this._fontSize,
      chartType: this._chartType,
      watermark: this._watermark,
      priceFormatter: this._priceFormatter,
      timeFormatter: this._timeFormatter,
      data: this._data,
      layout: this._layout,
      timeScale: this._timeScale,
      priceScales: this._priceScales,
      viewportState: this._viewport.state,
      rendererRegistry: this._rendererRegistry,
      drawHelper: this._drawHelper,
      emit: (event, data) => this._emit(event as ChartEvent, data),
      drawingPreview: this._buildDrawingPreview(),
      locale: this._locale,
    });

    // Cache drawHelper for reuse
    this._drawHelper = result.drawHelper;

    // Update DOM overlays
    this._infoOverlay?.update(
      result.crosshairIndex,
      this._data.candles,
      result.paneRects,
      result.seriesByPane,
    );
    this._legendOverlay?.update(this._data.getAllSeries());

    // Debounced aria-live announcement for crosshair data
    this._updateAriaLive(result.crosshairIndex);
  }

  /** Update the canvas aria-label with current chart description */
  private _updateAriaLabel(): void {
    const candleCount = this._data.candleCount;
    const indicatorCount = this._data.getAllSeries().length;
    const l = this._locale;
    const parts = [`${this._chartType} chart`];
    if (candleCount > 0) parts.push(`${candleCount} ${l.dataPoints}`);
    if (indicatorCount > 0)
      parts.push(`${indicatorCount} ${indicatorCount > 1 ? l.indicators : l.indicator}`);
    this._canvas.setAttribute("aria-label", parts.join(", "));
  }

  /** Debounced update to aria-live region with OHLCV at crosshair */
  private _updateAriaLive(crosshairIndex: number | null): void {
    if (!this._ariaLiveEl) return;
    if (crosshairIndex === null) return;

    const idx = crosshairIndex;
    if (this._ariaLiveTimer !== null) clearTimeout(this._ariaLiveTimer);
    this._ariaLiveTimer = setTimeout(() => {
      const candle = this._data.candles[idx];
      if (!candle || !this._ariaLiveEl) return;
      const l = this._locale;
      this._ariaLiveEl.textContent =
        `${l.open} ${this._priceFormatter(candle.open)}, ` +
        `${l.high} ${this._priceFormatter(candle.high)}, ` +
        `${l.low} ${this._priceFormatter(candle.low)}, ` +
        `${l.close} ${this._priceFormatter(candle.close)}, ` +
        `${l.volume} ${candle.volume.toLocaleString()}`;
    }, 300);
  }

  /** Build a temporary Drawing for preview while user is placing a 2-click drawing */
  private _buildDrawingPreview(): Drawing | undefined {
    if (!this._activeDrawingTool || !this._drawingInProgress) return undefined;

    const vs = this._viewport.state;
    if (vs.crosshairIndex === null) return undefined;

    const endCandle = this._data.candles[vs.crosshairIndex];
    if (!endCandle) return undefined;

    const mainPane = this._layout.paneRects.find((p) => p.id === "main");
    if (!mainPane) return undefined;
    const scales = this._priceScales.get("main");
    if (!scales) return undefined;

    const endTime = endCandle.time;
    const endPrice = scales.right.yToPrice(vs.mouseY - mainPane.y);
    const { startTime, startPrice } = this._drawingInProgress;
    const tool = this._activeDrawingTool;

    switch (tool) {
      case "trendline":
        return { id: "__preview__", type: "trendline", startTime, startPrice, endTime, endPrice };
      case "ray":
        return { id: "__preview__", type: "ray", startTime, startPrice, endTime, endPrice };
      case "arrow":
        return { id: "__preview__", type: "arrow", startTime, startPrice, endTime, endPrice };
      case "rectangle":
        return { id: "__preview__", type: "rectangle", startTime, startPrice, endTime, endPrice };
      case "fibRetracement":
        return {
          id: "__preview__",
          type: "fibRetracement",
          startTime,
          startPrice,
          endTime,
          endPrice,
        };
      case "fibExtension":
        return {
          id: "__preview__",
          type: "fibExtension",
          startTime,
          startPrice,
          endTime,
          endPrice,
        };
      case "channel":
        return {
          id: "__preview__",
          type: "channel",
          startTime,
          startPrice,
          endTime,
          endPrice,
          channelWidth: Math.abs(endPrice - startPrice) * 0.3,
        };
      default:
        return undefined;
    }
  }
}
