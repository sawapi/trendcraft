/**
 * The main ChartInstance interface — the runtime API surface returned by
 * `createChart`.
 */

import type { ChartOptions, ChartType, RangeDuration } from "./config";
import type { Drawing, DrawingType } from "./drawing";
import type { ChartEvent, VisibleRangeChangeData } from "./event";
import type { CandleData, DataPoint, TimeValue } from "./fundamental";
import type {
  BacktestResultData,
  ChartPatternSignal,
  SeriesInfo,
  SignalMarker,
  TimeframeOverlay,
  TradeMarker,
} from "./integration";
import type { LayoutConfig } from "./pane";
import type { SeriesConfig, SeriesHandle } from "./series";
import type { ThemeColors } from "./theme";

export type ChartInstance = {
  // Data
  setCandles(candles: CandleData[]): void;
  updateCandle(candle: CandleData): void;
  /** Batch multiple updates into a single render frame.
   *  All mutations inside `fn` are deferred until the batch ends. */
  batchUpdates(fn: () => void): void;

  // Indicators (Series<T> native)
  addIndicator<T>(series: DataPoint<T>[], config?: SeriesConfig): SeriesHandle;

  // Series query
  getAllSeries(): SeriesInfo[];
  getVisibleRange(): VisibleRangeChangeData | null;

  // Signals & Trades
  addSignals(signals: SignalMarker[]): void;
  addTrades(trades: TradeMarker[]): void;

  // Drawings
  addDrawing(drawing: Drawing): void;
  removeDrawing(id: string): void;
  getDrawings(): Drawing[];

  // Drawing tool mode
  setDrawingTool(tool: DrawingType | null): void;

  // Multi-timeframe
  addTimeframe(overlay: TimeframeOverlay): void;
  removeTimeframe(id: string): void;

  // Backtest visualization (trendcraft integration)
  addBacktest(result: BacktestResultData): void;

  // Pattern visualization
  addPatterns(patterns: ChartPatternSignal[]): void;

  // Score heatmap
  addScores(scores: DataPoint<number | null>[]): void;

  // Layout
  setLayout(layout: LayoutConfig): void;

  // Viewport
  setVisibleRange(start: TimeValue, end: TimeValue): void;
  setVisibleRangeByDuration(duration: RangeDuration): void;
  fitContent(): void;

  /**
   * Programmatically set or clear the crosshair position by time value.
   * Used by `syncCharts()` to mirror the crosshair across multiple chart instances.
   * Pass `null` to hide the crosshair.
   */
  setCrosshair(time: TimeValue | null): void;

  // Events
  on<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void;
  off<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void;

  // Theme & Chart Type
  setTheme(theme: "dark" | "light" | ThemeColors): void;
  setChartType(type: ChartType): void;

  // Volume pane visibility
  /** Show or hide the volume pane */
  setShowVolume(show: boolean): void;

  /**
   * Apply a partial options update at runtime.
   *
   * Accepts the same shape as `createChart`'s options, but applies only the
   * provided fields. Use this from reactive wrappers to propagate option
   * changes after chart creation. Fields that cannot be changed at runtime
   * (e.g. `pixelRatio`, `fontFamily`, `scrollSensitivity`, `locale`,
   * `formatInfoOverlay`) emit a warning via the `error` event and are ignored.
   */
  applyOptions(options: Partial<ChartOptions>): void;

  // Plugins
  /** Register a custom series renderer plugin */
  registerRenderer<TConfig>(plugin: import("../plugin-types").SeriesRendererPlugin<TConfig>): void;
  /** Register a pane primitive plugin */
  registerPrimitive<TState>(plugin: import("../plugin-types").PrimitivePlugin<TState>): void;
  /** Remove a primitive by name */
  removePrimitive(name: string): void;

  // Extensibility
  /** Register a custom introspection rule for shape detection */
  addRule(rule: import("../series-registry").IntrospectionRule): void;
  /** Register a visual preset (colors, lineWidth, etc.) for a rule name */
  addPreset(
    name: string,
    preset: import("../../integration/indicator-presets").IndicatorPreset,
  ): void;

  // Export
  toImage(type?: string, quality?: number, timeoutMs?: number): Promise<Blob>;

  // Lifecycle
  resize(width: number, height: number): void;
  destroy(): void;
};
