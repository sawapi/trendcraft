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
import { onTap } from "../core/pointer";
import { resolveRangeDuration } from "../core/range-utils";
import { RendererRegistry } from "../core/renderer-registry";
import { type PriceScale, TimeScale } from "../core/scale";
import { type IntrospectionRule, defaultRegistry } from "../core/series-registry";
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
  SessionGapsOptions,
  SignalMarker,
  ThemeColors,
  TimeValue,
  TimeframeOverlay,
  TradeMarker,
} from "../core/types";
import { DARK_THEME, LIGHT_THEME } from "../core/types";
import { Viewport } from "../core/viewport";
import { INDICATOR_PRESETS, type IndicatorPreset } from "../integration/indicator-presets";
import { introspect } from "../integration/series-introspector";
import { ChartAria } from "./chart-aria";
import { DrawingTool } from "./drawing-tool";
import { InfoOverlay } from "./info-overlay";
import { LegendOverlay } from "./legend-overlay";
import { renderPaneTitles } from "./overlay-renderer";
import { renderFrame } from "./render-pipeline";

// ============================================
// Default Options
// ============================================

const DEFAULT_OPTIONS: Required<
  Pick<ChartOptions, "height" | "priceAxisWidth" | "timeAxisHeight" | "fontSize">
> = {
  height: 400,
  priceAxisWidth: 60,
  timeAxisHeight: 32,
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
  /** Last applied layout size — tracked so applyOptions() can compose partial size changes. */
  private _sizeState: {
    width: number;
    height: number;
    priceAxisWidth: number;
    timeAxisHeight: number;
  };

  private _data = new DataLayer();
  private _layout = new LayoutEngine();
  private _timeScale = new TimeScale();
  private _viewport = new Viewport();
  private _priceScales = new Map<string, { left: PriceScale; right: PriceScale }>();
  private _infoOverlay: InfoOverlay | null = null;
  private _legendOverlay: LegendOverlay | null = null;
  private _watermark: string | undefined;
  private _showSeriesBadges = false;
  private _seriesBadgeMode: "absolute" | "visible" = "absolute";
  private _chartType: import("../core/types").ChartType;
  private _drawingTool: DrawingTool | null = null;
  private _detachDrawTap: (() => void) | null = null;

  private _rendererRegistry = new RendererRegistry();
  private _drawHelper: DrawHelper | null = null;

  private _rafId: number | null = null;
  private _needsRender = true;
  private _destroyed = false;
  private _batching = false;
  private _batchScrollToEnd = false;
  private _detachViewport: (() => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _aria: ChartAria | null = null;
  private _transition = new ViewTransition();
  private _animationDuration: number;
  private _locale: ChartLocale;
  private _crosshairOpts: import("../core/types").CrosshairOptions;
  private _sessionGapsOpts: ResolvedSessionGapsOptions;
  private _overlaysHidden = false;
  private _overlaySavedVisibility: Map<string, boolean> | null = null;
  // Cached visible range for change-detection in the render loop — the public
  // `visibleRangeChange` event fires only when the indices actually move.
  private _lastVisibleStart = -1;
  private _lastVisibleEnd = -1;
  // Last crosshair index that was emitted via crosshairMove, kept so user
  // interaction only fires the event on real changes. Only user-driven
  // transitions go through _maybeEmitCrosshair(); programmatic setCrosshair()
  // updates state silently, so no pending-echo tracking is needed.
  private _lastCrosshairIndex: number | null | undefined = undefined;
  // True while a programmatic range animation (setVisibleRange, fitContent,
  // setVisibleRangeByDuration) is in flight. Gates visibleRangeChange emission
  // so viewport sync between mismatched timeframes doesn't oscillate forever
  // on the per-frame range tween.
  private _animatingRange = false;
  // Auto-color cycling palette for indicators without explicit color
  private _colorIndex = 0;
  /**
   * Per-palette counters so that a preset's palette (e.g. the `"number"`
   * catch-all palette) rotates independently of the default palette and of
   * other presets' palettes. Keyed by the palette array identity so the same
   * array always resolves to the same counter.
   */
  private _paletteIndices = new WeakMap<readonly string[], number>();
  private static readonly _COLOR_PALETTE: readonly string[] = [
    "#2196F3",
    "#FF9800",
    "#26a69a",
    "#ef5350",
    "#9c27b0",
    "#FF5722",
    "#00bcd4",
    "#8bc34a",
    "#e91e63",
    "#607d8b",
    "#ffc107",
    "#3f51b5",
  ];

  // Event listeners
  private _listeners = new Map<ChartEvent, Set<(data: unknown) => void>>();

  private _emit(event: ChartEvent, data: unknown): void {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }

  /**
   * Fire `crosshairMove` when the user's interaction has moved the snapped
   * index relative to the last emit. Called synchronously from the viewport's
   * onUpdate hook (mouse/wheel/keyboard) so syncCharts can propagate to peers
   * inside the same tick. Programmatic `setCrosshair()` bypasses this path
   * entirely and never emits — no echo to worry about.
   */
  private _maybeEmitCrosshair(): void {
    const idx = this._viewport.state.crosshairIndex;
    if (idx === this._lastCrosshairIndex) return;
    this._lastCrosshairIndex = idx;
    if (idx === null) {
      this._emit("crosshairMove", { time: null, index: null, paneId: null });
      return;
    }
    const candle = this._data.candles[idx];
    if (!candle) return;
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
    if (options?.maxCandles) this._data.setMaxCandles(options.maxCandles);
    this._fontSize = options?.fontSize ?? DEFAULT_OPTIONS.fontSize;
    this._priceFormatter = options?.priceFormatter ?? autoFormatPrice;
    this._timeFormatter = options?.timeFormatter;
    this._animationDuration = options?.animationDuration ?? 300;
    this._crosshairOpts = {
      mode: options?.crosshair?.mode ?? "normal",
      snapThreshold: options?.crosshair?.snapThreshold ?? 12,
      lockOnLongPress: options?.crosshair?.lockOnLongPress ?? true,
    };
    this._sessionGapsOpts = resolveSessionGapsOptions(options?.timeScale?.sessionGaps);
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
    this._aria = new ChartAria(container, this._locale);
    this._aria.initCanvas(this._canvas);
    this._updateAriaLabel();

    container.style.position = "relative";

    container.appendChild(this._canvas);

    const ctx = this._canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this._ctx = ctx;

    // Initial sizing
    const width = options?.width ?? container.clientWidth;
    const height = options?.height ?? DEFAULT_OPTIONS.height;
    this._sizeState = {
      width,
      height,
      priceAxisWidth: options?.priceAxisWidth ?? DEFAULT_OPTIONS.priceAxisWidth,
      timeAxisHeight: options?.timeAxisHeight ?? DEFAULT_OPTIONS.timeAxisHeight,
    };
    this._setSize(
      this._sizeState.width,
      this._sizeState.height,
      this._sizeState.priceAxisWidth,
      this._sizeState.timeAxisHeight,
    );

    // Data change listener
    this._data.setOnChange(() => {
      this._needsRender = true;
    });

    // Forward data layer warnings
    this._data.setOnWarn((msg) => this._warn(msg));

    // Auto-remove empty panes when last series is removed
    this._data.setOnPaneEmpty((paneId) => {
      if (this._layout.removePane(paneId)) {
        this._priceScales.delete(paneId);
        this._needsRender = true;
      }
    });

    // Viewport interaction
    this._viewport.setOnUpdate(() => {
      // User interaction cancels any running range transition. Clear the
      // `_animatingRange` flag too: ViewTransition.cancel() nulls the onDone
      // callback, so without this reset the flag would stay true forever and
      // silently swallow every subsequent visibleRangeChange emit — which
      // showed up as "sync stops following after you scroll mid-animation".
      this._transition.cancel();
      this._animatingRange = false;
      this._needsRender = true;
      // Emit crosshairMove synchronously from the interaction event rather
      // than from the render that comes on the next rAF. Letting sync fan
      // out immediately means the peer chart's setCrosshair() runs in the
      // same synchronous tick, so both charts' next rAF paints share the
      // same frame — no visible 1-frame lag on the mirrored crosshair.
      this._maybeEmitCrosshair();
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
      {
        lockOnLongPress: this._crosshairOpts.lockOnLongPress,
        wheelInertia: options?.interaction?.wheelInertia ?? true,
        hotkeys: options?.hotkeys,
        onAction: (action) => this._handleHotkeyAction(action),
      },
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
    this._showSeriesBadges = options?.showSeriesBadges === true;
    this._seriesBadgeMode = options?.seriesBadgeMode ?? "absolute";
    this._chartType = options?.chartType ?? "candlestick";

    // Volume pane visibility
    if (options?.volume === false) {
      this._layout.setLayout(DEFAULT_LAYOUT_NO_VOLUME);
    }

    // Interactive drawing: unified mouse + touch tap handler
    this._drawingTool = new DrawingTool({
      getCandles: () => this._data.candles,
      getTimeScale: () => this._timeScale,
      getLayout: () => this._layout,
      getPriceScales: () => this._priceScales,
      getViewportState: () => this._viewport.state,
      addDrawing: (d) => this.addDrawing(d),
      emit: (event, data) => this._emit(event as ChartEvent, data),
      requestRender: () => {
        this._needsRender = true;
      },
      locale: this._locale,
    });
    this._detachDrawTap = onTap(this._canvas, (pos) => this._drawingTool?.handleTap(pos));

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
    this._timeScale.setTotalCount(this._data.candleCount);
    this._applySessionGaps();
    this._timeScale.scrollToEnd();
    this._needsRender = true;
    if (removed > 0) {
      this._emit("dataFiltered", { total: candles.length, valid: valid.length, removed });
      console.warn(
        `[@trendcraft/chart] ${removed} invalid candle(s) filtered from ${candles.length} total. Candles must have finite numeric time, open, high, low, close, and volume fields.`,
      );
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
    const newCount = this._data.candleCount;
    this._timeScale.setTotalCount(newCount);

    // If a new bar was appended (count grew) and we had a virtual/time layout,
    // `setTotalCount` cleared it to avoid stale arrays. Re-apply so streaming
    // charts keep their session-gap layout and two-row time axis.
    if (newCount !== prevCount && this._sessionGapsOpts.mode !== "off") {
      this._applySessionGaps();
    }

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
        config: {},
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

    // Auto-assign color if not explicitly set. Prefer the first palette entry
    // not already in use by another live series — this keeps the
    // remove→re-add (e.g. param-change) cycle stable so the same indicator
    // usually comes back with the same color. Fall back to the per-palette
    // counter when every palette entry is taken.
    if (!result.config.color && !result.config.channelColors) {
      const presetPalette = result.config.colorPalette;
      const palette =
        presetPalette && presetPalette.length > 0 ? presetPalette : CanvasChart._COLOR_PALETTE;
      const usedColors = new Set<string>();
      for (const s of this._data.getAllSeries()) {
        if (s.config.color) usedColors.add(s.config.color);
      }
      const freeColor = palette.find((c) => !usedColors.has(c));
      if (freeColor) {
        result.config.color = freeColor;
      } else if (presetPalette && presetPalette.length > 0) {
        const idx = this._paletteIndices.get(presetPalette) ?? 0;
        result.config.color = presetPalette[idx % presetPalette.length];
        this._paletteIndices.set(presetPalette, idx + 1);
      } else {
        result.config.color =
          CanvasChart._COLOR_PALETTE[this._colorIndex % CanvasChart._COLOR_PALETTE.length];
        this._colorIndex++;
      }
    }

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
    const aligned = this._data.alignToCandles(series);

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
    this._drawingTool?.setTool(tool);
    this._canvas.style.cursor = tool ? "cell" : "crosshair";
    this._needsRender = true;
  }

  /**
   * Route a hotkey dispatch from the viewport. `"cancel"` clears the active
   * drawing tool; `"toggleOverlays"` hides/restores every series' visibility
   * (used by Ctrl+Alt+H for a "blank chart" view); otherwise the
   * action names a drawing tool to activate.
   */
  private _handleHotkeyAction(action: import("../core/types").HotkeyAction): void {
    if (action === "cancel") {
      this.setDrawingTool(null);
      return;
    }
    if (action === "toggleOverlays") {
      this._toggleAllOverlays();
      return;
    }
    this.setDrawingTool(action);
  }

  private _toggleAllOverlays(): void {
    const series = this._data.getAllSeries();
    if (!this._overlaysHidden) {
      // Snapshot current visibility so a second toggle restores the exact state.
      this._overlaySavedVisibility = new Map(series.map((s) => [s.id, s.visible]));
      for (const s of series) s.visible = false;
      this._overlaysHidden = true;
    } else {
      const saved = this._overlaySavedVisibility;
      for (const s of series) s.visible = saved?.get(s.id) ?? true;
      this._overlaySavedVisibility = null;
      this._overlaysHidden = false;
    }
    this._legendOverlay?.update(this._data.getAllSeries());
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
    const candles = this._data.candles;
    if (candles.length === 0) return;

    const lastTime = candles[candles.length - 1].time;
    const startTime = resolveRangeDuration(duration, lastTime);
    if (startTime === null) {
      this.fitContent();
      return;
    }
    this.setVisibleRange(startTime, lastTime);
  }

  fitContent(): void {
    this._animateToRange(() => this._timeScale.fitContent());
  }

  setCrosshair(time: TimeValue | null): void {
    this._viewport.setCrosshairByIndex(
      time === null ? null : this._data.indexAtTime(time),
      this._timeScale,
    );
    // Programmatic changes never emit crosshairMove (emission is driven by
    // user interaction in _maybeEmitCrosshair), so external drivers don't
    // echo back through any listener chain.
    this._needsRender = true;
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

    this._animatingRange = true;
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
      () => {
        this._animatingRange = false;
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

  /**
   * Apply a partial options update at runtime.
   *
   * Diffs each provided field against the chart's current state and routes to
   * the appropriate internal setter. Fields not listed in `opts` are left alone.
   *
   * Runtime-capable fields: theme, chartType, volume, fontSize, watermark,
   * animationDuration, maxCandles, legend, priceFormatter, timeFormatter,
   * width, height, priceAxisWidth, timeAxisHeight.
   *
   * Fields that require re-creating the chart emit a warning and are ignored:
   * pixelRatio, fontFamily, scrollSensitivity, locale, formatInfoOverlay.
   */
  applyOptions(opts: Partial<ChartOptions>): void {
    if (opts.theme !== undefined) this.setTheme(opts.theme);
    if (opts.chartType !== undefined) this.setChartType(opts.chartType);
    if (opts.volume !== undefined) this.setShowVolume(opts.volume);

    if (opts.fontSize !== undefined) {
      this._fontSize = opts.fontSize;
      this._needsRender = true;
    }
    if (opts.watermark !== undefined) {
      this._watermark = opts.watermark;
      this._needsRender = true;
    }
    if (opts.showSeriesBadges !== undefined) {
      this._showSeriesBadges = opts.showSeriesBadges === true;
      this._needsRender = true;
    }
    if (opts.seriesBadgeMode !== undefined) {
      this._seriesBadgeMode = opts.seriesBadgeMode;
      this._needsRender = true;
    }
    if (opts.animationDuration !== undefined) {
      this._animationDuration = opts.animationDuration;
    }
    if (opts.maxCandles !== undefined) {
      this._data.setMaxCandles(opts.maxCandles);
    }
    if (opts.priceFormatter !== undefined) {
      this._priceFormatter = opts.priceFormatter;
      this._needsRender = true;
    }
    if (opts.timeFormatter !== undefined) {
      this._timeFormatter = opts.timeFormatter;
      this._needsRender = true;
    }

    if (opts.crosshair !== undefined) {
      this._crosshairOpts = {
        mode: opts.crosshair.mode ?? this._crosshairOpts.mode,
        snapThreshold: opts.crosshair.snapThreshold ?? this._crosshairOpts.snapThreshold,
        lockOnLongPress: opts.crosshair.lockOnLongPress ?? this._crosshairOpts.lockOnLongPress,
      };
      this._needsRender = true;
    }

    if (opts.timeScale !== undefined && opts.timeScale.sessionGaps !== undefined) {
      this._sessionGapsOpts = resolveSessionGapsOptions(opts.timeScale.sessionGaps);
      this._applySessionGaps();
      this._needsRender = true;
    }

    // Legend overlay — create/destroy
    if (opts.legend !== undefined) {
      if (opts.legend === false && this._legendOverlay) {
        this._legendOverlay.destroy();
        this._legendOverlay = null;
      } else if (opts.legend !== false && !this._legendOverlay) {
        this._legendOverlay = new LegendOverlay(this._container, this._theme, this._locale);
        this._legendOverlay.setOnToggle((seriesId, visible) => {
          const series = this._data.getAllSeries().find((s) => s.id === seriesId);
          if (series) {
            series.visible = visible;
            this._needsRender = true;
          }
        });
      }
      this._needsRender = true;
    }

    // Size — compose partial width/height/axis changes against stored state
    if (
      opts.width !== undefined ||
      opts.height !== undefined ||
      opts.priceAxisWidth !== undefined ||
      opts.timeAxisHeight !== undefined
    ) {
      this._setSize(
        opts.width ?? this._sizeState.width,
        opts.height ?? this._sizeState.height,
        opts.priceAxisWidth ?? this._sizeState.priceAxisWidth,
        opts.timeAxisHeight ?? this._sizeState.timeAxisHeight,
      );
      this._needsRender = true;
    }

    // Unsupported at runtime — these bind to sub-components at construction
    const unsupported: (keyof ChartOptions)[] = [];
    if (opts.pixelRatio !== undefined) unsupported.push("pixelRatio");
    if (opts.fontFamily !== undefined) unsupported.push("fontFamily");
    if (opts.scrollSensitivity !== undefined) unsupported.push("scrollSensitivity");
    if (opts.locale !== undefined) unsupported.push("locale");
    if (opts.formatInfoOverlay !== undefined) unsupported.push("formatInfoOverlay");
    if (unsupported.length > 0) {
      this._warn(
        `applyOptions: [${unsupported.join(", ")}] cannot be changed at runtime; re-create the chart to update them`,
      );
    }
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

  // ---- Public API: Extensibility ----

  addRule(rule: IntrospectionRule): void {
    defaultRegistry.addRule(rule);
  }

  addPreset(name: string, preset: IndicatorPreset): void {
    INDICATOR_PRESETS.set(name, preset);
  }

  // ---- Public API: Export ----

  async toImage(type = "image/png", quality = 1, timeoutMs = 0): Promise<Blob> {
    // Force a synchronous render
    this._render();

    // Composite pane titles onto an offscreen canvas so the on-screen DOM
    // InfoOverlay (which is not captured by toBlob) does not leave exports
    // without sub-pane labels. The on-screen canvas is never mutated.
    const exportCanvas = this._composeExportCanvas();

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              if (!settled) {
                settled = true;
                reject(new Error("toImage() timed out"));
              }
            }, timeoutMs)
          : undefined;

      exportCanvas.toBlob(
        (blob) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);

          if (!blob || blob.size === 0) {
            reject(new Error("Failed to export chart image: empty or null blob"));
          } else {
            resolve(blob);
          }
        },
        type,
        quality,
      );
    });
  }

  /**
   * Build an offscreen canvas containing the current frame plus Canvas-drawn
   * pane titles. Used by toImage() to embed labels that are normally rendered
   * via the DOM InfoOverlay and therefore excluded from toBlob captures.
   */
  private _composeExportCanvas(): HTMLCanvasElement {
    const src = this._canvas;
    const off = document.createElement("canvas");
    off.width = src.width;
    off.height = src.height;
    const ctx = off.getContext("2d");
    if (!ctx) return src;

    ctx.drawImage(src, 0, 0);
    ctx.setTransform(this._pixelRatio, 0, 0, this._pixelRatio, 0, 0);
    renderPaneTitles(
      ctx,
      this._layout.paneRects,
      this._data,
      this._theme,
      this._fontSize,
      this._locale,
    );
    return off;
  }

  // ---- Public API: Lifecycle ----

  resize(width: number, height: number): void {
    this._setSize(width, height);
    this._needsRender = true;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._transition.cancel();
    this._detachViewport?.();
    this._resizeObserver?.disconnect();
    this._infoOverlay?.destroy();
    this._legendOverlay?.destroy();
    this._rendererRegistry.destroyAll();
    this._detachDrawTap?.();
    this._drawingTool?.reset();
    this._drawingTool = null;
    this._canvas.remove();
    this._aria?.destroy();
    this._aria = null;

    // Release retained references to prevent memory leaks
    this._priceScales.clear();
    this._listeners.clear();
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

    // Keep last-applied size so applyOptions() can compose partial changes
    this._sizeState = {
      width: w,
      height: h,
      priceAxisWidth:
        priceAxisWidth ?? this._sizeState?.priceAxisWidth ?? DEFAULT_OPTIONS.priceAxisWidth,
      timeAxisHeight:
        timeAxisHeight ?? this._sizeState?.timeAxisHeight ?? DEFAULT_OPTIONS.timeAxisHeight,
    };
    const wasFit = this._timeScale.visibleCount >= this._timeScale.totalCount;
    this._timeScale.setWidth(this._layout.dataAreaWidth);
    // Re-fit if all data was visible before resize
    if (wasFit && this._timeScale.totalCount > 0) {
      this._timeScale.fitContent();
    }
  }

  // ---- Internal: Render Loop ----

  private _renderLoop = (): void => {
    if (this._destroyed) return;
    if (this._needsRender) {
      this._needsRender = false;
      this._render();
    }
    if (this._destroyed) return;
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
      showSeriesBadges: this._showSeriesBadges,
      seriesBadgeMode: this._seriesBadgeMode,
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
      drawingPreview: this._drawingTool?.buildPreview(),
      locale: this._locale,
      crosshair: this._crosshairOpts,
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
    this._aria?.updateLive(result.crosshairIndex, this._data.candles, this._priceFormatter);

    // crosshairMove is emitted from the interaction callback rather than
    // here, so mirrored charts pick up the change inside the same rAF tick
    // and repaint without a one-frame lag. See _maybeEmitCrosshair().

    // Emit visibleRangeChange on actual index movement. Suppressed while
    // `_animatingRange` is true so programmatic setVisibleRange / fitContent
    // tweens don't flood listeners on every frame of the transition.
    const startIdx = this._timeScale.startIndex;
    const endIdx = this._timeScale.endIndex;
    if (startIdx !== this._lastVisibleStart || endIdx !== this._lastVisibleEnd) {
      this._lastVisibleStart = startIdx;
      this._lastVisibleEnd = endIdx;
      if (!this._animatingRange) {
        const range = this.getVisibleRange();
        if (range) this._emit("visibleRangeChange", range);
      }
    }
  }

  private _updateAriaLabel(): void {
    this._aria?.updateLabel(
      this._canvas,
      this._chartType,
      this._data.candleCount,
      this._data.getAllSeries().length,
    );
  }

  /**
   * Recompute and apply the time-scale layout (virtual coords + session gaps)
   * based on the currently-loaded candles and the resolved `sessionGaps`
   * options. Called automatically after `setCandles`.
   *
   * - `mode: "timeGap"` (default): time-proportional layout via
   *   `setTimeProportional` — bars sit at their wall-clock positions within a
   *   session and session breaks compress to `sizeBars` bar-widths.
   * - `mode: "dayBoundary"`: legacy fixed gap at each UTC day change via
   *   `setGapsBefore` (no time-proportional within-session spacing).
   * - `mode: "off"`: disable virtual coords (index-based layout).
   */
  private _applySessionGaps(): void {
    const opts = this._sessionGapsOpts;
    if (opts.mode === "off") {
      this._timeScale.clearGaps();
      return;
    }
    const candles = this._data.candles;
    if (candles.length < 3) {
      this._timeScale.clearGaps();
      return;
    }
    const median = medianBarInterval(candles);
    if (median > opts.intradayThresholdMs) {
      this._timeScale.clearGaps();
      return;
    }
    if (opts.mode === "timeGap") {
      // Time-proportional layout. Threshold for compressing a large delta:
      // explicit gapThresholdMs wins; otherwise 4h (well above any intra-session
      // gap like a 1h lunch break, well below overnight).
      const threshold = opts.gapThresholdMs > 0 ? opts.gapThresholdMs : 4 * 60 * 60 * 1000;
      const times: number[] = new Array(candles.length);
      for (let i = 0; i < candles.length; i++) times[i] = candles[i].time;
      this._timeScale.setTimeProportional(times, {
        medianMs: median,
        sessionThresholdMs: threshold,
        sessionGapBars: opts.sizeBars,
      });
      return;
    }
    // Legacy dayBoundary path.
    const gaps = computeSessionGaps(candles, median, opts);
    this._timeScale.setGapsBefore(gaps);
  }
}

// ============================================
// Session gap helpers
// ============================================

type ResolvedSessionGapsOptions = Required<SessionGapsOptions>;

function resolveSessionGapsOptions(
  input: boolean | SessionGapsOptions | undefined,
): ResolvedSessionGapsOptions {
  if (!input) {
    return {
      mode: "off",
      sizeBars: 1,
      intradayThresholdMs: 6 * 60 * 60 * 1000,
      gapThresholdMs: 0,
    };
  }
  const opts: SessionGapsOptions = input === true ? {} : input;
  return {
    mode: opts.mode ?? "timeGap",
    sizeBars: opts.sizeBars ?? 1,
    intradayThresholdMs: opts.intradayThresholdMs ?? 6 * 60 * 60 * 1000,
    gapThresholdMs: opts.gapThresholdMs ?? 0,
  };
}

function medianBarInterval(candles: readonly CandleData[]): number {
  const deltas: number[] = [];
  const stride = Math.max(1, Math.floor(candles.length / 64));
  for (let i = stride; i < candles.length; i += stride) {
    const d = candles[i].time - candles[i - stride].time;
    if (d > 0) deltas.push(d / stride);
  }
  if (deltas.length === 0) return Number.POSITIVE_INFINITY;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
}

function computeSessionGaps(
  candles: readonly CandleData[],
  medianMs: number,
  opts: ResolvedSessionGapsOptions,
): Array<{ index: number; size: number }> {
  const gaps: Array<{ index: number; size: number }> = [];
  if (opts.mode === "timeGap") {
    const threshold = opts.gapThresholdMs > 0 ? opts.gapThresholdMs : medianMs * 2;
    for (let i = 1; i < candles.length; i++) {
      const delta = candles[i].time - candles[i - 1].time;
      if (delta > threshold) {
        gaps.push({ index: i, size: opts.sizeBars });
      }
    }
  } else if (opts.mode === "dayBoundary") {
    // Compare UTC calendar day between consecutive bars so cross-timezone
    // data (e.g. US stocks viewed from Asia) still gets sensible boundaries
    // — US/Asian/EU sessions all fit within a single UTC day.
    let prevDay = -1;
    for (let i = 0; i < candles.length; i++) {
      const d = new Date(candles[i].time);
      const day = d.getUTCFullYear() * 10000 + d.getUTCMonth() * 100 + d.getUTCDate();
      if (prevDay >= 0 && day !== prevDay) {
        gaps.push({ index: i, size: opts.sizeBars });
      }
      prevDay = day;
    }
  }
  return gaps;
}
