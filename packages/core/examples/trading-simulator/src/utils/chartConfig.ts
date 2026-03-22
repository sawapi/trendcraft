import type { EChartsOption } from "echarts";
import type { NormalizedCandle } from "trendcraft";
import type { DetectedVolumeSpike, Drawing, EquityPoint, SavedSession } from "../types";
import {
  COLORS,
  type ChartTheme,
  SUBCHART_INDICATORS,
  type SeriesItem,
  type SubchartContext,
  THEME_COLORS,
} from "./chartColors";
import { formatDate } from "./fileParser";
import type { IndicatorData } from "./indicators";

// Overlay builders
import { buildBandOverlays } from "./overlay/bands";
import { buildMovingAverageOverlays } from "./overlay/movingAverages";
import { buildPatternOverlays } from "./overlay/patternOverlays";
import { buildPriceOverlays } from "./overlay/priceOverlays";
import { buildSmcOverlays } from "./overlay/smcOverlays";
import { buildTrendOverlays } from "./overlay/trendOverlays";

// Subchart builders
import { buildMomentumSubcharts } from "./subchart/momentumSubcharts";
import { buildEquityCurve, buildOtherSubcharts } from "./subchart/otherSubcharts";
import { buildVolumeBarChart, buildVolumeSubcharts } from "./subchart/volumeSubcharts";

// Re-export types used by consumers
export type { ChartTheme } from "./chartColors";
export { SUBCHART_INDICATORS } from "./chartColors";

export interface PositionLine {
  entryPrice: number;
  entryIndex: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingStopPrice?: number;
}

/**
 * Calculate the chart container height (in px) based on enabled subcharts.
 */
export function getChartMinHeight(enabledIndicators: string[], hasEquityCurve: boolean): number {
  const hasVolume = enabledIndicators.includes("volume");
  const subCount =
    enabledIndicators.filter((ind) => ind !== "volume" && SUBCHART_INDICATORS.includes(ind))
      .length + (hasEquityCurve ? 1 : 0);

  const base = 40 + 300 + (hasVolume ? 60 + 80 : 0) + 10 + 30 + 20;
  const perSub = 26 + 70 + 20; // 116px per subchart
  return base + subCount * perSub;
}

export function buildChartOption(
  candles: NormalizedCandle[],
  indicators: IndicatorData,
  enabledIndicators: string[],
  tradeMarkers: {
    date: number;
    type: "BUY" | "SELL" | "SHORT_SELL" | "BUY_TO_COVER";
    price: number;
  }[] = [],
  positionLines?: PositionLine,
  equityCurve?: EquityPoint[],
  volumeSpikeMarkers: DetectedVolumeSpike[] = [],
  theme: ChartTheme = "dark",
  drawings: Drawing[] = [],
  savedSessions: SavedSession[] = [],
): EChartsOption {
  const tc = THEME_COLORS[theme];
  const dates = candles.map((c) => formatDate(c.time));

  // Heikin-Ashi: use HA candle data if enabled
  let ohlc: number[][];
  if (enabledIndicators.includes("heikinAshi") && indicators.heikinAshiData) {
    ohlc = indicators.heikinAshiData.map((ha) =>
      ha ? [ha.open, ha.close, ha.low, ha.high] : [0, 0, 0, 0],
    );
  } else {
    ohlc = candles.map((c) => [c.open, c.close, c.low, c.high]);
  }

  const volumes = candles.map((c, i) => {
    const isUp = candles[i].close >= candles[i].open;
    return {
      value: c.volume,
      itemStyle: { color: isUp ? COLORS.up : COLORS.down, opacity: 0.5 },
    };
  });

  const series: SeriesItem[] = [
    {
      name: "K",
      type: "candlestick",
      data: ohlc,
      itemStyle: {
        color: COLORS.up,
        color0: COLORS.down,
        borderColor: COLORS.up,
        borderColor0: COLORS.down,
      },
      markPoint: buildTradeMarkers(candles, tradeMarkers),
      markLine: buildPositionLines(positionLines, candles.length, tc.labelBg),
    },
  ];

  // ========== User drawings ==========
  if (drawings.length > 0) {
    const drawingLines = drawings
      .filter((d) => d.type === "horizontal" && d.price != null)
      .map((d) => ({
        yAxis: d.price,
        lineStyle: {
          color: d.color,
          width: 1.5,
          type: "dashed" as const,
        },
        label: {
          show: !!d.label,
          formatter: d.label || "",
          position: "insideEndTop" as const,
          color: d.color,
          fontSize: 10,
          backgroundColor: tc.labelBg,
          padding: [2, 4],
          borderRadius: 2,
        },
      }));

    if (drawingLines.length > 0) {
      series.push({
        name: "Drawings",
        type: "line",
        data: [],
        xAxisIndex: 0,
        yAxisIndex: 0,
        markLine: {
          silent: true,
          symbol: "none",
          data: drawingLines,
        },
      });
    }
  }

  // ========== Overlay indicators ==========
  buildMovingAverageOverlays(series, indicators, enabledIndicators);
  buildTrendOverlays(series, indicators, enabledIndicators);
  buildBandOverlays(series, indicators, enabledIndicators);
  buildSmcOverlays(series, indicators, enabledIndicators, candles);
  buildPatternOverlays(series, indicators, enabledIndicators, candles);
  buildPriceOverlays(series, indicators, enabledIndicators, candles);

  // ========== Dynamic subchart calculation ==========
  const hasEquityCurveData = equityCurve && equityCurve.length > 1;
  const hasVolume = enabledIndicators.includes("volume");

  // Pixel constants
  const mainChartTop = 40;
  const mainChartHeight = 300;
  const volumeGap = 60;
  const volumeHeight = 80;
  const dataZoomGap = 10;
  const dataZoomHeight = 30;
  const labelHeight = 26;
  const subHeight = 70;
  const subChartGap = 20;

  const volumeTop = mainChartTop + mainChartHeight + volumeGap;
  const dataZoomTop = volumeTop + (hasVolume ? volumeHeight : 0) + dataZoomGap;
  const subchartsStart = dataZoomTop + dataZoomHeight + subChartGap;

  const grids: SeriesItem[] = [{ left: 60, right: 40, top: mainChartTop, height: mainChartHeight }];
  const titles: SeriesItem[] = [];
  const xAxes: SeriesItem[] = [
    {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: tc.gridLine } },
      axisLabel: { color: tc.axisLabel },
    },
  ];
  const yAxes: SeriesItem[] = [
    {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: tc.gridLine } },
      axisLabel: { color: tc.axisLabel },
    },
  ];

  const subchartCtx: SubchartContext = {
    grids,
    titles,
    xAxes,
    yAxes,
    dates,
    currentTop: subchartsStart,
    labelHeight,
    subHeight,
    subChartGap,
    themeColors: tc,
  };

  // Volume (dedicated grid below main chart)
  if (hasVolume) {
    buildVolumeBarChart(
      series,
      grids,
      xAxes,
      yAxes,
      titles,
      dates,
      volumes,
      candles,
      volumeTop,
      volumeHeight,
      volumeSpikeMarkers,
    );
  }

  // ========== Subchart indicators ==========
  buildMomentumSubcharts(series, subchartCtx, indicators, enabledIndicators);
  buildOtherSubcharts(series, subchartCtx, indicators, enabledIndicators);
  buildVolumeSubcharts(series, subchartCtx, indicators, enabledIndicators);

  // Equity Curve
  if (hasEquityCurveData && equityCurve) {
    buildEquityCurve(series, subchartCtx, candles, equityCurve, savedSessions);
  }

  return {
    backgroundColor: tc.bg,
    animation: false,
    title: titles,
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series,
    axisPointer: {
      link: [{ xAxisIndex: "all" }],
      label: { backgroundColor: tc.tooltipBg },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: tc.tooltipBg,
      borderColor: tc.gridLine,
      textStyle: { color: tc.textPrimary },
    },
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: xAxes.map((_: SeriesItem, i: number) => i),
        start: Math.max(0, 100 - (100 / candles.length) * 100),
        end: 100,
      },
      {
        type: "slider",
        xAxisIndex: xAxes.map((_: SeriesItem, i: number) => i),
        top: dataZoomTop,
        height: dataZoomHeight,
        start: Math.max(0, 100 - (100 / candles.length) * 100),
        end: 100,
      },
    ],
  };
}

function buildTradeMarkers(
  candles: NormalizedCandle[],
  trades: { date: number; type: "BUY" | "SELL" | "SHORT_SELL" | "BUY_TO_COVER"; price: number }[],
): SeriesItem | undefined {
  if (trades.length === 0) return undefined;

  const markerConfig: Record<
    string,
    { symbol: string; size: number; rotate: number; color: string; label: string }
  > = {
    BUY: { symbol: "triangle", size: 15, rotate: 0, color: "#4ade80", label: "B" },
    SELL: { symbol: "pin", size: 20, rotate: 180, color: "#ef4444", label: "S" },
    SHORT_SELL: { symbol: "triangle", size: 15, rotate: 180, color: "#f97316", label: "SS" },
    BUY_TO_COVER: { symbol: "pin", size: 20, rotate: 0, color: "#38bdf8", label: "BC" },
  };

  const data = trades
    .map((trade) => {
      const idx = candles.findIndex((c) => c.time === trade.date);
      if (idx === -1) return null;

      const cfg = markerConfig[trade.type] || markerConfig.BUY;

      return {
        name: trade.type,
        value: trade.type,
        coord: [idx, trade.price],
        symbol: cfg.symbol,
        symbolSize: cfg.size,
        symbolRotate: cfg.rotate,
        itemStyle: { color: cfg.color },
        label: {
          show: true,
          formatter: cfg.label,
          color: "#fff",
          fontSize: 10,
        },
      };
    })
    .filter(Boolean);

  return { data };
}

function buildPositionLines(
  positionLines: PositionLine | undefined,
  _candleCount: number,
  labelBg = "#0d0d0f",
): SeriesItem | undefined {
  if (!positionLines) return undefined;

  const { entryPrice, stopLossPercent, takeProfitPercent, trailingStopPrice } = positionLines;
  const data: SeriesItem[] = [];

  // Entry line
  data.push({
    yAxis: entryPrice,
    symbol: "none",
    lineStyle: { color: "#4ade80", width: 1.5, type: "solid" },
    label: {
      show: true,
      position: "end",
      formatter: `Entry: ${entryPrice.toLocaleString()}`,
      color: "#4ade80",
      fontSize: 10,
      backgroundColor: labelBg,
      padding: [2, 4],
    },
  });

  // Take profit line
  if (takeProfitPercent && takeProfitPercent > 0) {
    const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
    data.push({
      yAxis: takeProfitPrice,
      symbol: "none",
      lineStyle: { color: "#22d3ee", width: 1.5, type: "dashed" },
      label: {
        show: true,
        position: "end",
        formatter: `TP +${takeProfitPercent}%`,
        color: "#22d3ee",
        fontSize: 10,
        backgroundColor: labelBg,
        padding: [2, 4],
      },
    });
  }

  // Stop loss line
  if (stopLossPercent && stopLossPercent > 0) {
    const stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
    data.push({
      yAxis: stopLossPrice,
      symbol: "none",
      lineStyle: { color: "#ef4444", width: 1.5, type: "dashed" },
      label: {
        show: true,
        position: "end",
        formatter: `SL -${stopLossPercent}%`,
        color: "#ef4444",
        fontSize: 10,
        backgroundColor: labelBg,
        padding: [2, 4],
      },
    });
  }

  // Trailing stop line
  if (trailingStopPrice && trailingStopPrice > 0) {
    const trailingPct = (((entryPrice - trailingStopPrice) / entryPrice) * 100).toFixed(1);
    data.push({
      yAxis: trailingStopPrice,
      symbol: "none",
      lineStyle: { color: "#f59e0b", width: 2, type: "dotted" },
      label: {
        show: true,
        position: "end",
        formatter: `TS ${trailingStopPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} (-${trailingPct}%)`,
        color: "#f59e0b",
        fontSize: 10,
        backgroundColor: labelBg,
        padding: [2, 4],
      },
    });
  }

  return { silent: true, symbol: "none", data };
}
