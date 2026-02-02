import type { BacktestResult, NormalizedCandle } from "trendcraft";

/**
 * Timeframe for chart display
 */
export type Timeframe = "daily" | "weekly" | "monthly";

/**
 * Signal types for visualization
 */
export type SignalType = "perfectOrder" | "rangeBound" | "cross";

/**
 * Subchart indicator types
 */
export type SubChartType =
  | "rsi"
  | "macd"
  | "stochastics"
  | "dmi"
  | "stochrsi"
  | "mfi"
  | "obv"
  | "cci"
  | "williams"
  | "roc"
  | "rangebound"
  | "cmf"
  | "volumeAnomaly"
  | "volumeProfile"
  | "volumeTrend"
  | "atr"
  | "per"
  | "pbr"
  | "roe";

/**
 * Fundamental data (PER/PBR from CSV)
 */
export interface FundamentalData {
  per: (number | null)[];
  pbr: (number | null)[];
}

/**
 * Overlay indicator types (displayed on main chart)
 */
export type OverlayType =
  | "sma5"
  | "sma25"
  | "sma75"
  | "ema12"
  | "ema26"
  | "wma20"
  | "bb"
  | "donchian"
  | "keltner"
  | "ichimoku"
  | "supertrend"
  | "psar"
  | "vwap"
  | "swingPoints"
  | "orderBlock"
  | "fvg"
  | "bos"
  | "choch"
  | "liquiditySweep";

/**
 * Subchart configuration
 */
export interface SubChartConfig {
  type: SubChartType;
  title: string;
  height: number;
  yAxisRange?: [number, number];
  markLines?: number[];
}

/**
 * Zoom range for dataZoom synchronization
 */
export interface ZoomRange {
  start: number;
  end: number;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  entryCondition: string;
  exitCondition: string;
  capital: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  atrTrailMultiplier?: number;
  atrTrailPeriod: number;
  partialThreshold?: number;
  partialSellPercent: number;
  startDate?: string;
  commissionRate: number;
  taxRate: number;
}

/**
 * Indicator parameter configuration
 */
export interface IndicatorParams {
  // Overlays - Moving Averages
  sma5Period: number;
  sma25Period: number;
  sma75Period: number;
  ema12Period: number;
  ema26Period: number;
  wma20Period: number;
  // Overlays - Bands
  bbPeriod: number;
  bbStdDev: number;
  donchianPeriod: number;
  keltnerEmaPeriod: number;
  keltnerAtrPeriod: number;
  keltnerMultiplier: number;
  // Overlays - Trend
  ichimokuTenkan: number;
  ichimokuKijun: number;
  ichimokuSenkou: number;
  ichimokuDisplacement: number;
  supertrendPeriod: number;
  supertrendMultiplier: number;
  psarStep: number;
  psarMax: number;
  // Subcharts
  rsiPeriod: number;
  macdFastPeriod: number;
  macdSlowPeriod: number;
  macdSignalPeriod: number;
  stochKPeriod: number;
  stochDPeriod: number;
  dmiPeriod: number;
  stochRsiRsiPeriod: number;
  stochRsiStochPeriod: number;
  stochRsiKPeriod: number;
  stochRsiDPeriod: number;
  mfiPeriod: number;
  cciPeriod: number;
  williamsPeriod: number;
  rocPeriod: number;
  cmfPeriod: number;
  volumeAnomalyPeriod: number;
  volumeAnomalyZScore: number;
  volumeProfilePeriod: number;
  volumeProfileLevels: number;
  volumeTrendPricePeriod: number;
  volumeTrendVolumePeriod: number;
  // ATR
  atrPeriod: number;
  // VWAP
  vwapResetPeriod: "session" | "rolling";
  vwapRollingPeriod: number;
  // Swing Points
  swingLeftBars: number;
  swingRightBars: number;
  // SMC - Order Block
  orderBlockSwingPeriod: number;
  orderBlockVolumePeriod: number;
  orderBlockMinVolumeRatio: number;
  orderBlockMaxActive: number;
  // SMC - Fair Value Gap
  fvgMinGapPercent: number;
  fvgMaxActive: number;
  // SMC - BOS/CHoCH
  bosSwingPeriod: number;
  // SMC - Liquidity Sweep
  liquiditySweepSwingPeriod: number;
  liquiditySweepMaxRecoveryBars: number;
}

/**
 * Default indicator parameters
 */
export const DEFAULT_INDICATOR_PARAMS: IndicatorParams = {
  // Overlays - Moving Averages
  sma5Period: 5,
  sma25Period: 25,
  sma75Period: 75,
  ema12Period: 12,
  ema26Period: 26,
  wma20Period: 20,
  // Overlays - Bands
  bbPeriod: 20,
  bbStdDev: 2,
  donchianPeriod: 20,
  keltnerEmaPeriod: 20,
  keltnerAtrPeriod: 10,
  keltnerMultiplier: 2,
  // Overlays - Trend
  ichimokuTenkan: 9,
  ichimokuKijun: 26,
  ichimokuSenkou: 52,
  ichimokuDisplacement: 26,
  supertrendPeriod: 10,
  supertrendMultiplier: 3,
  psarStep: 0.02,
  psarMax: 0.2,
  // Subcharts
  rsiPeriod: 14,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  stochKPeriod: 14,
  stochDPeriod: 3,
  dmiPeriod: 14,
  stochRsiRsiPeriod: 14,
  stochRsiStochPeriod: 14,
  stochRsiKPeriod: 3,
  stochRsiDPeriod: 3,
  mfiPeriod: 14,
  cciPeriod: 20,
  williamsPeriod: 14,
  rocPeriod: 12,
  cmfPeriod: 20,
  volumeAnomalyPeriod: 20,
  volumeAnomalyZScore: 2,
  volumeProfilePeriod: 100,
  volumeProfileLevels: 24,
  volumeTrendPricePeriod: 5,
  volumeTrendVolumePeriod: 20,
  // ATR
  atrPeriod: 14,
  // VWAP
  vwapResetPeriod: "rolling",
  vwapRollingPeriod: 20,
  // Swing Points
  swingLeftBars: 5,
  swingRightBars: 5,
  // SMC - Order Block
  orderBlockSwingPeriod: 5,
  orderBlockVolumePeriod: 20,
  orderBlockMinVolumeRatio: 1.0,
  orderBlockMaxActive: 10,
  // SMC - Fair Value Gap
  fvgMinGapPercent: 0,
  fvgMaxActive: 10,
  // SMC - BOS/CHoCH
  bosSwingPeriod: 5,
  // SMC - Liquidity Sweep
  liquiditySweepSwingPeriod: 5,
  liquiditySweepMaxRecoveryBars: 3,
};

/**
 * Parameter config for UI
 */
export interface ParamConfig {
  key: keyof IndicatorParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

/**
 * Parameter configurations for each indicator
 */
export const INDICATOR_PARAM_CONFIGS: Record<string, ParamConfig[]> = {
  // Overlays - Moving Averages
  sma5: [{ key: "sma5Period", label: "Period", min: 2, max: 200, step: 1 }],
  sma25: [{ key: "sma25Period", label: "Period", min: 2, max: 200, step: 1 }],
  sma75: [{ key: "sma75Period", label: "Period", min: 2, max: 200, step: 1 }],
  ema12: [{ key: "ema12Period", label: "Period", min: 2, max: 200, step: 1 }],
  ema26: [{ key: "ema26Period", label: "Period", min: 2, max: 200, step: 1 }],
  wma20: [{ key: "wma20Period", label: "Period", min: 2, max: 200, step: 1 }],
  // Overlays - Bands
  bb: [
    { key: "bbPeriod", label: "Period", min: 2, max: 100, step: 1 },
    { key: "bbStdDev", label: "Std Dev", min: 0.5, max: 4, step: 0.5 },
  ],
  donchian: [{ key: "donchianPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  keltner: [
    { key: "keltnerEmaPeriod", label: "EMA Period", min: 2, max: 100, step: 1 },
    { key: "keltnerAtrPeriod", label: "ATR Period", min: 2, max: 50, step: 1 },
    { key: "keltnerMultiplier", label: "Multiplier", min: 0.5, max: 5, step: 0.5 },
  ],
  // Overlays - Trend
  ichimoku: [
    { key: "ichimokuTenkan", label: "Tenkan", min: 5, max: 20, step: 1 },
    { key: "ichimokuKijun", label: "Kijun", min: 10, max: 60, step: 1 },
    { key: "ichimokuSenkou", label: "Senkou", min: 20, max: 120, step: 1 },
    { key: "ichimokuDisplacement", label: "Displacement", min: 10, max: 60, step: 1 },
  ],
  supertrend: [
    { key: "supertrendPeriod", label: "Period", min: 2, max: 50, step: 1 },
    { key: "supertrendMultiplier", label: "Multiplier", min: 1, max: 10, step: 0.5 },
  ],
  psar: [
    { key: "psarStep", label: "Step", min: 0.01, max: 0.1, step: 0.01 },
    { key: "psarMax", label: "Max", min: 0.1, max: 0.5, step: 0.05 },
  ],
  // Subcharts
  rsi: [{ key: "rsiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  macd: [
    { key: "macdFastPeriod", label: "Fast", min: 2, max: 50, step: 1 },
    { key: "macdSlowPeriod", label: "Slow", min: 2, max: 100, step: 1 },
    { key: "macdSignalPeriod", label: "Signal", min: 2, max: 50, step: 1 },
  ],
  stochastics: [
    { key: "stochKPeriod", label: "K Period", min: 2, max: 50, step: 1 },
    { key: "stochDPeriod", label: "D Period", min: 2, max: 20, step: 1 },
  ],
  dmi: [{ key: "dmiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  stochrsi: [
    { key: "stochRsiRsiPeriod", label: "RSI Period", min: 2, max: 50, step: 1 },
    { key: "stochRsiStochPeriod", label: "Stoch Period", min: 2, max: 50, step: 1 },
    { key: "stochRsiKPeriod", label: "K", min: 2, max: 20, step: 1 },
    { key: "stochRsiDPeriod", label: "D", min: 2, max: 20, step: 1 },
  ],
  mfi: [{ key: "mfiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  cci: [{ key: "cciPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  williams: [{ key: "williamsPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  roc: [{ key: "rocPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  cmf: [{ key: "cmfPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  volumeAnomaly: [
    { key: "volumeAnomalyPeriod", label: "Period", min: 5, max: 50, step: 1 },
    { key: "volumeAnomalyZScore", label: "Z-Score", min: 1, max: 4, step: 0.5 },
  ],
  volumeProfile: [
    { key: "volumeProfilePeriod", label: "Period", min: 20, max: 200, step: 10 },
    { key: "volumeProfileLevels", label: "Levels", min: 10, max: 50, step: 2 },
  ],
  volumeTrend: [
    { key: "volumeTrendPricePeriod", label: "Price Period", min: 2, max: 20, step: 1 },
    { key: "volumeTrendVolumePeriod", label: "Vol Period", min: 5, max: 50, step: 1 },
  ],
  atr: [{ key: "atrPeriod", label: "Period", min: 1, max: 50, step: 1 }],
  vwap: [{ key: "vwapRollingPeriod", label: "Rolling Period", min: 5, max: 100, step: 1 }],
  swingPoints: [
    { key: "swingLeftBars", label: "Left Bars", min: 1, max: 20, step: 1 },
    { key: "swingRightBars", label: "Right Bars", min: 1, max: 20, step: 1 },
  ],
  // SMC indicators
  orderBlock: [
    { key: "orderBlockSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 },
    { key: "orderBlockVolumePeriod", label: "Volume Period", min: 5, max: 50, step: 1 },
    { key: "orderBlockMinVolumeRatio", label: "Min Vol Ratio", min: 0.5, max: 3, step: 0.1 },
    { key: "orderBlockMaxActive", label: "Max Active", min: 1, max: 20, step: 1 },
  ],
  fvg: [
    { key: "fvgMinGapPercent", label: "Min Gap %", min: 0, max: 2, step: 0.1 },
    { key: "fvgMaxActive", label: "Max Active", min: 1, max: 20, step: 1 },
  ],
  bos: [
    { key: "bosSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 },
  ],
  choch: [
    { key: "bosSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 },
  ],
  liquiditySweep: [
    { key: "liquiditySweepSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 },
    { key: "liquiditySweepMaxRecoveryBars", label: "Max Recovery Bars", min: 1, max: 10, step: 1 },
  ],
};

/**
 * Chart store state
 */
export interface ChartState {
  // Data
  rawCandles: NormalizedCandle[];
  currentCandles: NormalizedCandle[];
  fileName: string;
  fundamentals: FundamentalData | null;

  // Display settings
  timeframe: Timeframe;
  enabledIndicators: SubChartType[];
  enabledOverlays: OverlayType[];
  enabledSignals: SignalType[];
  zoomRange: ZoomRange;
  indicatorParams: IndicatorParams;

  // UI state
  sidebarCollapsed: boolean;

  // Backtest
  backtestConfig: BacktestConfig;
  backtestResult: BacktestResult | null;
  isBacktestRunning: boolean;
}

/**
 * Chart store actions
 */
export interface ChartActions {
  loadCandles: (candles: NormalizedCandle[], fundamentals: FundamentalData | null, fileName: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setEnabledIndicators: (indicators: SubChartType[]) => void;
  setEnabledOverlays: (overlays: OverlayType[]) => void;
  setEnabledSignals: (signals: SignalType[]) => void;
  toggleSignal: (signal: SignalType) => void;
  setZoomRange: (range: ZoomRange) => void;
  setIndicatorParams: (params: Partial<IndicatorParams>) => void;
  resetIndicatorParams: () => void;
  setBacktestConfig: (config: Partial<BacktestConfig>) => void;
  setBacktestResult: (result: BacktestResult | null) => void;
  setIsBacktestRunning: (running: boolean) => void;
  clearBacktest: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  reset: () => void;
}
