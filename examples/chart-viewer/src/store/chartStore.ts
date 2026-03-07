/**
 * Zustand store for chart state management
 */

import type { BacktestResult, NormalizedCandle } from "trendcraft";
import { create } from "zustand";
import type {
  BacktestConfig,
  ChartActions,
  ChartState,
  DisplayStartYears,
  FundamentalData,
  IndicatorParams,
  IndicatorPreset,
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
  sidebarCollapsed: getInitialSidebarCollapsed(),
  presets: getInitialPresets(),
  backtestConfig: { ...DEFAULT_BACKTEST_CONFIG },
  backtestResult: null,
  isBacktestRunning: false,

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
    });
  },

  setTimeframe: (timeframe: Timeframe) => {
    const { rawCandles, fundamentals, displayStartYears } = get();
    const computed = recomputeCandles(rawCandles, fundamentals, displayStartYears, timeframe);

    set({ timeframe, ...computed, backtestResult: null });
  },

  setDisplayStartYears: (years: DisplayStartYears) => {
    const { rawCandles, fundamentals, timeframe } = get();
    writeStorage("chart-viewer-display-start-years", String(years));
    const computed = recomputeCandles(rawCandles, fundamentals, years, timeframe);

    set({ displayStartYears: years, ...computed, backtestResult: null });
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

  setIsBacktestRunning: (running: boolean) => {
    set({ isBacktestRunning: running });
  },

  clearBacktest: () => {
    set({ backtestResult: null });
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
      isBacktestRunning: false,
    });
  },
}));
