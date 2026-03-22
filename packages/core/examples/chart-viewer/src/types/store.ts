import type {
  BacktestResult,
  GridSearchResult,
  NormalizedCandle,
  PatternSignal,
  TradeAnalysis,
  WalkForwardResult,
} from "trendcraft";
import type {
  BacktestConfig,
  ComparisonSymbol,
  DisplayStartYears,
  Drawing,
  DrawingToolType,
  FundamentalData,
  OverlayType,
  SignalType,
  SubChartType,
  ThemeType,
  Timeframe,
  YAxisType,
  ZoomRange,
} from "./chart";
import type { IndicatorParams } from "./indicators";
import type { IndicatorPreset } from "./presets";

/**
 * Chart store state
 */
export interface ChartState {
  // Data
  rawCandles: NormalizedCandle[];
  currentCandles: NormalizedCandle[];
  fileName: string;
  fundamentals: FundamentalData | null;
  currentFundamentals: FundamentalData | null;

  // Display settings
  timeframe: Timeframe;
  displayStartYears: DisplayStartYears;
  enabledIndicators: SubChartType[];
  enabledOverlays: OverlayType[];
  enabledSignals: SignalType[];
  zoomRange: ZoomRange;
  indicatorParams: IndicatorParams;

  // Y-axis settings
  yAxisType: YAxisType;
  yAxisPercent: boolean;

  // Theme
  theme: ThemeType;

  // Drawing tools
  activeDrawingTool: DrawingToolType;
  drawings: Drawing[];
  drawingHistory: Drawing[][];
  drawingHistoryIndex: number;

  // Subchart heights (per indicator key)
  subchartHeights: Record<string, number>;

  // Drawing pending point (first click of a 2-click tool)
  pendingPoint: { dateIndex: number; price: number } | null;

  // Selected drawing for context menu / delete
  selectedDrawingId: string | null;

  // Crosshair hover index
  hoveredDataIndex: number | null;

  // Comparison mode
  comparisonSymbols: ComparisonSymbol[];

  // UI state
  sidebarCollapsed: boolean;

  // Presets
  presets: IndicatorPreset[];

  // Backtest
  backtestConfig: BacktestConfig;
  backtestResult: BacktestResult | null;
  tradeAnalysis: TradeAnalysis | null;
  isBacktestRunning: boolean;

  // Optimization results (shared with DNA panel)
  gridSearchResult: GridSearchResult | null;
  walkForwardResult: WalkForwardResult | null;

  // Explain bar
  explainBar: { barIndex: number } | null;

  // Pattern replay
  replayPattern: PatternSignal | null;
  replayEndIndex: number | null;

  // Recommended params to apply to optimization grid config
  pendingRecommendedParams: Record<string, number> | null;
}

/**
 * Chart store actions
 */
export interface ChartActions {
  loadCandles: (
    candles: NormalizedCandle[],
    fundamentals: FundamentalData | null,
    fileName: string,
  ) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setDisplayStartYears: (years: DisplayStartYears) => void;
  setEnabledIndicators: (indicators: SubChartType[]) => void;
  setEnabledOverlays: (overlays: OverlayType[]) => void;
  setEnabledSignals: (signals: SignalType[]) => void;
  toggleSignal: (signal: SignalType) => void;
  setZoomRange: (range: ZoomRange) => void;
  setIndicatorParams: (params: Partial<IndicatorParams>) => void;
  resetIndicatorParams: () => void;
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  deletePreset: (name: string) => void;
  setBacktestConfig: (config: Partial<BacktestConfig>) => void;
  setBacktestResult: (result: BacktestResult | null) => void;
  setTradeAnalysis: (analysis: TradeAnalysis | null) => void;
  setIsBacktestRunning: (running: boolean) => void;
  clearBacktest: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  reset: () => void;

  // Y-axis
  setYAxisType: (type: YAxisType) => void;
  setYAxisPercent: (percent: boolean) => void;

  // Theme
  setTheme: (theme: ThemeType) => void;

  // Drawing tools
  setActiveDrawingTool: (tool: DrawingToolType) => void;
  setPendingPoint: (point: { dateIndex: number; price: number } | null) => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  undoDrawing: () => void;
  redoDrawing: () => void;

  // Selected drawing
  selectDrawing: (id: string | null) => void;

  // Crosshair
  setHoveredDataIndex: (index: number | null) => void;

  // Comparison mode
  addComparison: (symbol: ComparisonSymbol) => void;
  removeComparison: (symbol: string) => void;
  clearComparisons: () => void;

  // Subchart heights
  setSubchartHeight: (key: string, height: number) => void;

  // Optimization results
  setGridSearchResult: (result: GridSearchResult | null) => void;
  setWalkForwardResult: (result: WalkForwardResult | null) => void;

  // Explain bar
  setExplainBar: (barIndex: number | null) => void;

  // Pattern replay
  setReplayPattern: (pattern: PatternSignal | null) => void;
  setReplayEndIndex: (index: number | null) => void;

  // Recommended params
  setPendingRecommendedParams: (params: Record<string, number> | null) => void;
}
