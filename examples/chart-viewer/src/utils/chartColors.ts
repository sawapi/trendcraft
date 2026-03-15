/**
 * Chart color palette, shared types, and utility functions
 */

// biome-ignore lint/suspicious/noExplicitAny: ECharts internal type
export type SeriesItem = any;

/**
 * Color palette for chart elements
 */
export const COLORS = {
  up: "#26a69a",
  down: "#ef5350",
  // Momentum
  rsi: "#f59e0b",
  macdLine: "#3b82f6",
  macdSignal: "#ef4444",
  macdHistUp: "#26a69a",
  macdHistDown: "#ef5350",
  stochK: "#3b82f6",
  stochD: "#ef4444",
  stochRsiK: "#22d3d8",
  stochRsiD: "#f472b6",
  dmiPlusDi: "#26a69a",
  dmiMinusDi: "#ef5350",
  dmiAdx: "#f59e0b",
  cci: "#a855f7",
  williams: "#06b6d4",
  roc: "#f59e0b",
  // Volume
  mfi: "#06b6d4",
  obv: "#9b59b6",
  cmf: "#22d3d8",
  volumeAnomaly: "#a855f7",
  volumeTrendUp: "#26a69a",
  volumeTrendDown: "#ef5350",
  // Range-bound
  rangebound: "#f472b6",
  // Overlay - Moving Averages
  sma5: "#ff6b6b",
  sma25: "#ffd93d",
  sma75: "#c44dff",
  ema12: "#4ecdc4",
  ema26: "#45b7d1",
  wma20: "#e74c3c",
  // Overlay - Bands
  bb: "#6bcb77",
  donchian: "#1abc9c",
  keltner: "#7c4dff",
  // Overlay - Ichimoku
  ichimokuTenkan: "#e74c3c",
  ichimokuKijun: "#3498db",
  ichimokuSenkouA: "#2ecc71",
  ichimokuSenkouB: "#e67e22",
  ichimokuChikou: "#9b59b6",
  // ATR
  atr: "#ff7043",
  // Fundamentals
  per: "#2196f3", // Blue
  pbr: "#9c27b0", // Purple
  roe: "#4caf50", // Green
  // VWAP
  vwap: "#00bcd4",
  // Swing Points
  swingHigh: "#ef5350",
  swingLow: "#26a69a",
  // Pivot Points
  pivot: "#9e9e9e",
  pivotR1: "#ef5350",
  pivotR2: "#e53935",
  pivotR3: "#c62828",
  pivotS1: "#26a69a",
  pivotS2: "#00897b",
  pivotS3: "#004d40",
  // Fibonacci Retracement
  fib0: "#4caf50",
  fib236: "#8bc34a",
  fib382: "#ffeb3b",
  fib50: "#ff9800",
  fib618: "#ff5722",
  fib786: "#e91e63",
  fib100: "#f44336",
  // SMC
  orderBlockBullish: "rgba(38, 166, 154, 0.3)",
  orderBlockBearish: "rgba(239, 83, 80, 0.3)",
  fvgBullish: "rgba(100, 181, 246, 0.25)",
  fvgBearish: "rgba(255, 183, 77, 0.25)",
  bosBullish: "#4caf50",
  bosBearish: "#f44336",
  chochBullish: "#00bcd4",
  chochBearish: "#e91e63",
  liquiditySweepBullish: "#26a69a",
  liquiditySweepBearish: "#ef5350",
  // Highest/Lowest Channel
  highestLowestUpper: "#ff7043",
  highestLowestLower: "#42a5f5",
  // Chandelier Exit
  chandelierLong: "#4caf50",
  chandelierShort: "#f44336",
  // ATR Stops
  atrStopsLong: "#26a69a",
  atrStopsShort: "#ef5350",
  atrStopsTp: "#ffc107",
  // Volatility Regime
  volRegimeLow: "#42a5f5",
  volRegimeNormal: "#9e9e9e",
  volRegimeHigh: "#ff9800",
  volRegimeExtreme: "#f44336",
  // Scoring
  scoreStrong: "#4caf50", // Green (70+)
  scoreModerate: "#ff9800", // Orange (50-70)
  scoreWeak: "#ffeb3b", // Yellow (30-50)
  scoreNone: "#9e9e9e", // Gray (0-30)
  // Auto Trend Line
  trendLineResistance: "#ef5350",
  trendLineSupport: "#26a69a",
  // Channel Line
  channelUpper: "#ff7043",
  channelLower: "#42a5f5",
  channelMiddle: "#9e9e9e",
  // Fibonacci Extension
  fibExt0: "#b39ddb",
  fibExt618: "#9575cd",
  fibExt100: "#7e57c2",
  fibExt1272: "#673ab7",
  fibExt1618: "#5e35b1",
  fibExt200: "#512da8",
  fibExt2618: "#4527a0",
  // Andrew's Pitchfork
  pitchforkMedian: "#ff9800",
  pitchforkUpper: "#ef5350",
  pitchforkLower: "#26a69a",
  // Volume Profile
  volumeProfilePoc: "#ff5722",
  volumeProfileVah: "#4caf50",
  volumeProfileVal: "#f44336",
  // Liquidity Sweep Recovery
  liquiditySweepRecovery: "#ff9800",
  // VWMA
  vwma20: "#ff8c00",
  // Ehlers Filters
  superSmoother: "#00e5ff",
  roofingFilter: "#7c4dff",
  // Heikin-Ashi
  heikinAshiUp: "rgba(38, 166, 154, 0.4)",
  heikinAshiDown: "rgba(239, 83, 80, 0.4)",
  // Candlestick Patterns
  candlePatternBull: "#00e676",
  candlePatternBear: "#ff1744",
  // KAMA / T3
  kama: "#ff6f00",
  t3: "#ab47bc",
  // Fractals
  fractalUp: "#ef5350",
  fractalDown: "#26a69a",
  // Zigzag
  zigzag: "#ffab40",
  // TRIX
  trixLine: "#26c6da",
  trixSignal: "#f44336",
  // Aroon
  aroonUp: "#4caf50",
  aroonDown: "#f44336",
  aroonOscillator: "#ff9800",
  // DPO
  dpo: "#7e57c2",
  // Hurst
  hurst: "#00897b",
  // Vortex
  vortexPlus: "#4caf50",
  vortexMinus: "#f44336",
  // ADL
  adl: "#5c6bc0",
};

/**
 * Subchart configuration options
 */
export interface SubchartConfig {
  title: string;
  titleColor: string;
  seriesNames: string[];
  yAxisMin?: number;
  yAxisMax?: number;
  showYAxisLabel?: boolean;
  yAxisLabelFormatter?: (value: number) => string;
  showSplitLine?: boolean;
  markLines?: number[];
}

/**
 * Subchart legend info
 */
export interface SubchartLegend {
  top: number;
  seriesNames: string[];
}

/**
 * Subchart builder context (pixel-based)
 */
export interface SubchartContext {
  grids: SeriesItem[];
  titles: SeriesItem[];
  legends: SubchartLegend[];
  xAxes: SeriesItem[];
  yAxes: SeriesItem[];
  dates: string[];
  currentTop: number; // pixels
  labelHeight: number; // pixels
  subHeight: number; // pixels
  subChartGap: number; // pixels
  subchartHeights?: Record<string, number>; // per-indicator custom heights
  theme?: string; // theme for colors
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Calculate initial zoom range to show last 150 candles
 */
export function calculateInitialZoom(candleCount: number): { start: number; end: number } {
  const visibleCandles = 150;
  const start = Math.max(0, 100 - (visibleCandles / candleCount) * 100);
  return { start, end: 100 };
}

/**
 * Format large numbers to K/M format
 */
export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toFixed(0);
}

/**
 * Create a subchart grid, axes, title, and legend configuration (pixel-based)
 * Returns the gridIndex for use in series
 */
export function createSubchart(ctx: SubchartContext, config: SubchartConfig, key?: string): number {
  const gridIndex = ctx.grids.length;
  const isLight = ctx.theme === "light";
  const splitLineColor = isLight ? "#e0e0e0" : "#333";
  const labelColor = isLight ? "#666" : "#a0a0a0";

  // Use custom height if set, otherwise default
  const height = (key && ctx.subchartHeights?.[key]) || ctx.subHeight;

  // Add title
  ctx.titles.push({
    text: config.title,
    left: 5,
    top: ctx.currentTop,
    textStyle: { color: config.titleColor, fontSize: 10, fontWeight: "normal" },
  });

  // Record legend info for this subchart (positioned after title)
  ctx.legends.push({
    top: ctx.currentTop,
    seriesNames: config.seriesNames,
  });

  ctx.grids.push({
    left: 60,
    right: 60,
    top: ctx.currentTop + ctx.labelHeight,
    height,
  });

  ctx.xAxes.push({
    type: "category",
    gridIndex,
    data: ctx.dates,
    show: false,
  });

  const yAxisConfig: SeriesItem = {
    type: "value",
    gridIndex,
  };

  if (config.yAxisMin !== undefined) yAxisConfig.min = config.yAxisMin;
  if (config.yAxisMax !== undefined) yAxisConfig.max = config.yAxisMax;

  if (config.showSplitLine !== false) {
    yAxisConfig.splitLine = { lineStyle: { color: splitLineColor } };
  } else {
    yAxisConfig.splitLine = { show: false };
  }

  if (config.showYAxisLabel !== false) {
    yAxisConfig.axisLabel = {
      color: labelColor,
      fontSize: config.yAxisLabelFormatter ? 9 : 10,
      ...(config.yAxisLabelFormatter && { formatter: config.yAxisLabelFormatter }),
    };
  } else {
    yAxisConfig.axisLabel = { show: false };
  }

  ctx.yAxes.push(yAxisConfig);
  ctx.currentTop += ctx.labelHeight + height + ctx.subChartGap;

  return gridIndex;
}

/**
 * Create markLine data for horizontal lines
 */
export function createMarkLine(values: number[]): SeriesItem {
  return {
    silent: true,
    symbol: "none",
    lineStyle: { color: "#666", type: "dashed" },
    label: {
      color: "#888",
      textBorderWidth: 0,
    },
    data: values.map((v) => ({ yAxis: v })),
  };
}
