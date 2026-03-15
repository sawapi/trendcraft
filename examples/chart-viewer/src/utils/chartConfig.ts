/**
 * ECharts configuration builder for main chart and subcharts
 */

import type { EChartsOption } from "echarts";
import type { NormalizedCandle, Trade } from "trendcraft";
import type { IndicatorData } from "../hooks/useIndicators";
import type { OverlayData } from "../hooks/useOverlays";
import type { SignalData } from "../hooks/useSignals";
import type { IndicatorParams, OverlayType, SignalType, SubChartType, ZoomRange } from "../types";
import { createTradeMarkers } from "./backtestMarkers";
import {
  COLORS,
  type SeriesItem,
  type SubchartContext,
  type SubchartLegend,
  calculateInitialZoom,
  formatDate,
} from "./chartColors";
import { buildOverlaySeries } from "./overlaySeriesBuilder";
import {
  createCrossMarkPoints,
  createDivergenceMarkers,
  createPatternMarkLines,
  createPatternMarkPoints,
  createPerfectOrderMarkPoints,
  createRangeBoundAreas,
  createSqueezeMarkers,
  createSupportResistanceLines,
  createVolumeBreakoutMarkers,
  createVolumeMaCrossMarkers,
} from "./signalMarkers";
import { buildSubchartSeries } from "./subchartSeriesBuilder";

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
  _chartHeight = 500,
  indicatorParams?: IndicatorParams,
  zoomRange?: ZoomRange,
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
  const subChartGap = 20;
  const labelHeight = 26;
  const mainHeight = 300;
  const volumeHeight = 80;
  const dataZoomHeight = 30;
  const dataZoomGap = 20;

  // Initial grids for main chart and volume (pixel-based)
  const mainTop = 40;
  const volumeTop = mainTop + mainHeight + 10;
  const dataZoomTop = volumeTop + volumeHeight + 10;
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
    if (enabledSignals.includes("perfectOrder") && signals.perfectOrder) {
      const poMarkers = createPerfectOrderMarkPoints(signals.perfectOrder, candles, dates);
      signalMarkPoints.push(...poMarkers);
    }
    if (enabledSignals.includes("rangeBound") && signals.rangeBound) {
      const rbAreas = createRangeBoundAreas(signals.rangeBound, dates);
      signalMarkAreas.push(...rbAreas);
      const srLines = createSupportResistanceLines(signals.rangeBound, dates);
      signalMarkLines.push(...srLines);
    }
    if (enabledSignals.includes("cross") && signals.crossSignals) {
      const crossMarkers = createCrossMarkPoints(signals.crossSignals, candles, dates);
      signalMarkPoints.push(...crossMarkers);
    }
    if (enabledSignals.includes("divergence") && signals.divergence) {
      const divergenceMarkers = createDivergenceMarkers(signals.divergence, candles, dates);
      signalMarkPoints.push(...divergenceMarkers);
    }
    if (enabledSignals.includes("bbSqueeze") && signals.bbSqueeze) {
      const squeezeMarkers = createSqueezeMarkers(signals.bbSqueeze, candles, dates);
      signalMarkPoints.push(...squeezeMarkers);
    }
    if (enabledSignals.includes("volumeBreakout") && signals.volumeBreakout) {
      const volumeMarkers = createVolumeBreakoutMarkers(signals.volumeBreakout, candles, dates);
      signalMarkPoints.push(...volumeMarkers);
    }
    if (enabledSignals.includes("volumeMaCross") && signals.volumeMaCross) {
      const vmcMarkers = createVolumeMaCrossMarkers(signals.volumeMaCross, candles, dates);
      signalMarkPoints.push(...vmcMarkers);
    }
    if (enabledSignals.includes("chartPatterns") && signals.chartPatterns) {
      const patternPoints = createPatternMarkPoints(signals.chartPatterns, candles, dates);
      signalMarkPoints.push(...patternPoints);
      const patternLines = createPatternMarkLines(signals.chartPatterns, candles, dates);
      signalMarkLines.push(...patternLines);
    }
  }

  // Overlay-based chart patterns
  const overlayPatterns = [
    ...(enabledOverlays.includes("trianglePattern") && overlays.trianglePattern
      ? overlays.trianglePattern
      : []),
    ...(enabledOverlays.includes("wedgePattern") && overlays.wedgePattern
      ? overlays.wedgePattern
      : []),
    ...(enabledOverlays.includes("channelPattern") && overlays.channelPattern
      ? overlays.channelPattern
      : []),
    ...(enabledOverlays.includes("flagPattern") && overlays.flagPattern
      ? overlays.flagPattern
      : []),
  ];
  if (overlayPatterns.length > 0) {
    signalMarkPoints.push(...createPatternMarkPoints(overlayPatterns, candles, dates));
    signalMarkLines.push(...createPatternMarkLines(overlayPatterns, candles, dates));
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

  // Earnings announcement date markers
  if (indicators.earningsDateIndices && indicators.earningsDateIndices.length > 0) {
    const earningsMarkAreas = indicators.earningsDateIndices.map((idx) => {
      const startIdx = Math.max(0, idx - 1);
      const endIdx = Math.min(dates.length - 1, idx + 2);
      return [
        {
          xAxis: dates[startIdx],
          itemStyle: { color: "rgba(255, 183, 77, 0.15)" },
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

  // Overlay indicators
  const overlaySeries = buildOverlaySeries(
    candles,
    overlays,
    enabledOverlays,
    dates,
    indicatorParams,
  );
  series.push(...overlaySeries);

  // Subchart context (pixel-based)
  const subchartLegends: SubchartLegend[] = [];
  const subchartCtx: SubchartContext = {
    grids,
    titles,
    legends: subchartLegends,
    xAxes,
    yAxes,
    dates,
    currentTop: dataZoomTop + dataZoomHeight + dataZoomGap,
    labelHeight,
    subHeight: 70,
    subChartGap,
  };

  // Subchart indicators
  const subchartSeries = buildSubchartSeries(
    subchartCtx,
    indicators,
    enabledIndicators,
    indicatorParams,
  );
  series.push(...subchartSeries);

  // Build legend data from main chart series (exclude subcharts and Volume)
  const mainLegendData = series
    .filter((s) => {
      if (s.name === "Candlestick") return true;
      if (s.name === "Volume") return false;
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
          if (Number.isInteger(v) || Math.abs(v) >= 1000) {
            return Math.round(v).toLocaleString();
          }
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
