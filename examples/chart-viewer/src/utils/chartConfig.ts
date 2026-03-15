/**
 * ECharts configuration builder for main chart and subcharts
 */

import type { EChartsOption } from "echarts";
import type { NormalizedCandle, Trade } from "trendcraft";
import type { IndicatorData } from "../hooks/useIndicators";
import type { OverlayData } from "../hooks/useOverlays";
import type { SignalData } from "../hooks/useSignals";
import type {
  Drawing,
  IndicatorParams,
  OverlayType,
  SignalType,
  SubChartType,
  ThemeType,
  YAxisType,
  ZoomRange,
} from "../types";
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
 * Theme-aware color palette
 */
export interface ThemeColors {
  bg: string;
  bgTooltip: string;
  borderTooltip: string;
  textTooltip: string;
  axisLine: string;
  axisLabel: string;
  splitLine: string;
  axisPointerLabel: string;
  legendText: string;
}

const DARK_THEME: ThemeColors = {
  bg: "transparent",
  bgTooltip: "rgba(0,0,0,0.8)",
  borderTooltip: "#333",
  textTooltip: "#fff",
  axisLine: "#666",
  axisLabel: "#888",
  splitLine: "#333",
  axisPointerLabel: "#16213e",
  legendText: "#888",
};

const LIGHT_THEME: ThemeColors = {
  bg: "transparent",
  bgTooltip: "rgba(255,255,255,0.95)",
  borderTooltip: "#ccc",
  textTooltip: "#333",
  axisLine: "#ccc",
  axisLabel: "#666",
  splitLine: "#e0e0e0",
  axisPointerLabel: "#e8eaf0",
  legendText: "#555",
};

export function getThemeColors(theme: ThemeType): ThemeColors {
  return theme === "light" ? LIGHT_THEME : DARK_THEME;
}

/**
 * Build drawing graphic elements for ECharts
 */
function buildDrawingGraphics(
  drawings: Drawing[],
  _candles: NormalizedCandle[],
  dates: string[],
): { markLines: SeriesItem[]; markAreas: SeriesItem[]; markPoints: SeriesItem[] } {
  const markLines: SeriesItem[] = [];
  const markAreas: SeriesItem[] = [];
  const markPoints: SeriesItem[] = [];

  for (const drawing of drawings) {
    if (!drawing.visible) continue;

    switch (drawing.type) {
      case "hline": {
        markLines.push({
          yAxis: drawing.price,
          lineStyle: {
            color: drawing.color,
            width: drawing.lineWidth,
            type: "solid",
          },
          label: {
            show: true,
            formatter: drawing.label || "{c}",
            color: drawing.color,
            fontSize: 10,
            position: "insideEndTop",
          },
        });
        break;
      }
      case "trendline": {
        markLines.push([
          {
            coord: [dates[drawing.point1.dateIndex] ?? 0, drawing.point1.price],
            lineStyle: {
              color: drawing.color,
              width: drawing.lineWidth,
              type: "solid",
            },
            label: { show: false },
          },
          {
            coord: [dates[drawing.point2.dateIndex] ?? 0, drawing.point2.price],
          },
        ]);
        break;
      }
      case "fibRetracement": {
        const high = Math.max(drawing.point1.price, drawing.point2.price);
        const low = Math.min(drawing.point1.price, drawing.point2.price);
        const range = high - low;
        const fibColors = [
          "#4caf50",
          "#8bc34a",
          "#ffeb3b",
          "#ff9800",
          "#ff5722",
          "#e91e63",
          "#f44336",
        ];
        for (let i = 0; i < drawing.levels.length; i++) {
          const level = drawing.levels[i];
          const price = high - range * level;
          markLines.push({
            yAxis: price,
            lineStyle: {
              color: fibColors[i % fibColors.length],
              width: 1,
              type: "dashed",
            },
            label: {
              show: true,
              formatter: `${(level * 100).toFixed(1)}% (${price.toFixed(2)})`,
              color: fibColors[i % fibColors.length],
              fontSize: 9,
              position: "insideEndTop",
            },
          });
        }
        break;
      }
      case "rect": {
        markAreas.push([
          {
            coord: [dates[drawing.point1.dateIndex] ?? 0, drawing.point1.price],
            itemStyle: {
              color: drawing.fillColor,
              borderColor: drawing.color,
              borderWidth: drawing.lineWidth,
            },
          },
          {
            coord: [dates[drawing.point2.dateIndex] ?? 0, drawing.point2.price],
          },
        ]);
        break;
      }
      case "text": {
        markPoints.push({
          coord: [dates[drawing.dateIndex] ?? 0, drawing.price],
          symbol: "circle",
          symbolSize: 0,
          label: {
            show: true,
            formatter: drawing.text,
            color: drawing.color,
            fontSize: drawing.fontSize,
            fontWeight: "bold",
          },
        });
        break;
      }
    }
  }

  return { markLines, markAreas, markPoints };
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
  _chartHeight = 500,
  indicatorParams?: IndicatorParams,
  zoomRange?: ZoomRange,
  yAxisType?: YAxisType,
  yAxisPercent?: boolean,
  theme?: ThemeType,
  drawings?: Drawing[],
  _subchartHeights?: Record<string, number>,
): EChartsOption {
  if (candles.length === 0) {
    return {};
  }

  const tc = getThemeColors(theme ?? "dark");

  // Prepare data
  const dates = candles.map((c) => formatDate(c.time));

  // Percent mode: normalize all prices relative to first visible candle
  const percentBase = yAxisPercent && candles.length > 0 ? candles[0].close : null;
  const toPercent = (v: number) => (percentBase ? ((v - percentBase) / percentBase) * 100 : v);

  const ohlc = candles.map((c) =>
    yAxisPercent
      ? [toPercent(c.open), toPercent(c.close), toPercent(c.low), toPercent(c.high)]
      : [c.open, c.close, c.low, c.high],
  );
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
      axisLine: { lineStyle: { color: tc.axisLine } },
      axisLabel: { color: tc.axisLabel },
    },
    {
      type: "category",
      data: dates,
      gridIndex: 1,
      boundaryGap: true,
      axisLine: { lineStyle: { color: tc.axisLine } },
      axisLabel: { show: false },
    },
  ];

  // Y-axis: support log scale and percent mode
  const mainYAxisConfig: SeriesItem = {
    type: yAxisType === "log" ? "log" : "value",
    scale: true,
    splitLine: { lineStyle: { color: tc.splitLine } },
    axisLine: { lineStyle: { color: tc.axisLine } },
    axisLabel: {
      color: tc.axisLabel,
      ...(yAxisPercent && {
        formatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
      }),
    },
    axisPointer: {
      show: true,
      label: {
        show: true,
        backgroundColor: tc.axisPointerLabel,
        ...(yAxisPercent && {
          formatter: (params: { value: number }) =>
            `${params.value >= 0 ? "+" : ""}${params.value.toFixed(2)}%`,
        }),
      },
    },
  };

  const yAxes: SeriesItem[] = [
    mainYAxisConfig,
    {
      scale: true,
      gridIndex: 1,
      splitNumber: 2,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: tc.splitLine } },
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

  // Drawing elements (markLines, markAreas, markPoints)
  if (drawings && drawings.length > 0) {
    const drawingGraphics = buildDrawingGraphics(drawings, candles, dates);
    signalMarkLines.push(...drawingGraphics.markLines);
    signalMarkAreas.push(...drawingGraphics.markAreas);
    signalMarkPoints.push(...drawingGraphics.markPoints);
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
    subchartHeights: _subchartHeights,
    theme: theme ?? "dark",
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
      textStyle: { color: tc.legendText, fontSize: 11 },
      type: "scroll",
      pageIconColor: tc.legendText,
      pageIconInactiveColor: theme === "light" ? "#bbb" : "#555",
      pageTextStyle: { color: tc.legendText },
    },
    ...subchartLegends.map((legend) => ({
      data: legend.seriesNames,
      top: legend.top,
      left: 100,
      textStyle: { color: tc.legendText, fontSize: 10 },
      itemWidth: 14,
      itemHeight: 10,
      itemGap: 8,
    })),
  ];

  // Build final option
  return {
    backgroundColor: tc.bg,
    animation: false,
    title: titles,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: tc.bgTooltip,
      borderColor: tc.borderTooltip,
      textStyle: { color: tc.textTooltip },
      confine: true,
      valueFormatter: (value: unknown) => {
        if (value === null || value === undefined) return "-";
        const formatNum = (v: unknown): string => {
          if (typeof v !== "number" || !Number.isFinite(v)) return String(v ?? "-");
          if (yAxisPercent) return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
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
      label: { backgroundColor: tc.axisPointerLabel },
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
        backgroundColor: theme === "light" ? "#f5f5f5" : undefined,
        dataBackground:
          theme === "light"
            ? { lineStyle: { color: "#aaa" }, areaStyle: { color: "#ddd" } }
            : undefined,
        borderColor: theme === "light" ? "#ccc" : undefined,
        textStyle: { color: tc.axisLabel },
      },
    ],
  };
}
