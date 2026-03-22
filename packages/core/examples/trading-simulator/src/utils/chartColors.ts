import { INDICATOR_DEFINITIONS } from "../types";

export const COLORS = {
  up: "#4ade80",
  down: "#ef4444",
  // Trend
  sma5: "#f59e0b",
  sma25: "#3b82f6",
  sma75: "#a855f7",
  ema12: "#22d3d8",
  ema26: "#f472b6",
  // New MAs
  wma: "#e879f9",
  vwma: "#fb923c",
  kama: "#2dd4bf",
  t3: "#818cf8",
  hma: "#fbbf24",
  mcginley: "#34d399",
  emaRibbon1: "#f87171",
  emaRibbon2: "#fb923c",
  emaRibbon3: "#fbbf24",
  emaRibbon4: "#4ade80",
  emaRibbon5: "#22d3ee",
  emaRibbon6: "#818cf8",
  emaRibbonBullish: "rgba(74, 222, 128, 0.08)",
  emaRibbonBearish: "rgba(239, 68, 68, 0.08)",
  // Ichimoku
  ichimokuTenkan: "#f59e0b",
  ichimokuKijun: "#ef4444",
  ichimokuSenkouA: "#4ade80",
  ichimokuSenkouB: "#ef4444",
  ichimokuChikou: "#a855f7",
  ichimokuKumoUp: "rgba(74, 222, 128, 0.15)",
  ichimokuKumoDown: "rgba(239, 68, 68, 0.15)",
  // Supertrend
  supertrendUp: "#4ade80",
  supertrendDown: "#ef4444",
  // Parabolic SAR
  parabolicSar: "#f59e0b",
  // Volatility
  bbUpper: "#6b7280",
  bbMiddle: "#9ca3af",
  bbLower: "#6b7280",
  keltnerUpper: "#06b6d4",
  keltnerMiddle: "#22d3ee",
  keltnerLower: "#06b6d4",
  donchianUpper: "#3b82f6",
  donchianMiddle: "#60a5fa",
  donchianLower: "#3b82f6",
  atr: "#f59e0b",
  // New bands/channels
  chandelierLong: "#4ade80",
  chandelierShort: "#ef4444",
  vwapLine: "#f59e0b",
  vwapUpper: "rgba(245, 158, 11, 0.5)",
  vwapLower: "rgba(245, 158, 11, 0.5)",
  atrStopsLong: "#4ade80",
  atrStopsShort: "#ef4444",
  superSmootherLine: "#818cf8",
  // Momentum
  rsi: "#f59e0b",
  macdLine: "#3b82f6",
  macdSignal: "#ef4444",
  macdHistUp: "#4ade80",
  macdHistDown: "#ef4444",
  stochK: "#3b82f6",
  stochD: "#ef4444",
  stochRsiK: "#22d3d8",
  stochRsiD: "#f472b6",
  dmiPlusDi: "#4ade80",
  dmiMinusDi: "#ef4444",
  dmiAdx: "#f59e0b",
  cci: "#a855f7",
  // New momentum
  williams: "#e879f9",
  rocLine: "#fb923c",
  connorsRsiLine: "#22d3ee",
  cmo: "#34d399",
  imiLine: "#fbbf24",
  trixLine: "#818cf8",
  trixSignal: "#f472b6",
  aroonUp: "#4ade80",
  aroonDown: "#ef4444",
  dpoLine: "#e879f9",
  hurstLine: "#2dd4bf",
  // New trend subchart
  adxrLine: "#f59e0b",
  vortexPlus: "#4ade80",
  vortexMinus: "#ef4444",
  // Filter
  roofingFilterLine: "#818cf8",
  // Volatility subchart
  choppiness: "#fb923c",
  volatilityRegime: "#a855f7",
  // Volume
  volume: "#4b5563",
  obv: "#4b5563",
  mfi: "#06b6d4",
  // New volume
  cmfLine: "#22d3ee",
  adlLine: "#4b5563",
  klingerLine: "#3b82f6",
  klingerSignal: "#ef4444",
  elderForce: "#f59e0b",
  volumeAnomalyNormal: "#4b5563",
  volumeAnomalyHigh: "#fb923c",
  volumeAnomalyExtreme: "#ef4444",
  volumeTrendConfirmed: "#4ade80",
  volumeTrendDivergent: "#ef4444",
  volumeProfilePoc: "#f59e0b",
  volumeProfileVah: "#4ade80",
  volumeProfileVal: "#ef4444",
  // Equity Curve
  equity: "#4ade80",
  buyHold: "#6b7280",
  drawdown: "rgba(239, 68, 68, 0.3)",
  // Volume Spike
  volumeSpikeAvg: "#06b6d4",
  volumeSpikeBreakout: "#a855f7",
  volumeAccumulation: "#22c55e",
  volumeMaCross: "#f59e0b",
  // SMC
  orderBlockBullish: "rgba(34, 197, 94, 0.2)",
  orderBlockBearish: "rgba(239, 68, 68, 0.2)",
  orderBlockBullishBorder: "#22c55e",
  orderBlockBearishBorder: "#ef4444",
  liquiditySweepBullish: "#22d3d8",
  liquiditySweepBearish: "#f472b6",
  // New SMC
  fvgBullish: "rgba(34, 197, 94, 0.15)",
  fvgBearish: "rgba(239, 68, 68, 0.15)",
  fvgBullishBorder: "#22c55e",
  fvgBearishBorder: "#ef4444",
  bosBullish: "#4ade80",
  bosBearish: "#ef4444",
  chochBullish: "#22d3ee",
  chochBearish: "#f472b6",
  // Price overlays
  swingHigh: "#ef4444",
  swingLow: "#4ade80",
  pivotPivot: "#f59e0b",
  pivotResistance: "#ef4444",
  pivotSupport: "#4ade80",
  fibLevel: "#818cf8",
  fibExtLevel: "#e879f9",
  highestLine: "#ef4444",
  lowestLine: "#4ade80",
  autoTrendResistance: "#ef4444",
  autoTrendSupport: "#4ade80",
  channelUpper: "#3b82f6",
  channelLower: "#3b82f6",
  channelMiddle: "#60a5fa",
  pitchforkMedian: "#f59e0b",
  pitchforkUpper: "#ef4444",
  pitchforkLower: "#4ade80",
  // Patterns - Bullish (Double Bottom) Teal
  patternLine: "#14b8a6",
  patternFill: "rgba(20, 184, 166, 0.4)",
  patternNeckline: "#14b8a6",
  patternKeyPoint: "#14b8a6",
  patternTarget: "#14b8a6",
  patternLabel: "#14b8a6",
  patternConfirmedBox: "rgba(20, 184, 166, 0.15)",
  patternConfirmedBorder: "#14b8a6",
  // Patterns - Bearish (Double Top) Red
  patternBearishLine: "#ef4444",
  patternBearishFill: "rgba(239, 68, 68, 0.4)",
  patternBearishNeckline: "#ef4444",
  patternBearishTarget: "#ef4444",
  patternBearishLabel: "#ef4444",
  // Fractal / Zigzag
  fractalUp: "#ef4444",
  fractalDown: "#4ade80",
  zigzagLine: "#818cf8",
};

// biome-ignore lint/suspicious/noExplicitAny: ECharts internal type
export type SeriesItem = any;

export type ChartTheme = "dark" | "light";

export const THEME_COLORS = {
  dark: {
    bg: "#1a1a24",
    tooltipBg: "#22222e",
    gridLine: "#333",
    axisLabel: "#a0a0a0",
    textPrimary: "#eaeaea",
    labelBg: "#1a1a24",
  },
  light: {
    bg: "#fafafa",
    tooltipBg: "#ffffff",
    gridLine: "#e0e0e0",
    axisLabel: "#666",
    textPrimary: "#1a1a2e",
    labelBg: "#fafafa",
  },
} as const;

/**
 * Subchart configuration options
 */
export interface SubchartConfig {
  title: string;
  titleColor: string;
  yAxisMin?: number;
  yAxisMax?: number;
  showYAxisLabel?: boolean;
  yAxisLabelFormatter?: (value: number) => string;
  showSplitLine?: boolean;
}

/**
 * Subchart builder context - holds shared state for building subcharts
 */
export interface SubchartContext {
  grids: SeriesItem[];
  titles: SeriesItem[];
  xAxes: SeriesItem[];
  yAxes: SeriesItem[];
  dates: string[];
  /** Current top position in pixels */
  currentTop: number;
  /** Label height in pixels */
  labelHeight: number;
  /** Subchart height in pixels */
  subHeight: number;
  /** Gap between subcharts in pixels */
  subChartGap: number;
  /** Theme colors */
  themeColors: (typeof THEME_COLORS)[ChartTheme];
}

// Keys of indicators with subcharts
export const SUBCHART_INDICATORS = INDICATOR_DEFINITIONS.filter(
  (ind) => ind.chartType === "subchart",
).map((ind) => ind.key);

/**
 * Create a subchart grid, axes, and title configuration
 * Returns the gridIndex for use in series
 */
export function createSubchart(ctx: SubchartContext, config: SubchartConfig): number {
  const gridIndex = ctx.grids.length;

  ctx.titles.push({
    text: config.title,
    left: 5,
    top: ctx.currentTop,
    textStyle: { color: config.titleColor, fontSize: 10, fontWeight: "normal" },
  });

  ctx.grids.push({
    left: 60,
    right: 40,
    top: ctx.currentTop + ctx.labelHeight,
    height: ctx.subHeight,
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
    yAxisConfig.splitLine = { lineStyle: { color: ctx.themeColors.gridLine } };
  } else {
    yAxisConfig.splitLine = { show: false };
  }

  if (config.showYAxisLabel !== false) {
    yAxisConfig.axisLabel = {
      color: ctx.themeColors.axisLabel,
      fontSize: config.yAxisLabelFormatter ? 9 : 10,
      ...(config.yAxisLabelFormatter && { formatter: config.yAxisLabelFormatter }),
    };
  } else {
    yAxisConfig.axisLabel = { show: false };
  }

  ctx.yAxes.push(yAxisConfig);
  ctx.currentTop += ctx.labelHeight + ctx.subHeight + ctx.subChartGap;

  return gridIndex;
}

/**
 * Create a simple line series
 */
export function createLineSeries(
  name: string,
  data: (number | null)[],
  color: string,
  lineType: "solid" | "dashed" | "dotted" = "solid",
  width = 1.5,
): SeriesItem {
  return {
    name,
    type: "line",
    data,
    symbol: "none",
    lineStyle: {
      color,
      width,
      type: lineType,
    },
  };
}

/**
 * Format large numbers in K/M notation
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
