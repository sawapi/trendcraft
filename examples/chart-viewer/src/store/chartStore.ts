/**
 * Zustand store for chart state management
 */

import type { BacktestResult, NormalizedCandle } from "trendcraft";
import { create } from "zustand";
import type {
  BacktestConfig,
  ChartActions,
  ChartState,
  FundamentalData,
  IndicatorParams,
  OverlayType,
  SignalType,
  SubChartType,
  Timeframe,
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

// Load sidebar collapsed state from localStorage
const getInitialSidebarCollapsed = (): boolean => {
  try {
    const stored = localStorage.getItem("chart-viewer-sidebar-collapsed");
    return stored === "true";
  } catch {
    return false;
  }
};

export const useChartStore = create<ChartStore>((set, get) => ({
  // Initial state
  rawCandles: [],
  currentCandles: [],
  fileName: "",
  fundamentals: null,
  timeframe: "daily",
  enabledIndicators: [],
  enabledOverlays: [],
  enabledSignals: [],
  zoomRange: { start: 0, end: 100 },
  indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
  sidebarCollapsed: getInitialSidebarCollapsed(),
  backtestConfig: { ...DEFAULT_BACKTEST_CONFIG },
  backtestResult: null,
  isBacktestRunning: false,

  // Actions
  loadCandles: (candles: NormalizedCandle[], fundamentals: FundamentalData | null, fileName: string) => {
    const { timeframe } = get();
    const currentCandles = convertTimeframe(candles, timeframe);

    set({
      rawCandles: candles,
      currentCandles,
      fileName,
      fundamentals,
      zoomRange: { start: 0, end: 100 },
      backtestResult: null,
    });

    // Debug log for Phase 1 verification
    console.log("[chartStore] Loaded candles:", {
      fileName,
      rawCount: candles.length,
      currentCount: currentCandles.length,
      timeframe,
      firstCandle: candles[0],
      lastCandle: candles[candles.length - 1],
      hasFundamentals: fundamentals !== null,
    });
  },

  setTimeframe: (timeframe: Timeframe) => {
    const { rawCandles } = get();
    const currentCandles = convertTimeframe(rawCandles, timeframe);

    set({
      timeframe,
      currentCandles,
      backtestResult: null,
    });
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

  setBacktestConfig: (config: Partial<BacktestConfig>) => {
    const { backtestConfig } = get();
    set({ backtestConfig: { ...backtestConfig, ...config } });
  },

  setBacktestResult: (result: BacktestResult | null) => {
    set({ backtestResult: result });
  },

  setIsBacktestRunning: (running: boolean) => {
    set({ isBacktestRunning: running });
  },

  clearBacktest: () => {
    set({ backtestResult: null });
  },

  toggleSidebar: () => {
    const { sidebarCollapsed } = get();
    const newValue = !sidebarCollapsed;
    try {
      localStorage.setItem("chart-viewer-sidebar-collapsed", String(newValue));
    } catch {
      // Ignore localStorage errors
    }
    set({ sidebarCollapsed: newValue });
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    try {
      localStorage.setItem("chart-viewer-sidebar-collapsed", String(collapsed));
    } catch {
      // Ignore localStorage errors
    }
    set({ sidebarCollapsed: collapsed });
  },

  reset: () => {
    set({
      rawCandles: [],
      currentCandles: [],
      fileName: "",
      fundamentals: null,
      timeframe: "daily",
      enabledIndicators: [],
      enabledOverlays: [],
      enabledSignals: [],
      zoomRange: { start: 0, end: 100 },
      indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
      sidebarCollapsed: getInitialSidebarCollapsed(),
      backtestConfig: { ...DEFAULT_BACKTEST_CONFIG },
      backtestResult: null,
      isBacktestRunning: false,
    });
  },
}));
