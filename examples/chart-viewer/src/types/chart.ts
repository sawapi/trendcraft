/**
 * Timeframe for chart display
 */
export type Timeframe = "daily" | "weekly" | "monthly";

/**
 * Signal types for visualization
 */
export type SignalType =
  | "perfectOrder"
  | "rangeBound"
  | "cross"
  | "divergence"
  | "bbSqueeze"
  | "volumeBreakout"
  | "volumeMaCross"
  | "chartPatterns";

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
  | "roe"
  | "volatilityRegime"
  | "scoring"
  | "roofingFilter"
  | "trix"
  | "aroon"
  | "dpo"
  | "hurst"
  | "vortex"
  | "adl";

/**
 * Scoring preset type
 */
export type ScoringPreset =
  | "momentum"
  | "meanReversion"
  | "trendFollowing"
  | "balanced"
  | "aggressive"
  | "conservative";

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
  | "pivotPoints"
  | "orderBlock"
  | "fvg"
  | "bos"
  | "choch"
  | "liquiditySweep"
  | "highestLowest"
  | "chandelierExit"
  | "atrStops"
  | "fibonacci"
  | "autoTrendLine"
  | "channelLine"
  | "fibExtension"
  | "andrewsPitchfork"
  | "vwma20"
  | "superSmoother"
  | "heikinAshi"
  | "candlestickPatterns"
  | "kama"
  | "t3"
  | "fractals"
  | "zigzag";

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
 * Display start years options
 */
export type DisplayStartYears = 5 | 10 | 20 | null;
