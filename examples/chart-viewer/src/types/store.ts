import type { BacktestResult, NormalizedCandle } from "trendcraft";
import type {
  BacktestConfig,
  DisplayStartYears,
  FundamentalData,
  OverlayType,
  SignalType,
  SubChartType,
  Timeframe,
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

  // UI state
  sidebarCollapsed: boolean;

  // Presets
  presets: IndicatorPreset[];

  // Backtest
  backtestConfig: BacktestConfig;
  backtestResult: BacktestResult | null;
  isBacktestRunning: boolean;
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
  setIsBacktestRunning: (running: boolean) => void;
  clearBacktest: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  reset: () => void;
}
