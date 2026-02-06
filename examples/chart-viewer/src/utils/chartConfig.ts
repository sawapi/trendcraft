/**
 * ECharts configuration builder for main chart and subcharts
 */

import type { EChartsOption } from "echarts";
import type { NormalizedCandle, Trade } from "trendcraft";
import type { IndicatorParams, OverlayType, SignalType, SubChartType, ZoomRange } from "../types";
import type { IndicatorData } from "../hooks/useIndicators";
import type { SignalData } from "../hooks/useSignals";
import type { OverlayData } from "../hooks/useOverlays";
import {
  createPerfectOrderMarkPoints,
  createRangeBoundAreas,
  createSupportResistanceLines,
  createCrossMarkPoints,
  createDivergenceMarkers,
  createSqueezeMarkers,
  createVolumeBreakoutMarkers,
  createVolumeMaCrossMarkers,
} from "./signalMarkers";
import { createTradeMarkers } from "./backtestMarkers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeriesItem = any;

/**
 * Color palette for chart elements
 */
const COLORS = {
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
  per: "#2196f3",  // Blue
  pbr: "#9c27b0",  // Purple
  roe: "#4caf50",  // Green
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
  scoreStrong: "#4caf50",    // Green (70+)
  scoreModerate: "#ff9800",  // Orange (50-70)
  scoreWeak: "#ffeb3b",      // Yellow (30-50)
  scoreNone: "#9e9e9e",      // Gray (0-30)
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
};

/**
 * Subchart configuration options
 */
interface SubchartConfig {
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
interface SubchartLegend {
  top: number;
  seriesNames: string[];
}

/**
 * Subchart builder context (pixel-based)
 */
interface SubchartContext {
  grids: SeriesItem[];
  titles: SeriesItem[];
  legends: SubchartLegend[];
  xAxes: SeriesItem[];
  yAxes: SeriesItem[];
  dates: string[];
  currentTop: number;  // pixels
  labelHeight: number; // pixels
  subHeight: number;   // pixels
  subChartGap: number; // pixels
}

/**
 * Format timestamp to date string
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Calculate initial zoom range to show last 150 candles
 */
function calculateInitialZoom(candleCount: number): { start: number; end: number } {
  const visibleCandles = 150;
  const start = Math.max(0, 100 - (visibleCandles / candleCount) * 100);
  return { start, end: 100 };
}

/**
 * Format large numbers to K/M format
 */
function formatLargeNumber(value: number): string {
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
function createSubchart(ctx: SubchartContext, config: SubchartConfig): number {
  const gridIndex = ctx.grids.length;

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
    yAxisConfig.splitLine = { lineStyle: { color: "#333" } };
  } else {
    yAxisConfig.splitLine = { show: false };
  }

  if (config.showYAxisLabel !== false) {
    yAxisConfig.axisLabel = {
      color: "#a0a0a0",
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
 * Create markLine data for horizontal lines
 */
function createMarkLine(values: number[]): SeriesItem {
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

/**
 * Build ECharts option for main chart only (backward compatible)
 */
export function buildMainChartOption(candles: NormalizedCandle[]): EChartsOption {
  return buildChartOption(candles, {}, [], null, [], null, {}, [], 500, undefined, undefined);
}

/**
 * Build ECharts option for main chart with subcharts, signals, trades, and overlays
 */
export function buildChartOption(
  candles: NormalizedCandle[],
  indicators: IndicatorData,
  enabledIndicators: SubChartType[],
  signals: SignalData | null,
  enabledSignals: SignalType[],
  trades: Trade[] | null,
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
  _chartHeight: number = 500,
  indicatorParams?: IndicatorParams,
  zoomRange?: ZoomRange
): EChartsOption {
  if (candles.length === 0) {
    return {};
  }

  // Prepare data
  const dates = candles.map((c) => formatDate(c.time));
  const ohlc = candles.map((c) => [c.open, c.close, c.low, c.high]);
  const volumes = candles.map((c, i) => ({
    value: c.volume,
    itemStyle: {
      color: candles[i].close >= candles[i].open ? COLORS.up : COLORS.down,
      opacity: 0.5,
    },
  }));

  const { start, end } = zoomRange ?? calculateInitialZoom(candles.length);

  // Pixel-based grid heights
  const subChartGap = 20;   // gap between subcharts (px) - increased for better spacing
  const labelHeight = 26;   // space for title label (px) - increased for better title spacing
  const mainHeight = 300;   // main chart height (px)
  const volumeHeight = 80;  // volume chart height (px)
  const subHeight = 70;     // subchart height (px)
  const dataZoomHeight = 30; // dataZoom slider height (px)
  const dataZoomGap = 20;    // gap between dataZoom and subcharts (px) - match subChartGap

  // Initial grids for main chart and volume (pixel-based)
  const mainTop = 40;
  const volumeTop = mainTop + mainHeight + 10;
  const dataZoomTop = volumeTop + volumeHeight + 10; // dataZoom directly below volume
  const grids: SeriesItem[] = [
    { left: 60, right: 60, top: mainTop, height: mainHeight },
    { left: 60, right: 60, top: volumeTop, height: volumeHeight },
  ];

  const titles: SeriesItem[] = [];

  const xAxes: SeriesItem[] = [
    {
      type: "category",
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: "#666" } },
      axisLabel: { color: "#888" },
    },
    {
      type: "category",
      data: dates,
      gridIndex: 1,
      boundaryGap: true,
      axisLine: { lineStyle: { color: "#666" } },
      axisLabel: { show: false },
    },
  ];

  const yAxes: SeriesItem[] = [
    {
      scale: true,
      splitLine: { lineStyle: { color: "#333" } },
      axisLine: { lineStyle: { color: "#666" } },
      axisLabel: { color: "#888" },
    },
    {
      scale: true,
      gridIndex: 1,
      splitNumber: 2,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: "#333" } },
    },
  ];

  // Build signal markers
  const signalMarkPoints: SeriesItem[] = [];
  const signalMarkAreas: SeriesItem[] = [];
  const signalMarkLines: SeriesItem[] = [];

  if (signals) {
    // Perfect Order markers
    if (enabledSignals.includes("perfectOrder") && signals.perfectOrder) {
      const poMarkers = createPerfectOrderMarkPoints(signals.perfectOrder, candles, dates);
      signalMarkPoints.push(...poMarkers);
    }

    // Range-Bound areas and S/R lines
    if (enabledSignals.includes("rangeBound") && signals.rangeBound) {
      const rbAreas = createRangeBoundAreas(signals.rangeBound, dates);
      signalMarkAreas.push(...rbAreas);
      const srLines = createSupportResistanceLines(signals.rangeBound, dates);
      signalMarkLines.push(...srLines);
    }

    // Cross markers
    if (enabledSignals.includes("cross") && signals.crossSignals) {
      const crossMarkers = createCrossMarkPoints(signals.crossSignals, candles, dates);
      signalMarkPoints.push(...crossMarkers);
    }

    // Divergence markers
    if (enabledSignals.includes("divergence") && signals.divergence) {
      const divergenceMarkers = createDivergenceMarkers(signals.divergence, candles, dates);
      signalMarkPoints.push(...divergenceMarkers);
    }

    // Bollinger Squeeze markers
    if (enabledSignals.includes("bbSqueeze") && signals.bbSqueeze) {
      const squeezeMarkers = createSqueezeMarkers(signals.bbSqueeze, candles, dates);
      signalMarkPoints.push(...squeezeMarkers);
    }

    // Volume Breakout markers
    if (enabledSignals.includes("volumeBreakout") && signals.volumeBreakout) {
      const volumeMarkers = createVolumeBreakoutMarkers(
        signals.volumeBreakout,
        candles,
        dates
      );
      signalMarkPoints.push(...volumeMarkers);
    }

    // Volume MA Cross markers
    if (enabledSignals.includes("volumeMaCross") && signals.volumeMaCross) {
      const vmcMarkers = createVolumeMaCrossMarkers(
        signals.volumeMaCross,
        candles,
        dates
      );
      signalMarkPoints.push(...vmcMarkers);
    }
  }

  // Add trade markers from backtest
  if (trades && trades.length > 0) {
    const tradeMarkers = createTradeMarkers(trades, candles, dates);
    signalMarkPoints.push(...tradeMarkers);
  }

  // Series array
  const candlestickSeries: SeriesItem = {
    name: "Candlestick",
    type: "candlestick",
    data: ohlc,
    itemStyle: {
      color: COLORS.up,
      color0: COLORS.down,
      borderColor: COLORS.up,
      borderColor0: COLORS.down,
    },
  };

  // Add signal markers to candlestick series
  if (signalMarkPoints.length > 0) {
    candlestickSeries.markPoint = {
      symbol: "diamond",
      symbolSize: 14,
      data: signalMarkPoints,
    };
  }
  if (signalMarkAreas.length > 0) {
    candlestickSeries.markArea = {
      silent: true,
      data: signalMarkAreas,
    };
  }
  if (signalMarkLines.length > 0) {
    candlestickSeries.markLine = {
      silent: true,
      symbol: "none",
      data: signalMarkLines,
    };
  }

  // Earnings announcement date markers (highlight area on main chart)
  if (indicators.earningsDateIndices && indicators.earningsDateIndices.length > 0) {
    const earningsMarkAreas = indicators.earningsDateIndices.map((idx) => {
      const startIdx = Math.max(0, idx - 1);
      const endIdx = Math.min(dates.length - 1, idx + 2);
      return [
        {
          xAxis: dates[startIdx],
          itemStyle: { color: "rgba(255, 183, 77, 0.15)" }, // Very light orange
        },
        {
          xAxis: dates[endIdx],
        },
      ];
    });

    if (candlestickSeries.markArea) {
      candlestickSeries.markArea.data = [
        ...(candlestickSeries.markArea.data || []),
        ...earningsMarkAreas,
      ];
    } else {
      candlestickSeries.markArea = {
        silent: true,
        data: earningsMarkAreas,
      };
    }
  }

  const series: SeriesItem[] = [
    candlestickSeries,
    {
      name: "Volume",
      type: "bar",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: volumes,
    },
  ];

  // ========== Overlay Indicators ==========

  // SMA 5
  if (enabledOverlays.includes("sma5") && overlays.sma5) {
    series.push({
      name: "SMA 5",
      type: "line",
      data: overlays.sma5,
      symbol: "none",
      lineStyle: { color: COLORS.sma5, width: 1.5 },
    });
  }

  // SMA 25
  if (enabledOverlays.includes("sma25") && overlays.sma25) {
    series.push({
      name: "SMA 25",
      type: "line",
      data: overlays.sma25,
      symbol: "none",
      lineStyle: { color: COLORS.sma25, width: 1.5 },
    });
  }

  // SMA 75
  if (enabledOverlays.includes("sma75") && overlays.sma75) {
    series.push({
      name: "SMA 75",
      type: "line",
      data: overlays.sma75,
      symbol: "none",
      lineStyle: { color: COLORS.sma75, width: 1.5 },
    });
  }

  // EMA 12
  if (enabledOverlays.includes("ema12") && overlays.ema12) {
    series.push({
      name: "EMA 12",
      type: "line",
      data: overlays.ema12,
      symbol: "none",
      lineStyle: { color: COLORS.ema12, width: 1.5, type: "dashed" },
    });
  }

  // EMA 26
  if (enabledOverlays.includes("ema26") && overlays.ema26) {
    series.push({
      name: "EMA 26",
      type: "line",
      data: overlays.ema26,
      symbol: "none",
      lineStyle: { color: COLORS.ema26, width: 1.5, type: "dashed" },
    });
  }

  // WMA 20
  if (enabledOverlays.includes("wma20") && overlays.wma20) {
    series.push({
      name: "WMA 20",
      type: "line",
      data: overlays.wma20,
      symbol: "none",
      lineStyle: { color: COLORS.wma20, width: 1.5 },
    });
  }

  // Bollinger Bands
  if (enabledOverlays.includes("bb") && overlays.bb) {
    series.push({
      name: "BB Upper",
      type: "line",
      data: overlays.bb.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.bb, width: 1, type: "dashed" },
    });
    series.push({
      name: "BB Middle",
      type: "line",
      data: overlays.bb.map((v) => v.middle),
      symbol: "none",
      lineStyle: { color: COLORS.bb, width: 1.5 },
    });
    series.push({
      name: "BB Lower",
      type: "line",
      data: overlays.bb.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.bb, width: 1, type: "dashed" },
    });
  }

  // Donchian Channel
  if (enabledOverlays.includes("donchian") && overlays.donchian) {
    series.push({
      name: "Donchian Upper",
      type: "line",
      data: overlays.donchian.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.donchian, width: 1, type: "dashed" },
    });
    series.push({
      name: "Donchian Middle",
      type: "line",
      data: overlays.donchian.map((v) => v.middle),
      symbol: "none",
      lineStyle: { color: COLORS.donchian, width: 1.5 },
    });
    series.push({
      name: "Donchian Lower",
      type: "line",
      data: overlays.donchian.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.donchian, width: 1, type: "dashed" },
    });
  }

  // Keltner Channel
  if (enabledOverlays.includes("keltner") && overlays.keltner) {
    series.push({
      name: "KC Upper",
      type: "line",
      data: overlays.keltner.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.keltner, width: 1, type: "dashed" },
    });
    series.push({
      name: "KC Middle",
      type: "line",
      data: overlays.keltner.map((v) => v.middle),
      symbol: "none",
      lineStyle: { color: COLORS.keltner, width: 1.5 },
    });
    series.push({
      name: "KC Lower",
      type: "line",
      data: overlays.keltner.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.keltner, width: 1, type: "dashed" },
    });
  }

  // Ichimoku
  if (enabledOverlays.includes("ichimoku") && overlays.ichimoku) {
    series.push({
      name: "Tenkan",
      type: "line",
      data: overlays.ichimoku.map((v) => v.tenkan),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuTenkan, width: 1.5 },
    });
    series.push({
      name: "Kijun",
      type: "line",
      data: overlays.ichimoku.map((v) => v.kijun),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuKijun, width: 1.5 },
    });
    series.push({
      name: "Senkou A",
      type: "line",
      data: overlays.ichimoku.map((v) => v.senkouA),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuSenkouA, width: 1, type: "dashed" },
    });
    series.push({
      name: "Senkou B",
      type: "line",
      data: overlays.ichimoku.map((v) => v.senkouB),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuSenkouB, width: 1, type: "dashed" },
    });
    series.push({
      name: "Chikou",
      type: "line",
      data: overlays.ichimoku.map((v) => v.chikou),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuChikou, width: 1, type: "dotted" },
    });
  }

  // Supertrend
  if (enabledOverlays.includes("supertrend") && overlays.supertrend) {
    const bullishData = overlays.supertrend.map((v) =>
      v.direction === 1 ? v.supertrend : null
    );
    const bearishData = overlays.supertrend.map((v) =>
      v.direction === -1 ? v.supertrend : null
    );
    series.push({
      name: "Supertrend Up",
      type: "line",
      data: bullishData,
      symbol: "none",
      lineStyle: { color: COLORS.up, width: 2 },
    });
    series.push({
      name: "Supertrend Down",
      type: "line",
      data: bearishData,
      symbol: "none",
      lineStyle: { color: COLORS.down, width: 2 },
    });
  }

  // Parabolic SAR
  if (enabledOverlays.includes("psar") && overlays.psar) {
    const bullishSar = overlays.psar.map((v) =>
      v.direction === 1 ? v.sar : null
    );
    const bearishSar = overlays.psar.map((v) =>
      v.direction === -1 ? v.sar : null
    );
    series.push({
      name: "PSAR Up",
      type: "scatter",
      data: bullishSar,
      symbolSize: 4,
      itemStyle: { color: COLORS.up },
    });
    series.push({
      name: "PSAR Down",
      type: "scatter",
      data: bearishSar,
      symbolSize: 4,
      itemStyle: { color: COLORS.down },
    });
  }

  // VWAP
  if (enabledOverlays.includes("vwap") && overlays.vwap) {
    series.push({
      name: "VWAP",
      type: "line",
      data: overlays.vwap.map((v) => v.vwap),
      symbol: "none",
      lineStyle: { color: COLORS.vwap, width: 2 },
    });
    series.push({
      name: "VWAP Upper",
      type: "line",
      data: overlays.vwap.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.vwap, width: 1, type: "dashed", opacity: 0.6 },
    });
    series.push({
      name: "VWAP Lower",
      type: "line",
      data: overlays.vwap.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.vwap, width: 1, type: "dashed", opacity: 0.6 },
    });
  }

  // Swing Points
  if (enabledOverlays.includes("swingPoints") && overlays.swingPoints) {
    const swingHighData = overlays.swingPoints.map((v, i) =>
      v.isSwingHigh ? candles[i].high : null
    );
    series.push({
      name: "Swing High",
      type: "scatter",
      data: swingHighData,
      symbol: "triangle",
      symbolSize: 10,
      symbolRotate: 180,
      itemStyle: { color: COLORS.swingHigh },
    });

    const swingLowData = overlays.swingPoints.map((v, i) =>
      v.isSwingLow ? candles[i].low : null
    );
    series.push({
      name: "Swing Low",
      type: "scatter",
      data: swingLowData,
      symbol: "triangle",
      symbolSize: 10,
      itemStyle: { color: COLORS.swingLow },
    });
  }

  // Pivot Points
  if (enabledOverlays.includes("pivotPoints") && overlays.pivotPoints) {
    // Pivot (central level)
    series.push({
      name: "Pivot",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.pivot),
      symbol: "none",
      lineStyle: { color: COLORS.pivot, width: 1.5, type: "dashed" },
    });
    // Resistance levels
    series.push({
      name: "R1",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.r1),
      symbol: "none",
      lineStyle: { color: COLORS.pivotR1, width: 1, type: "dotted" },
    });
    series.push({
      name: "R2",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.r2),
      symbol: "none",
      lineStyle: { color: COLORS.pivotR2, width: 1, type: "dotted" },
    });
    series.push({
      name: "R3",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.r3),
      symbol: "none",
      lineStyle: { color: COLORS.pivotR3, width: 1, type: "dotted" },
    });
    // Support levels
    series.push({
      name: "S1",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.s1),
      symbol: "none",
      lineStyle: { color: COLORS.pivotS1, width: 1, type: "dotted" },
    });
    series.push({
      name: "S2",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.s2),
      symbol: "none",
      lineStyle: { color: COLORS.pivotS2, width: 1, type: "dotted" },
    });
    series.push({
      name: "S3",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.s3),
      symbol: "none",
      lineStyle: { color: COLORS.pivotS3, width: 1, type: "dotted" },
    });
  }

  // Fibonacci Retracement
  if (enabledOverlays.includes("fibonacci") && overlays.fibonacci) {
    const fibLevels: { key: string; color: string; width: number; lineType: string }[] = [
      { key: "0", color: COLORS.fib0, width: 1.5, lineType: "solid" },
      { key: "0.236", color: COLORS.fib236, width: 1, lineType: "dashed" },
      { key: "0.382", color: COLORS.fib382, width: 1, lineType: "dashed" },
      { key: "0.5", color: COLORS.fib50, width: 1, lineType: "dashed" },
      { key: "0.618", color: COLORS.fib618, width: 2, lineType: "dashed" },
      { key: "0.786", color: COLORS.fib786, width: 1, lineType: "dashed" },
      { key: "1", color: COLORS.fib100, width: 1.5, lineType: "solid" },
    ];

    for (const level of fibLevels) {
      const label = level.key === "0.5" ? "50%" : `${(parseFloat(level.key) * 100).toFixed(1)}%`;
      series.push({
        name: `Fib ${label}`,
        type: "line",
        data: overlays.fibonacci.map((v) => v.levels?.[level.key] ?? null),
        symbol: "none",
        lineStyle: { color: level.color, width: level.width, type: level.lineType },
      });
    }
  }

  // Auto Trend Line
  if (enabledOverlays.includes("autoTrendLine") && overlays.autoTrendLine) {
    series.push({
      name: "Resistance TL",
      type: "line",
      data: overlays.autoTrendLine.map((v) => v.resistance),
      symbol: "none",
      lineStyle: { color: COLORS.trendLineResistance, width: 1.5, type: "dashed" },
    });
    series.push({
      name: "Support TL",
      type: "line",
      data: overlays.autoTrendLine.map((v) => v.support),
      symbol: "none",
      lineStyle: { color: COLORS.trendLineSupport, width: 1.5, type: "dashed" },
    });
  }

  // Channel Line
  if (enabledOverlays.includes("channelLine") && overlays.channelLine) {
    series.push({
      name: "Channel Upper",
      type: "line",
      data: overlays.channelLine.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.channelUpper, width: 1.5 },
    });
    series.push({
      name: "Channel Lower",
      type: "line",
      data: overlays.channelLine.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.channelLower, width: 1.5 },
    });
    series.push({
      name: "Channel Middle",
      type: "line",
      data: overlays.channelLine.map((v) => v.middle),
      symbol: "none",
      lineStyle: { color: COLORS.channelMiddle, width: 1, type: "dashed" },
    });
  }

  // Fibonacci Extension
  if (enabledOverlays.includes("fibExtension") && overlays.fibExtension) {
    const extLevels: { key: string; color: string; width: number; lineType: string }[] = [
      { key: "0", color: COLORS.fibExt0, width: 1, lineType: "solid" },
      { key: "0.618", color: COLORS.fibExt618, width: 1, lineType: "dashed" },
      { key: "1", color: COLORS.fibExt100, width: 1.5, lineType: "solid" },
      { key: "1.272", color: COLORS.fibExt1272, width: 2, lineType: "dashed" },
      { key: "1.618", color: COLORS.fibExt1618, width: 2, lineType: "dashed" },
      { key: "2", color: COLORS.fibExt200, width: 1.5, lineType: "solid" },
      { key: "2.618", color: COLORS.fibExt2618, width: 1, lineType: "dashed" },
    ];

    for (const level of extLevels) {
      const label = `${(parseFloat(level.key) * 100).toFixed(1)}%`;
      series.push({
        name: `Ext ${label}`,
        type: "line",
        data: overlays.fibExtension.map((v) => v.levels?.[level.key] ?? null),
        symbol: "none",
        lineStyle: { color: level.color, width: level.width, type: level.lineType },
      });
    }
  }

  // Andrew's Pitchfork
  if (enabledOverlays.includes("andrewsPitchfork") && overlays.andrewsPitchfork) {
    series.push({
      name: "PF Median",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => v.median),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkMedian, width: 2 },
    });
    series.push({
      name: "PF Upper",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkUpper, width: 1.5, type: "dashed" },
    });
    series.push({
      name: "PF Lower",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkLower, width: 1.5, type: "dashed" },
    });
  }

  // Highest/Lowest Channel
  if (enabledOverlays.includes("highestLowest") && overlays.highestLowest) {
    series.push({
      name: "Highest",
      type: "line",
      data: overlays.highestLowest.map((v) => v.highest),
      symbol: "none",
      lineStyle: { color: COLORS.highestLowestUpper, width: 1.5 },
    });
    series.push({
      name: "Lowest",
      type: "line",
      data: overlays.highestLowest.map((v) => v.lowest),
      symbol: "none",
      lineStyle: { color: COLORS.highestLowestLower, width: 1.5 },
    });
  }

  // Chandelier Exit
  if (enabledOverlays.includes("chandelierExit") && overlays.chandelierExit) {
    series.push({
      name: "CE Long Exit",
      type: "line",
      data: overlays.chandelierExit.map((v) => v.longExit),
      symbol: "none",
      lineStyle: { color: COLORS.chandelierLong, width: 1.5 },
    });
    series.push({
      name: "CE Short Exit",
      type: "line",
      data: overlays.chandelierExit.map((v) => v.shortExit),
      symbol: "none",
      lineStyle: { color: COLORS.chandelierShort, width: 1.5 },
    });
  }

  // ATR Stops
  if (enabledOverlays.includes("atrStops") && overlays.atrStops) {
    series.push({
      name: "ATR Long Stop",
      type: "line",
      data: overlays.atrStops.map((v) => v.longStopLevel),
      symbol: "none",
      lineStyle: { color: COLORS.atrStopsLong, width: 1, type: "dashed" },
    });
    series.push({
      name: "ATR Short Stop",
      type: "line",
      data: overlays.atrStops.map((v) => v.shortStopLevel),
      symbol: "none",
      lineStyle: { color: COLORS.atrStopsShort, width: 1, type: "dashed" },
    });
  }

  // Order Block
  if (enabledOverlays.includes("orderBlock") && overlays.orderBlock) {
    const orderBlockMarkAreas: SeriesItem[][] = [];
    const lastOb = overlays.orderBlock[overlays.orderBlock.length - 1];
    if (lastOb) {
      // Active order blocks (bullish and bearish)
      for (const ob of lastOb.activeOrderBlocks) {
        const color = ob.type === "bullish" ? COLORS.orderBlockBullish : COLORS.orderBlockBearish;
        orderBlockMarkAreas.push([
          {
            xAxis: dates[ob.startIndex],
            yAxis: ob.low,
            itemStyle: { color },
          },
          {
            xAxis: dates[dates.length - 1],
            yAxis: ob.high,
          },
        ]);
      }
    }
    if (orderBlockMarkAreas.length > 0) {
      series.push({
        name: "Order Block",
        type: "line",
        data: [],
        markArea: {
          silent: true,
          data: orderBlockMarkAreas,
        },
      });
    }
  }

  // Fair Value Gap
  if (enabledOverlays.includes("fvg") && overlays.fvg) {
    const fvgMarkAreas: SeriesItem[][] = [];
    const lastFvg = overlays.fvg[overlays.fvg.length - 1];
    if (lastFvg) {
      // Active bullish FVGs
      for (const fvg of lastFvg.activeBullishFvgs) {
        fvgMarkAreas.push([
          {
            xAxis: dates[fvg.startIndex],
            yAxis: fvg.low,
            itemStyle: {
              color: COLORS.fvgBullish,
              borderColor: "rgba(100, 181, 246, 0.5)",
              borderWidth: 1,
              borderType: "dashed",
            },
          },
          {
            xAxis: dates[dates.length - 1],
            yAxis: fvg.high,
          },
        ]);
      }
      // Active bearish FVGs
      for (const fvg of lastFvg.activeBearishFvgs) {
        fvgMarkAreas.push([
          {
            xAxis: dates[fvg.startIndex],
            yAxis: fvg.low,
            itemStyle: {
              color: COLORS.fvgBearish,
              borderColor: "rgba(255, 183, 77, 0.5)",
              borderWidth: 1,
              borderType: "dashed",
            },
          },
          {
            xAxis: dates[dates.length - 1],
            yAxis: fvg.high,
          },
        ]);
      }
    }
    if (fvgMarkAreas.length > 0) {
      series.push({
        name: "FVG",
        type: "line",
        data: [],
        markArea: {
          silent: true,
          data: fvgMarkAreas,
        },
      });
    }
  }

  // Break of Structure
  if (enabledOverlays.includes("bos") && overlays.bos) {
    const bosMarkPoints: SeriesItem[] = [];
    overlays.bos.forEach((v, i) => {
      if (v.bullishBos) {
        bosMarkPoints.push({
          coord: [dates[i], candles[i].high],
          symbol: "arrow",
          symbolSize: 12,
          symbolRotate: 0,
          itemStyle: { color: COLORS.bosBullish },
          label: {
            show: true,
            formatter: "BOS",
            position: "top",
            fontSize: 9,
            color: COLORS.bosBullish,
            fontWeight: "bold",
          },
        });
      }
      if (v.bearishBos) {
        bosMarkPoints.push({
          coord: [dates[i], candles[i].low],
          symbol: "arrow",
          symbolSize: 12,
          symbolRotate: 180,
          itemStyle: { color: COLORS.bosBearish },
          label: {
            show: true,
            formatter: "BOS",
            position: "bottom",
            fontSize: 9,
            color: COLORS.bosBearish,
            fontWeight: "bold",
          },
        });
      }
    });
    if (bosMarkPoints.length > 0) {
      series.push({
        name: "BOS",
        type: "line",
        data: [],
        markPoint: {
          data: bosMarkPoints,
        },
      });
    }
  }

  // Change of Character
  if (enabledOverlays.includes("choch") && overlays.choch) {
    const chochMarkPoints: SeriesItem[] = [];
    overlays.choch.forEach((v, i) => {
      if (v.bullishBos) {
        chochMarkPoints.push({
          coord: [dates[i], candles[i].high],
          symbol: "diamond",
          symbolSize: 14,
          itemStyle: { color: COLORS.chochBullish },
          label: {
            show: true,
            formatter: "CHoCH",
            position: "top",
            fontSize: 9,
            color: COLORS.chochBullish,
            fontWeight: "bold",
          },
        });
      }
      if (v.bearishBos) {
        chochMarkPoints.push({
          coord: [dates[i], candles[i].low],
          symbol: "diamond",
          symbolSize: 14,
          itemStyle: { color: COLORS.chochBearish },
          label: {
            show: true,
            formatter: "CHoCH",
            position: "bottom",
            fontSize: 9,
            color: COLORS.chochBearish,
            fontWeight: "bold",
          },
        });
      }
    });
    if (chochMarkPoints.length > 0) {
      series.push({
        name: "CHoCH",
        type: "line",
        data: [],
        markPoint: {
          data: chochMarkPoints,
        },
      });
    }
  }

  // Liquidity Sweep
  if (enabledOverlays.includes("liquiditySweep") && overlays.liquiditySweep) {
    const sweepMarkPoints: SeriesItem[] = [];
    const sweepMarkAreas: SeriesItem[][] = [];

    overlays.liquiditySweep.forEach((v, i) => {
      // New sweep detected
      if (v.isSweep && v.sweep) {
        const isBullish = v.sweep.type === "bullish";

        // Marker at sweep point (triangle + label)
        sweepMarkPoints.push({
          coord: [dates[i], isBullish ? candles[i].low : candles[i].high],
          symbol: "triangle",
          symbolSize: 12,
          symbolRotate: isBullish ? 0 : 180,
          itemStyle: { color: isBullish ? COLORS.liquiditySweepBullish : COLORS.liquiditySweepBearish },
          label: {
            show: true,
            formatter: isBullish ? "SL" : "SH",
            position: isBullish ? "bottom" : "top",
            fontSize: 9,
            color: isBullish ? COLORS.liquiditySweepBullish : COLORS.liquiditySweepBearish,
            fontWeight: "bold",
          },
        });

        // Sweep area (sweptLevel to sweepExtreme) - displayed for 10 bars
        const areaColor = isBullish
          ? "rgba(38, 166, 154, 0.15)"
          : "rgba(239, 83, 80, 0.15)";
        sweepMarkAreas.push([
          {
            xAxis: dates[i],
            yAxis: v.sweep.sweptLevel,
            itemStyle: { color: areaColor },
          },
          {
            xAxis: dates[Math.min(i + 10, dates.length - 1)],
            yAxis: v.sweep.sweepExtreme,
          },
        ]);
      }

      // Recovery markers
      if (v.recoveredThisBar.length > 0) {
        for (const sweep of v.recoveredThisBar) {
          const isBullish = sweep.type === "bullish";
          sweepMarkPoints.push({
            coord: [dates[i], isBullish ? candles[i].high : candles[i].low],
            symbol: "pin",
            symbolSize: 14,
            itemStyle: { color: "#ff9800" },
            label: {
              show: true,
              formatter: "R",
              position: isBullish ? "top" : "bottom",
              fontSize: 8,
              color: "#ff9800",
              fontWeight: "bold",
            },
          });
        }
      }
    });

    if (sweepMarkPoints.length > 0 || sweepMarkAreas.length > 0) {
      series.push({
        name: "Liquidity Sweep",
        type: "line",
        data: [],
        ...(sweepMarkPoints.length > 0 && {
          markPoint: {
            data: sweepMarkPoints,
          },
        }),
        ...(sweepMarkAreas.length > 0 && {
          markArea: {
            silent: true,
            data: sweepMarkAreas,
          },
        }),
      });
    }
  }

  // Subchart context for helper function (pixel-based)
  // Subchart legends will be collected here
  const subchartLegends: SubchartLegend[] = [];

  const subchartCtx: SubchartContext = {
    grids,
    titles,
    legends: subchartLegends,
    xAxes,
    yAxes,
    dates,
    currentTop: dataZoomTop + dataZoomHeight + dataZoomGap, // Start subcharts below dataZoom
    labelHeight,
    subHeight,
    subChartGap,
  };

  // ========== Subcharts ==========

  // RSI
  if (enabledIndicators.includes("rsi") && indicators.rsi) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "RSI (14)",
      titleColor: COLORS.rsi,
      seriesNames: ["RSI"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "RSI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.rsi,
      symbol: "none",
      lineStyle: { color: COLORS.rsi, width: 1.5 },
      markLine: createMarkLine([30, 70]),
    });
  }

  // MACD
  if (
    enabledIndicators.includes("macd") &&
    indicators.macdLine &&
    indicators.macdSignal &&
    indicators.macdHist
  ) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "MACD",
      titleColor: COLORS.macdLine,
      seriesNames: ["MACD Line", "MACD Signal", "MACD Histogram"],
    });
    series.push({
      name: "MACD Line",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdLine,
      symbol: "none",
      lineStyle: { color: COLORS.macdLine, width: 1.5 },
    });
    series.push({
      name: "MACD Signal",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdSignal,
      symbol: "none",
      lineStyle: { color: COLORS.macdSignal, width: 1.5 },
    });
    series.push({
      name: "MACD Histogram",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdHist.map((v) => ({
        value: v,
        itemStyle: {
          color: v !== null && v >= 0 ? COLORS.macdHistUp : COLORS.macdHistDown,
        },
      })),
    });
  }

  // Stochastics
  if (enabledIndicators.includes("stochastics") && indicators.stochK && indicators.stochD) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Stochastics",
      titleColor: COLORS.stochK,
      seriesNames: ["Stoch %K", "Stoch %D"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "Stoch %K",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochK,
      symbol: "none",
      lineStyle: { color: COLORS.stochK, width: 1.5 },
    });
    series.push({
      name: "Stoch %D",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochD,
      symbol: "none",
      lineStyle: { color: COLORS.stochD, width: 1.5 },
    });
    series.push({
      name: "Stoch Markers",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: [],
      markLine: createMarkLine([20, 80]),
    });
  }

  // DMI/ADX
  if (
    enabledIndicators.includes("dmi") &&
    indicators.dmiPlusDi &&
    indicators.dmiMinusDi &&
    indicators.dmiAdx
  ) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "DMI/ADX",
      titleColor: COLORS.dmiAdx,
      seriesNames: ["+DI", "-DI", "ADX"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "+DI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dmiPlusDi,
      symbol: "none",
      lineStyle: { color: COLORS.dmiPlusDi, width: 1.5 },
    });
    series.push({
      name: "-DI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dmiMinusDi,
      symbol: "none",
      lineStyle: { color: COLORS.dmiMinusDi, width: 1.5 },
    });
    series.push({
      name: "ADX",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dmiAdx,
      symbol: "none",
      lineStyle: { color: COLORS.dmiAdx, width: 2 },
    });
    series.push({
      name: "DMI Markers",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: [],
      markLine: createMarkLine([25]),
    });
  }

  // Stoch RSI
  if (enabledIndicators.includes("stochrsi") && indicators.stochRsiK && indicators.stochRsiD) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Stoch RSI",
      titleColor: COLORS.stochRsiK,
      seriesNames: ["Stoch RSI %K", "Stoch RSI %D"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "Stoch RSI %K",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochRsiK,
      symbol: "none",
      lineStyle: { color: COLORS.stochRsiK, width: 1.5 },
    });
    series.push({
      name: "Stoch RSI %D",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochRsiD,
      symbol: "none",
      lineStyle: { color: COLORS.stochRsiD, width: 1.5 },
    });
    series.push({
      name: "StochRSI Markers",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: [],
      markLine: createMarkLine([20, 80]),
    });
  }

  // MFI
  if (enabledIndicators.includes("mfi") && indicators.mfi) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "MFI (14)",
      titleColor: COLORS.mfi,
      seriesNames: ["MFI"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "MFI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.mfi,
      symbol: "none",
      lineStyle: { color: COLORS.mfi, width: 1.5 },
      markLine: createMarkLine([20, 80]),
    });
  }

  // OBV with area gradient
  if (enabledIndicators.includes("obv") && indicators.obv) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "OBV",
      titleColor: COLORS.obv,
      seriesNames: ["OBV"],
      yAxisLabelFormatter: formatLargeNumber,
    });
    series.push({
      name: "OBV",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.obv,
      symbol: "none",
      lineStyle: { color: COLORS.obv, width: 1.5 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(155, 89, 182, 0.3)" },
            { offset: 1, color: "rgba(155, 89, 182, 0.05)" },
          ],
        },
      },
    });
  }

  // CCI
  if (enabledIndicators.includes("cci") && indicators.cci) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "CCI (20)",
      titleColor: COLORS.cci,
      seriesNames: ["CCI"],
    });
    series.push({
      name: "CCI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.cci,
      symbol: "none",
      lineStyle: { color: COLORS.cci, width: 1.5 },
      markLine: createMarkLine([-100, 100]),
    });
  }

  // Williams %R
  if (enabledIndicators.includes("williams") && indicators.williams) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Williams %R",
      titleColor: COLORS.williams,
      seriesNames: ["Williams %R"],
      yAxisMin: -100,
      yAxisMax: 0,
    });
    series.push({
      name: "Williams %R",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.williams,
      symbol: "none",
      lineStyle: { color: COLORS.williams, width: 1.5 },
      markLine: createMarkLine([-20, -80]),
    });
  }

  // ROC
  if (enabledIndicators.includes("roc") && indicators.roc) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "ROC (12)",
      titleColor: COLORS.roc,
      seriesNames: ["ROC"],
    });
    series.push({
      name: "ROC",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.roc,
      symbol: "none",
      lineStyle: { color: COLORS.roc, width: 1.5 },
      markLine: createMarkLine([0]),
    });
  }

  // Range-Bound
  if (enabledIndicators.includes("rangebound") && indicators.rangeBound) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Range-Bound",
      titleColor: COLORS.rangebound,
      seriesNames: ["RB Score"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
    // Range score line
    series.push({
      name: "RB Score",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.rangeBound.map((v) => v.rangeScore),
      symbol: "none",
      lineStyle: { color: COLORS.rangebound, width: 1.5 },
      markLine: createMarkLine([70]),
    });
  }

  // CMF - Bar chart with dynamic coloring
  if (enabledIndicators.includes("cmf") && indicators.cmf) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "CMF (20)",
      titleColor: COLORS.cmf,
      seriesNames: ["CMF"],
    });
    series.push({
      name: "CMF",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.cmf.map((v) => ({
        value: v,
        itemStyle: {
          color: v !== null && v >= 0 ? "#26a69a" : "#ef5350",
        },
      })),
      markLine: {
        silent: true,
        symbol: "none",
        label: { color: "#888", textBorderWidth: 0 },
        data: [
          { yAxis: 0, lineStyle: { color: "#666", type: "dashed" } },
          {
            yAxis: 0.1,
            lineStyle: { color: "#26a69a", type: "dashed" },
            label: { formatter: "+0.1", position: "end", fontSize: 9, color: "#888", textBorderWidth: 0 },
          },
          {
            yAxis: -0.1,
            lineStyle: { color: "#ef5350", type: "dashed" },
            label: { formatter: "-0.1", position: "end", fontSize: 9, color: "#888", textBorderWidth: 0 },
          },
        ],
      },
    });
  }

  // Volume Anomaly
  if (enabledIndicators.includes("volumeAnomaly") && indicators.volumeAnomaly) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Volume Anomaly",
      titleColor: COLORS.volumeAnomaly,
      seriesNames: ["Vol Ratio"],
    });

    // Collect E/H markers (triangles)
    const anomalyMarkers: SeriesItem[] = [];
    indicators.volumeAnomaly.forEach((v, i) => {
      if (v.level === "extreme" || v.level === "high") {
        anomalyMarkers.push({
          coord: [i, v.ratio],
          symbol: "triangle",
          symbolSize: v.level === "extreme" ? 14 : 10,
          itemStyle: {
            color: v.level === "extreme" ? "#ef5350" : "#ff9800",
          },
          label: {
            show: true,
            formatter: v.level === "extreme" ? "E" : "H",
            position: "top",
            fontSize: 9,
            color: "#fff",
          },
        });
      }
    });

    // Ratio line (solid) + threshold lines + markers
    series.push({
      name: "Vol Ratio",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeAnomaly.map((v) => v.ratio),
      symbol: "none",
      lineStyle: { color: COLORS.volumeAnomaly, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { type: "dashed" },
        label: { color: "#888", textBorderWidth: 0 },
        data: [
          {
            yAxis: 2.0,
            lineStyle: { color: "#ff9800" },
            label: { formatter: "2.0x High", position: "end", fontSize: 9, color: "#888", textBorderWidth: 0 },
          },
          {
            yAxis: 3.0,
            lineStyle: { color: "#ef5350" },
            label: { formatter: "3.0x Extreme", position: "end", fontSize: 9, color: "#888", textBorderWidth: 0 },
          },
        ],
      },
      ...(anomalyMarkers.length > 0 && {
        markPoint: {
          data: anomalyMarkers,
        },
      }),
    });
  }

  // Volume Profile
  if (enabledIndicators.includes("volumeProfile") && indicators.volumeProfile) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Volume Profile",
      titleColor: "#ff5722", // Match POC color
      seriesNames: ["POC", "VAH", "VAL"],
    });
    // POC - Orange solid line
    series.push({
      name: "POC",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.poc ?? null),
      symbol: "none",
      lineStyle: { color: "#ff5722", width: 2 }, // Orange, thick
    });
    // VAH - Green dashed line
    series.push({
      name: "VAH",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.vah ?? null),
      symbol: "none",
      lineStyle: { color: "#4caf50", width: 1.5, type: "dashed" }, // Green
    });
    // VAL - Red dashed line
    series.push({
      name: "VAL",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.val ?? null),
      symbol: "none",
      lineStyle: { color: "#f44336", width: 1.5, type: "dashed" }, // Red
    });
  }

  // Volume Trend
  if (enabledIndicators.includes("volumeTrend") && indicators.volumeTrend) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Volume Trend",
      titleColor: COLORS.volumeTrendUp,
      seriesNames: ["VT Confidence"],
      yAxisMin: 0,
      yAxisMax: 100,
    });

    // Collect divergence markers (diamonds)
    const divMarkers: SeriesItem[] = [];
    indicators.volumeTrend.forEach((v, i) => {
      if (v.hasDivergence) {
        const isBearish = v.priceTrend === "up" && v.volumeTrend === "down";
        divMarkers.push({
          coord: [i, v.confidence],
          symbol: "diamond",
          symbolSize: 12,
          itemStyle: { color: isBearish ? "#ef5350" : "#26a69a" },
          label: {
            show: true,
            formatter: isBearish ? "BD" : "BuD",
            position: "top",
            fontSize: 8,
            color: "#fff",
          },
        });
      }
    });

    // Display confidence as bar chart (colors: confirmed+up=green, confirmed+down=red, divergence=orange, other=gray)
    series.push({
      name: "VT Confidence",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeTrend.map((v) => ({
        value: v.confidence,
        itemStyle: {
          color: v.hasDivergence
            ? "#ff9800" // Orange for divergence
            : v.isConfirmed && v.priceTrend === "up"
              ? COLORS.volumeTrendUp // Green
              : v.isConfirmed && v.priceTrend === "down"
                ? COLORS.volumeTrendDown // Red
                : "#888", // Gray
        },
      })),
      markLine: {
        silent: true,
        symbol: "none",
        label: { color: "#888", textBorderWidth: 0 },
        data: [
          {
            yAxis: 50,
            lineStyle: { color: "#666", type: "dashed" },
            label: { formatter: "50%", position: "end", fontSize: 9, color: "#888", textBorderWidth: 0 },
          },
        ],
      },
      ...(divMarkers.length > 0 && {
        markPoint: {
          data: divMarkers,
        },
      }),
    });
  }

  // ATR
  if (enabledIndicators.includes("atr") && indicators.atr) {
    const gridIndex = createSubchart(subchartCtx, {
      title: `ATR (${indicatorParams?.atrPeriod ?? 14})`,
      titleColor: COLORS.atr,
      seriesNames: ["ATR"],
    });
    series.push({
      name: "ATR",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.atr,
      symbol: "none",
      lineStyle: { color: COLORS.atr, width: 1.5 },
    });
  }

  // Volatility Regime
  if (enabledIndicators.includes("volatilityRegime") && indicators.volatilityRegime) {
    const gridIndex = createSubchart(subchartCtx, {
      title: "Volatility Regime",
      titleColor: COLORS.volRegimeHigh,
      seriesNames: ["ATR Percentile"],
      yAxisMin: 0,
      yAxisMax: 100,
    });

    // ATR Percentile as bar chart with color based on regime
    series.push({
      name: "ATR Percentile",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volatilityRegime.map((v) => ({
        value: v.atrPercentile,
        itemStyle: {
          color:
            v.regime === "extreme" ? COLORS.volRegimeExtreme :
            v.regime === "high" ? COLORS.volRegimeHigh :
            v.regime === "low" ? COLORS.volRegimeLow :
            COLORS.volRegimeNormal,
        },
      })),
      markLine: createMarkLine([25, 75, 95]),
    });
  }

  // PER (Price-to-Earnings Ratio)
  if (enabledIndicators.includes("per") && indicators.per) {
    // Build dynamic title with current value, percentile, and level
    const lastPerValue = indicators.per.filter((v): v is number => v !== null).pop();
    let perTitle = "PER";
    if (lastPerValue !== undefined) {
      if (indicators.perPercentile) {
        perTitle = `PER ${lastPerValue.toFixed(1)} (${indicators.perPercentile.level} ${indicators.perPercentile.value}%)`;
      } else {
        perTitle = `PER ${lastPerValue.toFixed(1)}`;
      }
    }

    const gridIndex = createSubchart(subchartCtx, {
      title: perTitle,
      titleColor: COLORS.per,
      seriesNames: ["PER", "PER SMA"],
    });
    series.push({
      name: "PER",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.per,
      symbol: "none",
      lineStyle: { color: COLORS.per, width: 1.5 },
    });
    // PER SMA line (dashed, lighter)
    if (indicators.perSma) {
      series.push({
        name: "PER SMA",
        type: "line",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: indicators.perSma,
        symbol: "none",
        lineStyle: { color: COLORS.per, width: 1, type: "dashed", opacity: 0.5 },
      });
    }
  }

  // PBR (Price-to-Book Ratio)
  if (enabledIndicators.includes("pbr") && indicators.pbr) {
    // Build dynamic title with current value, percentile, and level
    const lastPbrValue = indicators.pbr.filter((v): v is number => v !== null).pop();
    let pbrTitle = "PBR";
    if (lastPbrValue !== undefined) {
      if (indicators.pbrPercentile) {
        pbrTitle = `PBR ${lastPbrValue.toFixed(2)} (${indicators.pbrPercentile.level} ${indicators.pbrPercentile.value}%)`;
      } else {
        pbrTitle = `PBR ${lastPbrValue.toFixed(2)}`;
      }
    }

    const gridIndex = createSubchart(subchartCtx, {
      title: pbrTitle,
      titleColor: COLORS.pbr,
      seriesNames: ["PBR", "PBR SMA"],
    });
    series.push({
      name: "PBR",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.pbr,
      symbol: "none",
      lineStyle: { color: COLORS.pbr, width: 1.5 },
    });
    // PBR SMA line (dashed, lighter)
    if (indicators.pbrSma) {
      series.push({
        name: "PBR SMA",
        type: "line",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: indicators.pbrSma,
        symbol: "none",
        lineStyle: { color: COLORS.pbr, width: 1, type: "dashed", opacity: 0.5 },
      });
    }
  }

  // ROE (Return on Equity)
  if (enabledIndicators.includes("roe") && indicators.roe) {
    // Build dynamic title with current value, percentile, and level
    const lastRoeValue = indicators.roe.filter((v): v is number => v !== null).pop();
    let roeTitle = "ROE";
    if (lastRoeValue !== undefined) {
      if (indicators.roePercentile) {
        roeTitle = `ROE ${lastRoeValue.toFixed(1)}% (${indicators.roePercentile.level} ${indicators.roePercentile.value}%)`;
      } else {
        roeTitle = `ROE ${lastRoeValue.toFixed(1)}%`;
      }
    }

    const gridIndex = createSubchart(subchartCtx, {
      title: roeTitle,
      titleColor: COLORS.roe,
      seriesNames: ["ROE", "ROE SMA"],
    });
    series.push({
      name: "ROE",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.roe,
      symbol: "none",
      lineStyle: { color: COLORS.roe, width: 1.5 },
    });
    // ROE SMA line (dashed, lighter)
    if (indicators.roeSma) {
      series.push({
        name: "ROE SMA",
        type: "line",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: indicators.roeSma,
        symbol: "none",
        lineStyle: { color: COLORS.roe, width: 1, type: "dashed", opacity: 0.5 },
      });
    }
  }

  // Scoring
  if (enabledIndicators.includes("scoring") && indicators.scoring) {
    const gridIndex = createSubchart(subchartCtx, {
      title: `Score (${indicatorParams?.scoringPreset ?? "balanced"})`,
      titleColor: COLORS.scoreStrong,
      seriesNames: ["Score"],
      yAxisMin: 0,
      yAxisMax: 100,
    });

    series.push({
      name: "Score",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.scoring.map((s) => ({
        value: s.normalizedScore,
        itemStyle: {
          color:
            s.strength === "strong" ? COLORS.scoreStrong :
            s.strength === "moderate" ? COLORS.scoreModerate :
            s.strength === "weak" ? COLORS.scoreWeak :
            COLORS.scoreNone,
        },
      })),
      markLine: createMarkLine([30, 50, 70]),
    });
  }

  // Build legend data from main chart series (exclude subcharts and Volume)
  const mainLegendData = series
    .filter((s) => {
      // Include candlestick
      if (s.name === "Candlestick") return true;
      // Exclude Volume bar
      if (s.name === "Volume") return false;
      // Include overlay series (no xAxisIndex means main chart)
      if (s.xAxisIndex === undefined || s.xAxisIndex === 0) return true;
      return false;
    })
    .map((s) => s.name as string);

  // Build legends array: main legend + subchart legends
  const legends: SeriesItem[] = [
    {
      data: mainLegendData,
      top: 10,
      textStyle: { color: "#888", fontSize: 11 },
      type: "scroll",
      pageIconColor: "#888",
      pageIconInactiveColor: "#555",
      pageTextStyle: { color: "#888" },
    },
    // Subchart legends (positioned to the right of title)
    ...subchartLegends.map((legend) => ({
      data: legend.seriesNames,
      top: legend.top,
      left: 100,
      textStyle: { color: "#888", fontSize: 10 },
      itemWidth: 14,
      itemHeight: 10,
      itemGap: 8,
    })),
  ];

  // Build final option
  return {
    backgroundColor: "transparent",
    animation: false,
    title: titles,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(0,0,0,0.8)",
      borderColor: "#333",
      textStyle: { color: "#fff" },
      confine: true,
      valueFormatter: (value: unknown) => {
        if (value === null || value === undefined) return "-";
        const formatNum = (v: unknown): string => {
          if (typeof v !== "number" || !Number.isFinite(v)) return String(v ?? "-");
          // Format integers or large numbers with comma separators
          if (Number.isInteger(v) || Math.abs(v) >= 1000) {
            return Math.round(v).toLocaleString();
          }
          // Format decimal values to 3 decimal places
          return v.toFixed(3);
        };
        if (Array.isArray(value)) return value.map(formatNum).join(", ");
        return formatNum(value);
      },
    },
    legend: legends,
    axisPointer: {
      link: [{ xAxisIndex: "all" }],
      label: { backgroundColor: "#16213e" },
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series,
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: xAxes.map((_: SeriesItem, i: number) => i),
        start,
        end,
      },
      {
        type: "slider",
        xAxisIndex: xAxes.map((_: SeriesItem, i: number) => i),
        top: dataZoomTop,
        height: dataZoomHeight,
        start,
        end,
      },
    ],
  };
}
