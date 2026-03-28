/**
 * Core type definitions for @trendcraft/chart
 */

// ============================================
// Fundamental Types
// ============================================

/** Epoch milliseconds — matches trendcraft convention */
export type TimeValue = number;

/** Generic data point (compatible with trendcraft Series<T>) */
export type DataPoint<T = number | null> = {
  time: TimeValue;
  value: T;
};

/** OHLCV candle data */
export type CandleData = {
  time: TimeValue;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ============================================
// Theme Types
// ============================================

export type ThemeColors = {
  background: string;
  text: string;
  textSecondary: string;
  grid: string;
  border: string;
  crosshair: string;
  upColor: string;
  downColor: string;
  upWick: string;
  downWick: string;
  volumeUp: string;
  volumeDown: string;
};

export const DARK_THEME: ThemeColors = {
  background: "#131722",
  text: "#d1d4dc",
  textSecondary: "#787b86",
  grid: "#1e222d",
  border: "#2a2e39",
  crosshair: "#758696",
  upColor: "#26a69a",
  downColor: "#ef5350",
  upWick: "#26a69a",
  downWick: "#ef5350",
  volumeUp: "rgba(38,166,154,0.3)",
  volumeDown: "rgba(239,83,80,0.3)",
};

export const LIGHT_THEME: ThemeColors = {
  background: "#ffffff",
  text: "#131722",
  textSecondary: "#787b86",
  grid: "#f0f3fa",
  border: "#e0e3eb",
  crosshair: "#9598a1",
  upColor: "#26a69a",
  downColor: "#ef5350",
  upWick: "#26a69a",
  downWick: "#ef5350",
  volumeUp: "rgba(38,166,154,0.3)",
  volumeDown: "rgba(239,83,80,0.3)",
};

// ============================================
// Chart Configuration
// ============================================

export type ChartOptions = {
  /** Chart width in pixels (default: container width) */
  width?: number;
  /** Chart height in pixels (default: 400) */
  height?: number;
  /** Color theme */
  theme?: "dark" | "light" | ThemeColors;
  /** Device pixel ratio (default: window.devicePixelRatio) */
  pixelRatio?: number;
  /** Right margin for price axis in pixels (default: 60) */
  priceAxisWidth?: number;
  /** Bottom margin for time axis in pixels (default: 24) */
  timeAxisHeight?: number;
  /** Font family (default: system) */
  fontFamily?: string;
  /** Font size in pixels (default: 11) */
  fontSize?: number;
  /** Custom price formatter (default: auto-precision) */
  priceFormatter?: (price: number) => string;
  /** Custom time formatter (default: smart date/time) */
  timeFormatter?: (time: number) => string;
  /** Watermark text displayed in chart background */
  watermark?: string;
  /** Show legend widget (default: true) */
  legend?: boolean;
  /** Show volume pane (default: true) */
  volume?: boolean;
  /** Scroll/pan sensitivity multiplier (default: 0.3, lower = slower) */
  scrollSensitivity?: number;
  /** Base chart type for price data (default: 'candlestick') */
  chartType?: ChartType;
};

/** Base chart rendering type */
export type ChartType = "candlestick" | "line" | "mountain" | "ohlc";

// ============================================
// Pane Configuration
// ============================================

export type ScaleMode = "linear" | "log" | "percent";

export type PaneConfig = {
  /** Unique pane identifier */
  id: string;
  /** Flex proportion for height allocation */
  flex: number;
  /** Y-axis scale mode for right scale (default: "linear") */
  yScale?: ScaleMode;
  /** Fixed Y-axis range for right scale (e.g., [0, 100] for RSI) */
  yRange?: [number, number];
  /** Horizontal reference lines (e.g., [30, 70] for RSI) */
  referenceLines?: number[];
  /** Reference line color */
  referenceLineColor?: string;
  /** Left scale configuration (enables dual-scale mode when present) */
  leftScale?: {
    mode?: ScaleMode;
    range?: [number, number];
    referenceLines?: number[];
    referenceLineColor?: string;
  };
};

export type LayoutConfig = {
  /** Pane definitions */
  panes: PaneConfig[];
  /** Gap between panes in pixels (default: 4) */
  gap?: number;
  /** Show bottom scrollbar (default: true) */
  scrollbar?: boolean;
};

// ============================================
// Series Configuration
// ============================================

/** Built-in visual series types */
export type BuiltinSeriesType =
  | "line"
  | "area"
  | "histogram"
  | "band"
  | "cloud"
  | "marker"
  | "box"
  | "heatmap";

/** Visual series types (extensible via plugins) */
export type SeriesType = BuiltinSeriesType | (string & {});

export type SeriesConfig = {
  /** Target pane: 'main' (overlay) or a specific pane id. Omit for auto-detection via __meta. */
  pane?: "main" | string;
  /** Scale assignment: 'right' (default) or 'left' for dual-scale panes */
  scaleId?: "left" | "right";
  /** Override auto-detected series type */
  type?: SeriesType;
  /** Primary color */
  color?: string;
  /** Line width in pixels (default: 1.5) */
  lineWidth?: number;
  /** Display label */
  label?: string;
  /** Initial visibility (default: true) */
  visible?: boolean;
  /** Max height as fraction of pane (0-1). Expands scale range so data occupies at most this ratio of pane height. Useful for volume overlay. */
  maxHeightRatio?: number;
};

// ============================================
// Series Handle (returned by addIndicator)
// ============================================

export type SeriesHandle = {
  /** Unique series id */
  readonly id: string;
  /** Push a single data point (streaming). Accepts scalar or compound values. */
  update(point: DataPoint<unknown>): void;
  /** Replace all data */
  setData<T>(data: DataPoint<T>[]): void;
  /** Toggle visibility */
  setVisible(visible: boolean): void;
  /** Remove this series from the chart */
  remove(): void;
};

// ============================================
// Drawing Types
// ============================================

export type DrawingType = "hline" | "trendline" | "fibRetracement";

export type DrawingBase = {
  id: string;
  type: DrawingType;
  color?: string;
  lineWidth?: number;
};

export type HLineDrawing = DrawingBase & {
  type: "hline";
  price: number;
};

export type TrendLineDrawing = DrawingBase & {
  type: "trendline";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
};

export type FibRetracementDrawing = DrawingBase & {
  type: "fibRetracement";
  startTime: TimeValue;
  startPrice: number;
  endTime: TimeValue;
  endPrice: number;
  levels?: number[];
};

export type Drawing = HLineDrawing | TrendLineDrawing | FibRetracementDrawing;

// ============================================
// Multi-Timeframe Types
// ============================================

export type TimeframeOverlay = {
  /** Identifier for this timeframe overlay */
  id: string;
  /** Higher timeframe candle data */
  candles: CandleData[];
  /** Timeframe label (e.g., '1W', '1M') */
  timeframe: string;
  /** Candle body color (default: semi-transparent) */
  color?: string;
  /** Opacity (default: 0.15) */
  opacity?: number;
};

// ============================================
// Backtest Result (compatible with trendcraft BacktestResult)
// ============================================

export type BacktestResultData = {
  initialCapital: number;
  finalCapital: number;
  totalReturnPercent: number;
  tradeCount: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  trades: {
    entryTime: number;
    entryPrice: number;
    exitTime: number;
    exitPrice: number;
    returnPercent: number;
    direction?: string;
    exitReason?: string;
  }[];
  drawdownPeriods: {
    startTime: number;
    troughTime: number;
    recoveryTime?: number;
    maxDepthPercent: number;
    peakEquity: number;
    troughEquity: number;
  }[];
};

// ============================================
// Pattern Signal (compatible with trendcraft PatternSignal)
// ============================================

export type ChartPatternSignal = {
  time: number;
  type: string;
  pattern: {
    startTime: number;
    endTime: number;
    keyPoints: { time: number; index: number; price: number; label: string }[];
    neckline?: { startPrice: number; endPrice: number; slope: number; currentPrice: number };
    target?: number;
    stopLoss?: number;
    height?: number;
  };
  confidence: number;
  confirmed: boolean;
};

// ============================================
// Signal / Trade overlay types
// ============================================

export type SignalMarker = {
  time: TimeValue;
  type: "buy" | "sell";
  label?: string;
};

export type TradeMarker = {
  entryTime: TimeValue;
  entryPrice: number;
  exitTime: TimeValue;
  exitPrice: number;
  direction?: "long" | "short";
  returnPercent?: number;
  exitReason?: string;
};

// ============================================
// Event Types
// ============================================

export type ChartEvent =
  | "crosshairMove"
  | "visibleRangeChange"
  | "click"
  | "resize"
  | "paneResize"
  | "seriesAdded"
  | "seriesRemoved"
  | "dataFiltered";

export type CrosshairMoveData = {
  time: TimeValue | null;
  price: number | null;
  x: number;
  y: number;
  paneId: string;
};

export type VisibleRangeChangeData = {
  startTime: TimeValue;
  endTime: TimeValue;
  startIndex: number;
  endIndex: number;
};

// ============================================
// Chart Instance Interface
// ============================================

/** Summary info for a series */
export type SeriesInfo = {
  id: string;
  paneId: string;
  type: SeriesType;
  label: string;
  visible: boolean;
};

export type ChartInstance = {
  // Data
  setCandles(candles: CandleData[]): void;
  updateCandle(candle: CandleData): void;

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
  fitContent(): void;

  // Events
  on<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void;
  off<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void;

  // Theme & Chart Type
  setTheme(theme: "dark" | "light" | ThemeColors): void;
  setChartType(type: ChartType): void;

  // Volume pane visibility
  /** Show or hide the volume pane */
  setShowVolume(show: boolean): void;

  // Plugins
  /** Register a custom series renderer plugin */
  registerRenderer<TConfig>(plugin: import("./plugin-types").SeriesRendererPlugin<TConfig>): void;
  /** Register a pane primitive plugin */
  registerPrimitive<TState>(plugin: import("./plugin-types").PrimitivePlugin<TState>): void;
  /** Remove a primitive by name */
  removePrimitive(name: string): void;

  // Export
  toImage(type?: string, quality?: number): Promise<Blob>;

  // Lifecycle
  resize(width: number, height: number): void;
  destroy(): void;
};

// ============================================
// Internal Rendering Types
// ============================================

/** Computed pane dimensions (from layout engine) */
export type PaneRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: PaneConfig;
};

/** Computed series rendering info */
export type ResolvedSeries = {
  id: string;
  paneId: string;
  type: SeriesType;
  config: SeriesConfig;
  data: DataPoint<unknown>[];
  /** Decomposed numeric channels for compound types */
  channels: Map<string, (number | null)[]>;
};
