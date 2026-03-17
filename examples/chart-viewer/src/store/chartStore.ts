/**
 * Zustand store for chart state management
 */

import type { BacktestResult, NormalizedCandle, PatternSignal } from "trendcraft";
import { create } from "zustand";
import type {
  BacktestConfig,
  ChartActions,
  ChartState,
  ComparisonSymbol,
  DisplayStartYears,
  Drawing,
  DrawingToolType,
  FundamentalData,
  IndicatorParams,
  IndicatorPreset,
  OverlayType,
  SignalType,
  SubChartType,
  ThemeType,
  Timeframe,
  YAxisType,
  ZoomRange,
} from "../types";
import { DEFAULT_INDICATOR_PARAMS } from "../types";

type ChartStore = ChartState & ChartActions;

/**
 * Default backtest configuration
 */
const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  entryCondition: "gc",
  exitCondition: "dc",
  capital: 1000000,
  stopLoss: undefined,
  takeProfit: undefined,
  trailingStop: undefined,
  atrTrailMultiplier: undefined,
  atrTrailPeriod: 14,
  partialThreshold: undefined,
  partialSellPercent: 50,
  startDate: undefined,
  commissionRate: 0,
  taxRate: 0,
};

/**
 * Convert daily candles to weekly candles
 */
function toWeeklyCandles(candles: NormalizedCandle[]): NormalizedCandle[] {
  if (candles.length === 0) return [];

  const weekly: NormalizedCandle[] = [];
  let current: NormalizedCandle | null = null;

  for (const candle of candles) {
    const date = new Date(candle.time);
    const dayOfWeek = date.getDay();

    // Start new week on Monday (1) or if no current
    if (!current || dayOfWeek === 1) {
      if (current) {
        weekly.push(current);
      }
      current = { ...candle };
    } else {
      // Aggregate within week
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume;
    }
  }

  if (current) {
    weekly.push(current);
  }

  return weekly;
}

/**
 * Convert daily candles to monthly candles
 */
function toMonthlyCandles(candles: NormalizedCandle[]): NormalizedCandle[] {
  if (candles.length === 0) return [];

  const monthly: NormalizedCandle[] = [];
  let current: NormalizedCandle | null = null;
  let currentMonth = -1;

  for (const candle of candles) {
    const date = new Date(candle.time);
    const month = date.getMonth();

    if (month !== currentMonth) {
      if (current) {
        monthly.push(current);
      }
      current = { ...candle };
      currentMonth = month;
    } else if (current) {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume;
    }
  }

  if (current) {
    monthly.push(current);
  }

  return monthly;
}

/**
 * Convert candles based on timeframe
 */
function convertTimeframe(candles: NormalizedCandle[], timeframe: Timeframe): NormalizedCandle[] {
  switch (timeframe) {
    case "weekly":
      return toWeeklyCandles(candles);
    case "monthly":
      return toMonthlyCandles(candles);
    default:
      return candles;
  }
}

/**
 * Read a string value from localStorage, returning null on failure
 */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a value to localStorage, silently ignoring errors
 */
function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage errors
  }
}

function getInitialSidebarCollapsed(): boolean {
  return readStorage("chart-viewer-sidebar-collapsed") === "true";
}

function getInitialTheme(): ThemeType {
  const stored = readStorage("chart-viewer-theme");
  return stored === "light" ? "light" : "dark";
}

function getInitialYAxisType(): YAxisType {
  const stored = readStorage("chart-viewer-yaxis-type");
  return stored === "log" ? "log" : "value";
}

function getInitialDrawings(): Drawing[] {
  const stored = readStorage("chart-viewer-drawings");
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function persistDrawings(drawings: Drawing[]): void {
  writeStorage("chart-viewer-drawings", JSON.stringify(drawings));
}

function getInitialPresets(): IndicatorPreset[] {
  const stored = readStorage("chart-viewer-presets");
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function persistPresets(presets: IndicatorPreset[]): void {
  writeStorage("chart-viewer-presets", JSON.stringify(presets));
}

function getInitialDisplayStartYears(): DisplayStartYears {
  const stored = readStorage("chart-viewer-display-start-years");
  if (stored === null || stored === "null") return 10;
  const parsed = Number.parseInt(stored, 10);
  if (parsed === 5 || parsed === 10 || parsed === 20) return parsed;
  return 10;
}

/**
 * Filter candles and fundamentals to only include data from the last N years
 */
function filterDataByYears(
  candles: NormalizedCandle[],
  fundamentals: FundamentalData | null,
  years: DisplayStartYears,
): { candles: NormalizedCandle[]; fundamentals: FundamentalData | null } {
  if (years === null || candles.length === 0) {
    return { candles, fundamentals };
  }

  const now = Date.now();
  const yearsInMs = years * 365 * 24 * 60 * 60 * 1000;
  const cutoffTime = now - yearsInMs;

  // Collect filtered indices and candles
  const filteredIndices: number[] = [];
  const filteredCandles: NormalizedCandle[] = [];

  candles.forEach((c, i) => {
    if (c.time >= cutoffTime) {
      filteredIndices.push(i);
      filteredCandles.push(c);
    }
  });

  // Filter fundamentals with the same indices
  let filteredFundamentals: FundamentalData | null = null;
  if (fundamentals) {
    filteredFundamentals = {
      per: filteredIndices.map((i) => fundamentals.per[i]),
      pbr: filteredIndices.map((i) => fundamentals.pbr[i]),
    };
  }

  return { candles: filteredCandles, fundamentals: filteredFundamentals };
}

/**
 * Calculate initial zoom range to show last N days (default: 6 months = 120 trading days)
 */
function calculateInitialZoom(candleCount: number, days = 120): ZoomRange {
  if (candleCount === 0 || days >= candleCount) {
    return { start: 0, end: 100 };
  }
  const start = Math.max(0, 100 - (days / candleCount) * 100);
  return { start, end: 100 };
}

/**
 * Filter candles by year range, convert to timeframe, and compute initial zoom.
 * Shared pipeline used by loadCandles, setTimeframe, and setDisplayStartYears.
 */
function recomputeCandles(
  rawCandles: NormalizedCandle[],
  fundamentals: FundamentalData | null,
  years: DisplayStartYears,
  timeframe: Timeframe,
): {
  currentCandles: NormalizedCandle[];
  currentFundamentals: FundamentalData | null;
  zoomRange: ZoomRange;
} {
  const filtered = filterDataByYears(rawCandles, fundamentals, years);
  const currentCandles = convertTimeframe(filtered.candles, timeframe);
  const zoomRange = calculateInitialZoom(currentCandles.length, 120);
  return { currentCandles, currentFundamentals: filtered.fundamentals, zoomRange };
}

export const useChartStore = create<ChartStore>((set, get) => ({
  // Initial state
  rawCandles: [],
  currentCandles: [],
  fileName: "",
  fundamentals: null,
  currentFundamentals: null,
  timeframe: "daily",
  displayStartYears: getInitialDisplayStartYears(),
  enabledIndicators: [],
  enabledOverlays: [],
  enabledSignals: [],
  zoomRange: { start: 0, end: 100 },
  indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
  yAxisType: getInitialYAxisType(),
  yAxisPercent: false,
  theme: getInitialTheme(),
  activeDrawingTool: "cursor" as DrawingToolType,
  pendingPoint: null,
  drawings: getInitialDrawings(),
  drawingHistory: [],
  drawingHistoryIndex: -1,
  selectedDrawingId: null,
  hoveredDataIndex: null,
  comparisonSymbols: [],
  subchartHeights: {},
  sidebarCollapsed: getInitialSidebarCollapsed(),
  presets: getInitialPresets(),
  backtestConfig: { ...DEFAULT_BACKTEST_CONFIG },
  backtestResult: null,
  tradeAnalysis: null,
  isBacktestRunning: false,
  explainBar: null,
  replayPattern: null,
  replayEndIndex: null,

  // Actions
  loadCandles: (
    candles: NormalizedCandle[],
    fundamentals: FundamentalData | null,
    fileName: string,
  ) => {
    const { timeframe, displayStartYears } = get();
    const computed = recomputeCandles(candles, fundamentals, displayStartYears, timeframe);

    set({
      rawCandles: candles,
      fileName,
      fundamentals,
      ...computed,
      backtestResult: null,
      tradeAnalysis: null,
    });
  },

  setTimeframe: (timeframe: Timeframe) => {
    const { rawCandles, fundamentals, displayStartYears } = get();
    const computed = recomputeCandles(rawCandles, fundamentals, displayStartYears, timeframe);

    set({ timeframe, ...computed, backtestResult: null, tradeAnalysis: null });
  },

  setDisplayStartYears: (years: DisplayStartYears) => {
    const { rawCandles, fundamentals, timeframe } = get();
    writeStorage("chart-viewer-display-start-years", String(years));
    const computed = recomputeCandles(rawCandles, fundamentals, years, timeframe);

    set({ displayStartYears: years, ...computed, backtestResult: null, tradeAnalysis: null });
  },

  setEnabledIndicators: (indicators: SubChartType[]) => {
    set({ enabledIndicators: indicators });
  },

  setEnabledOverlays: (overlays: OverlayType[]) => {
    set({ enabledOverlays: overlays });
  },

  setEnabledSignals: (signals: SignalType[]) => {
    set({ enabledSignals: signals });
  },

  toggleSignal: (signal: SignalType) => {
    const { enabledSignals } = get();
    if (enabledSignals.includes(signal)) {
      set({ enabledSignals: enabledSignals.filter((s) => s !== signal) });
    } else {
      set({ enabledSignals: [...enabledSignals, signal] });
    }
  },

  setZoomRange: (range: ZoomRange) => {
    set({ zoomRange: range });
  },

  setIndicatorParams: (params: Partial<IndicatorParams>) => {
    const { indicatorParams } = get();
    set({ indicatorParams: { ...indicatorParams, ...params } });
  },

  resetIndicatorParams: () => {
    set({ indicatorParams: { ...DEFAULT_INDICATOR_PARAMS } });
  },

  savePreset: (name: string) => {
    const { indicatorParams, enabledOverlays, enabledIndicators, presets } = get();
    const newPreset: IndicatorPreset = {
      name,
      params: { ...indicatorParams },
      overlays: [...enabledOverlays],
      indicators: [...enabledIndicators],
    };
    // Replace existing preset with same name, or append
    const updated = presets.filter((p) => p.name !== name).concat(newPreset);
    persistPresets(updated);
    set({ presets: updated });
  },

  loadPreset: (name: string) => {
    const { presets } = get();
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    set({
      indicatorParams: { ...preset.params },
      enabledOverlays: [...preset.overlays],
      enabledIndicators: [...preset.indicators],
    });
  },

  deletePreset: (name: string) => {
    const { presets } = get();
    const updated = presets.filter((p) => p.name !== name);
    persistPresets(updated);
    set({ presets: updated });
  },

  setBacktestConfig: (config: Partial<BacktestConfig>) => {
    const { backtestConfig } = get();
    set({ backtestConfig: { ...backtestConfig, ...config } });
  },

  setBacktestResult: (result: BacktestResult | null) => {
    set({ backtestResult: result });
  },

  setTradeAnalysis: (analysis) => {
    set({ tradeAnalysis: analysis });
  },

  setIsBacktestRunning: (running: boolean) => {
    set({ isBacktestRunning: running });
  },

  clearBacktest: () => {
    set({ backtestResult: null, tradeAnalysis: null });
  },

  toggleSidebar: () => {
    const newValue = !get().sidebarCollapsed;
    writeStorage("chart-viewer-sidebar-collapsed", String(newValue));
    set({ sidebarCollapsed: newValue });
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    writeStorage("chart-viewer-sidebar-collapsed", String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  reset: () => {
    set({
      rawCandles: [],
      currentCandles: [],
      fileName: "",
      fundamentals: null,
      currentFundamentals: null,
      timeframe: "daily",
      displayStartYears: getInitialDisplayStartYears(),
      enabledIndicators: [],
      enabledOverlays: [],
      enabledSignals: [],
      zoomRange: { start: 0, end: 100 },
      indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
      sidebarCollapsed: getInitialSidebarCollapsed(),
      backtestConfig: { ...DEFAULT_BACKTEST_CONFIG },
      backtestResult: null,
      tradeAnalysis: null,
      isBacktestRunning: false,
      explainBar: null,
      replayPattern: null,
      replayEndIndex: null,
      drawings: [],
      drawingHistory: [],
      drawingHistoryIndex: -1,
      activeDrawingTool: "cursor" as DrawingToolType,
      pendingPoint: null,
      selectedDrawingId: null,
      comparisonSymbols: [],
      subchartHeights: {},
    });
  },

  // Y-axis
  setYAxisType: (type: YAxisType) => {
    writeStorage("chart-viewer-yaxis-type", type);
    set({ yAxisType: type });
  },

  setYAxisPercent: (percent: boolean) => {
    set({ yAxisPercent: percent });
  },

  // Theme
  setTheme: (theme: ThemeType) => {
    writeStorage("chart-viewer-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  // Drawing tools
  setActiveDrawingTool: (tool: DrawingToolType) => {
    set({ activeDrawingTool: tool, pendingPoint: null });
  },

  setPendingPoint: (point) => {
    set({ pendingPoint: point });
  },

  addDrawing: (drawing: Drawing) => {
    const { drawings, drawingHistory, drawingHistoryIndex } = get();
    const newDrawings = [...drawings, drawing];
    // Truncate redo history
    const newHistory = [...drawingHistory.slice(0, drawingHistoryIndex + 1), [...drawings]];
    persistDrawings(newDrawings);
    set({
      drawings: newDrawings,
      drawingHistory: newHistory,
      drawingHistoryIndex: newHistory.length - 1,
    });
  },

  updateDrawing: (id: string, updates: Partial<Drawing>) => {
    const { drawings } = get();
    const newDrawings = drawings.map((d) => (d.id === id ? ({ ...d, ...updates } as Drawing) : d));
    persistDrawings(newDrawings);
    set({ drawings: newDrawings });
  },

  removeDrawing: (id: string) => {
    const { drawings, drawingHistory, drawingHistoryIndex } = get();
    const newDrawings = drawings.filter((d) => d.id !== id);
    const newHistory = [...drawingHistory.slice(0, drawingHistoryIndex + 1), [...drawings]];
    persistDrawings(newDrawings);
    set({
      drawings: newDrawings,
      drawingHistory: newHistory,
      drawingHistoryIndex: newHistory.length - 1,
    });
  },

  clearDrawings: () => {
    const { drawings, drawingHistory, drawingHistoryIndex } = get();
    const newHistory = [...drawingHistory.slice(0, drawingHistoryIndex + 1), [...drawings]];
    persistDrawings([]);
    set({
      drawings: [],
      drawingHistory: newHistory,
      drawingHistoryIndex: newHistory.length - 1,
    });
  },

  undoDrawing: () => {
    const { drawingHistory, drawingHistoryIndex } = get();
    if (drawingHistoryIndex < 0) return;
    const prevDrawings = drawingHistory[drawingHistoryIndex];
    persistDrawings(prevDrawings);
    set({
      drawings: prevDrawings,
      drawingHistoryIndex: drawingHistoryIndex - 1,
    });
  },

  redoDrawing: () => {
    const { drawingHistory, drawingHistoryIndex, drawings } = get();
    if (drawingHistoryIndex >= drawingHistory.length - 1) return;
    const nextIndex = drawingHistoryIndex + 1;
    // The next state is the one *after* the snapshot at nextIndex
    const nextDrawings =
      nextIndex + 1 < drawingHistory.length ? drawingHistory[nextIndex + 1] : drawings;
    persistDrawings(nextDrawings);
    set({
      drawings: nextDrawings,
      drawingHistoryIndex: nextIndex,
    });
  },

  selectDrawing: (id: string | null) => {
    set({ selectedDrawingId: id });
  },

  setHoveredDataIndex: (index: number | null) => {
    set({ hoveredDataIndex: index });
  },

  addComparison: (symbol: ComparisonSymbol) => {
    const { comparisonSymbols } = get();
    if (comparisonSymbols.length >= 4) return;
    if (comparisonSymbols.some((c) => c.symbol === symbol.symbol)) return;
    set({ comparisonSymbols: [...comparisonSymbols, symbol] });
  },

  removeComparison: (symbol: string) => {
    const { comparisonSymbols } = get();
    set({ comparisonSymbols: comparisonSymbols.filter((c) => c.symbol !== symbol) });
  },

  clearComparisons: () => {
    set({ comparisonSymbols: [] });
  },

  // Subchart heights
  setSubchartHeight: (key: string, height: number) => {
    const { subchartHeights } = get();
    set({ subchartHeights: { ...subchartHeights, [key]: height } });
  },

  // Explain bar
  setExplainBar: (barIndex: number | null) => {
    set({ explainBar: barIndex !== null ? { barIndex } : null });
  },

  // Pattern replay
  setReplayPattern: (pattern: PatternSignal | null) => {
    set({ replayPattern: pattern, replayEndIndex: null });
  },

  setReplayEndIndex: (index: number | null) => {
    set({ replayEndIndex: index });
  },
}));
