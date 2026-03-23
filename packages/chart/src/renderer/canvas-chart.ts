/**
 * CanvasChart — The main chart class and public entry point.
 * Orchestrates data layer, layout, scales, viewport, and rendering.
 */

import { DataLayer, type InternalSeries } from "../core/data-layer";
import { DEFAULT_LAYOUT, LayoutEngine } from "../core/layout";
import { PriceScale, TimeScale } from "../core/scale";
import { defaultRegistry } from "../core/series-registry";
import type {
  CandleData,
  ChartEvent,
  ChartInstance,
  ChartOptions,
  DataPoint,
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
import { renderArea } from "../series/area";
import { bandPriceRange, renderBand } from "../series/band";
import { candlePriceRange, renderCandlesticks } from "../series/candlestick";
import { cloudPriceRange, renderCloud } from "../series/cloud";
import { histogramRange, renderHistogram, renderVolume, volumeRange } from "../series/histogram";
import { channelPriceRange, linePriceRange, renderChannelLine, renderLine } from "../series/line";
import { renderMarkers } from "../series/marker";
import { renderGrid, renderPriceAxis, renderReferenceLines, renderTimeAxis } from "./axis-renderer";
import { renderCrosshair } from "./crosshair-renderer";
import { InfoOverlay } from "./info-overlay";
import { renderScrollbar, scrollbarHitTest } from "./scrollbar-renderer";

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

  private _data = new DataLayer();
  private _layout = new LayoutEngine();
  private _timeScale = new TimeScale();
  private _viewport = new Viewport();
  private _priceScales = new Map<string, PriceScale>();
  private _infoOverlay: InfoOverlay | null = null;

  private _rafId: number | null = null;
  private _needsRender = true;
  private _detachViewport: (() => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  // Event listeners
  private _listeners = new Map<ChartEvent, Set<(data: unknown) => void>>();

  // Auto-generated pane counter
  private _autoSubchartId = 0;

  constructor(container: HTMLElement, options?: ChartOptions) {
    this._container = container;
    this._fontSize = options?.fontSize ?? DEFAULT_OPTIONS.fontSize;
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

    // Start render loop
    this._renderLoop();
  }

  // ---- Public API: Data ----

  setCandles(candles: CandleData[]): void {
    this._data.setCandles(candles);
    this._timeScale.setTotalCount(this._data.candleCount);
    this._timeScale.scrollToEnd();
    this._needsRender = true;
  }

  updateCandle(candle: CandleData): void {
    this._data.updateCandle(candle);
    this._timeScale.setTotalCount(this._data.candleCount);
    this._needsRender = true;
  }

  // ---- Public API: Indicators ----

  addIndicator<T>(series: DataPoint<T>[], config?: SeriesConfig): SeriesHandle {
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

      const [min, max] = this._computePaneRange(pane, visibleStart, visibleEnd);
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
      renderGrid(ctx, ps, pane.x, pane.y, pane.width, pane.height, this._theme);

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
        // Candlesticks on main pane
        renderCandlesticks(ctx, candles, timeScale, ps, this._theme);
      }

      if (pane.id === "volume") {
        // Volume on volume pane
        renderVolume(ctx, candles, timeScale, ps, this._theme);
      }

      // Render indicator series for this pane
      const paneSeries = this._data.getSeriesForPane(pane.id);
      for (const s of paneSeries) {
        this._renderSeries(ctx, s, timeScale, ps);
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

    // Signal markers on main pane
    this._renderSignals(ctx, paneRects);

    // Trade markers on main pane
    this._renderTrades(ctx, paneRects);

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
  }

  // ---- Internal: Compute pane price range ----

  private _computePaneRange(pane: PaneRect, start: number, end: number): [number, number] {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    if (pane.id === "main") {
      const [cMin, cMax] = candlePriceRange(this._data.candles, start, end);
      if (cMin < min) min = cMin;
      if (cMax > max) max = cMax;
    }

    if (pane.id === "volume") {
      const [vMin, vMax] = volumeRange(this._data.candles, start, end);
      return [vMin, vMax];
    }

    // Include series assigned to this pane
    const paneSeries = this._data.getSeriesForPane(pane.id);
    for (const s of paneSeries) {
      const [sMin, sMax] = this._seriesPriceRange(s, start, end);
      if (sMin < min) min = sMin;
      if (sMax > max) max = sMax;
    }

    return min <= max ? [min, max] : [0, 100];
  }

  private _seriesPriceRange(s: InternalSeries, start: number, end: number): [number, number] {
    const rule = defaultRegistry.detect(s.data);
    if (!rule) return [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    if (rule.name === "number") {
      return linePriceRange(s.data as DataPoint<number | null>[], start, end);
    }

    if (rule.name === "band") {
      const channels = defaultRegistry.decomposeAll(s.data, rule);
      const upper = channels.get("upper") ?? [];
      const lower = channels.get("lower") ?? [];
      return bandPriceRange(upper, lower, start, end);
    }

    if (rule.name === "ichimoku") {
      const channels = defaultRegistry.decomposeAll(s.data, rule);
      return cloudPriceRange(channels, start, end);
    }

    if (rule.name === "macd") {
      const channels = defaultRegistry.decomposeAll(s.data, rule);
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const [, vals] of channels) {
        const [cMin, cMax] = channelPriceRange(vals, start, end);
        if (cMin < min) min = cMin;
        if (cMax > max) max = cMax;
      }
      return [min, max];
    }

    // Generic: decompose and find range across all channels
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const [, vals] of channels) {
      const [cMin, cMax] = channelPriceRange(vals, start, end);
      if (cMin < min) min = cMin;
      if (cMax > max) max = cMax;
    }
    return [min, max];
  }

  // ---- Internal: Series Rendering ----

  private _renderSeries(
    ctx: CanvasRenderingContext2D,
    s: InternalSeries,
    timeScale: TimeScale,
    priceScale: PriceScale,
  ): void {
    const rule = defaultRegistry.detect(s.data);
    if (!rule) return;

    const preset = s.config;
    const color = preset.color ?? "#2196F3";
    const lineWidth = preset.lineWidth ?? 1.5;

    if (rule.name === "number") {
      renderLine(
        ctx,
        s.data as DataPoint<number | null>[],
        timeScale,
        priceScale,
        timeScale.startIndex,
        {
          color,
          lineWidth,
        },
      );
      return;
    }

    if (rule.name === "band") {
      const channels = defaultRegistry.decomposeAll(s.data, rule);
      renderBand(
        ctx,
        channels.get("upper") ?? [],
        channels.get("middle") ?? [],
        channels.get("lower") ?? [],
        timeScale,
        priceScale,
      );
      return;
    }

    if (rule.name === "macd") {
      const channels = defaultRegistry.decomposeAll(s.data, rule);
      const histogramVals = channels.get("histogram") ?? [];
      renderHistogram(ctx, histogramVals, timeScale, priceScale, {
        upColor: "rgba(38,166,154,0.6)",
        downColor: "rgba(239,83,80,0.6)",
      });
      renderChannelLine(ctx, channels.get("macd") ?? [], timeScale, priceScale, {
        color: "#2196F3",
        lineWidth: 1.5,
      });
      renderChannelLine(ctx, channels.get("signal") ?? [], timeScale, priceScale, {
        color: "#FF9800",
        lineWidth: 1.5,
      });
      return;
    }

    // Ichimoku cloud
    if (rule.name === "ichimoku") {
      const channels = defaultRegistry.decomposeAll(s.data, rule);
      renderCloud(ctx, channels, timeScale, priceScale);
      return;
    }

    // Parabolic SAR dots
    if (rule.name === "parabolicSar") {
      const channels = defaultRegistry.decomposeAll(s.data, rule);
      const sarVals = channels.get("sar") ?? [];
      renderMarkers(ctx, sarVals, timeScale, priceScale, { color: color ?? "#FF9800", radius: 2 });
      return;
    }

    // Area (HMM Regime etc.)
    if (rule.name === "hmmRegime") {
      renderArea(ctx, s.data as DataPoint<number | null>[], timeScale, priceScale, {
        lineColor: color,
        fillColor: `${color}26`,
      });
      return;
    }

    // Generic multi-channel: render each channel as a line
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    const colors = ["#2196F3", "#FF9800", "#26a69a", "#ef5350", "#9c27b0", "#FF5722"];
    let colorIdx = 0;
    for (const [, vals] of channels) {
      renderChannelLine(ctx, vals, timeScale, priceScale, {
        color: colors[colorIdx % colors.length],
        lineWidth,
      });
      colorIdx++;
    }
  }

  // ---- Internal: Signal Rendering ----

  private _renderSignals(ctx: CanvasRenderingContext2D, paneRects: readonly PaneRect[]): void {
    const signals = this._data.signals;
    if (signals.length === 0) return;

    const mainPane = paneRects.find((p) => p.id === "main");
    if (!mainPane) return;

    const ps = this._priceScales.get("main");
    if (!ps) return;

    const timeScale = this._timeScale;
    const candles = this._data.candles;

    ctx.save();
    ctx.beginPath();
    ctx.rect(mainPane.x, mainPane.y, mainPane.width, mainPane.height);
    ctx.clip();

    for (const signal of signals) {
      const idx = this._data.indexAtTime(signal.time);
      if (idx < timeScale.startIndex || idx >= timeScale.endIndex) continue;

      const candle = candles[idx];
      if (!candle) continue;

      const x = timeScale.indexToX(idx);
      const isBuy = signal.type === "buy";
      const price = isBuy ? candle.low : candle.high;
      const y = ps.priceToY(price) + mainPane.y;
      const offset = isBuy ? 12 : -12;

      // Arrow
      ctx.fillStyle = isBuy ? "#26a69a" : "#ef5350";
      ctx.beginPath();
      if (isBuy) {
        ctx.moveTo(x, y + offset - 8);
        ctx.lineTo(x - 5, y + offset);
        ctx.lineTo(x + 5, y + offset);
      } else {
        ctx.moveTo(x, y + offset + 8);
        ctx.lineTo(x - 5, y + offset);
        ctx.lineTo(x + 5, y + offset);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ---- Internal: Trade Rendering ----

  private _renderTrades(ctx: CanvasRenderingContext2D, paneRects: readonly PaneRect[]): void {
    const trades = this._data.trades;
    if (trades.length === 0) return;

    const mainPane = paneRects.find((p) => p.id === "main");
    if (!mainPane) return;

    const ps = this._priceScales.get("main");
    if (!ps) return;

    const timeScale = this._timeScale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(mainPane.x, mainPane.y, mainPane.width, mainPane.height);
    ctx.clip();

    for (const trade of trades) {
      const entryIdx = this._data.indexAtTime(trade.entryTime);
      const exitIdx = this._data.indexAtTime(trade.exitTime);

      // Holding period shading
      const isWin = (trade.returnPercent ?? 0) >= 0;
      const x1 = timeScale.indexToX(entryIdx);
      const x2 = timeScale.indexToX(exitIdx);
      ctx.fillStyle = isWin ? "rgba(38,166,154,0.08)" : "rgba(239,83,80,0.08)";
      ctx.fillRect(x1, mainPane.y, x2 - x1, mainPane.height);

      // Entry marker
      const entryY = ps.priceToY(trade.entryPrice) + mainPane.y;
      ctx.fillStyle = "#2196F3";
      ctx.beginPath();
      ctx.arc(x1, entryY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Exit marker
      const exitY = ps.priceToY(trade.exitPrice) + mainPane.y;
      ctx.fillStyle = isWin ? "#26a69a" : "#ef5350";
      ctx.beginPath();
      ctx.arc(x2, exitY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Connection line
      ctx.strokeStyle = isWin ? "rgba(38,166,154,0.3)" : "rgba(239,83,80,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x1, entryY);
      ctx.lineTo(x2, exitY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
