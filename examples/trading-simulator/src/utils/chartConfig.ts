import type { EChartsOption } from "echarts";
import type { NormalizedCandle } from "../types";
import type { IndicatorData } from "./indicators";
import { formatDate } from "./fileParser";

const COLORS = {
  up: "#4ade80",
  down: "#ef4444",
  sma5: "#f59e0b",
  sma25: "#3b82f6",
  sma75: "#a855f7",
  ema12: "#22d3d8",
  ema26: "#f472b6",
  bbUpper: "#6b7280",
  bbMiddle: "#9ca3af",
  bbLower: "#6b7280",
  volume: "#4b5563",
  rsi: "#f59e0b",
  macdLine: "#3b82f6",
  macdSignal: "#ef4444",
  macdHistUp: "#4ade80",
  macdHistDown: "#ef4444",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeriesItem = any;

export function buildChartOption(
  candles: NormalizedCandle[],
  indicators: IndicatorData,
  enabledIndicators: string[],
  tradeMarkers: { date: number; type: "BUY" | "SELL"; price: number }[] = []
): EChartsOption {
  const dates = candles.map((c) => formatDate(c.time));
  const ohlc = candles.map((c) => [c.open, c.close, c.low, c.high]);
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
    },
  ];

  // Add indicator series
  if (enabledIndicators.includes("sma5") && indicators.sma5) {
    series.push(createLineSeries("SMA5", indicators.sma5, COLORS.sma5));
  }
  if (enabledIndicators.includes("sma25") && indicators.sma25) {
    series.push(createLineSeries("SMA25", indicators.sma25, COLORS.sma25));
  }
  if (enabledIndicators.includes("sma75") && indicators.sma75) {
    series.push(createLineSeries("SMA75", indicators.sma75, COLORS.sma75));
  }
  if (enabledIndicators.includes("ema12") && indicators.ema12) {
    series.push(createLineSeries("EMA12", indicators.ema12, COLORS.ema12));
  }
  if (enabledIndicators.includes("ema26") && indicators.ema26) {
    series.push(createLineSeries("EMA26", indicators.ema26, COLORS.ema26));
  }
  if (enabledIndicators.includes("bb")) {
    if (indicators.bbUpper) {
      series.push(
        createLineSeries("BB Upper", indicators.bbUpper, COLORS.bbUpper, "dashed")
      );
    }
    if (indicators.bbMiddle) {
      series.push(
        createLineSeries("BB Middle", indicators.bbMiddle, COLORS.bbMiddle)
      );
    }
    if (indicators.bbLower) {
      series.push(
        createLineSeries("BB Lower", indicators.bbLower, COLORS.bbLower, "dashed")
      );
    }
  }

  // Volume series
  if (enabledIndicators.includes("volume")) {
    series.push({
      name: "Volume",
      type: "bar",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: volumes,
    });
  }

  // Calculate grid heights
  const hasVolume = enabledIndicators.includes("volume");
  const hasRsi = enabledIndicators.includes("rsi");
  const hasMacd = enabledIndicators.includes("macd");
  const subChartCount = (hasRsi ? 1 : 0) + (hasMacd ? 1 : 0);

  const mainHeight = hasVolume ? 55 : 70;
  const volumeHeight = hasVolume ? 15 : 0;
  const subHeight = subChartCount > 0 ? 20 / subChartCount : 0;

  const grids: SeriesItem[] = [
    { left: 60, right: 40, top: 40, height: `${mainHeight}%` },
  ];

  const xAxes: SeriesItem[] = [
    {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0" },
    },
  ];

  const yAxes: SeriesItem[] = [
    {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0" },
    },
  ];

  let currentTop = mainHeight + 5;

  if (hasVolume) {
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop}%`,
      height: `${volumeHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex: 1,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex: 1,
      splitLine: { show: false },
      axisLabel: { show: false },
    });
    currentTop += volumeHeight + 2;
  }

  // RSI
  if (hasRsi && indicators.rsi) {
    const gridIndex = grids.length;
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0" },
    });
    series.push({
      name: "RSI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.rsi,
      symbol: "none",
      lineStyle: { color: COLORS.rsi, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 30 }, { yAxis: 70 }],
      },
    });
    currentTop += subHeight + 2;
  }

  // MACD
  if (hasMacd && indicators.macdLine && indicators.macdSignal && indicators.macdHist) {
    const gridIndex = grids.length;
    grids.push({
      left: 60,
      right: 40,
      top: `${currentTop}%`,
      height: `${subHeight}%`,
    });
    xAxes.push({
      type: "category",
      gridIndex,
      data: dates,
      show: false,
    });
    yAxes.push({
      type: "value",
      gridIndex,
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#a0a0a0" },
    });

    series.push({
      name: "MACD",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdLine,
      symbol: "none",
      lineStyle: { color: COLORS.macdLine, width: 1.5 },
    });
    series.push({
      name: "Signal",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.macdSignal,
      symbol: "none",
      lineStyle: { color: COLORS.macdSignal, width: 1.5 },
    });
    series.push({
      name: "Histogram",
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

  return {
    backgroundColor: "#1a1a2e",
    animation: false,
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series,
    axisPointer: {
      link: [{ xAxisIndex: "all" }],
      label: { backgroundColor: "#16213e" },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      backgroundColor: "#16213e",
      borderColor: "#333",
      textStyle: { color: "#eaeaea" },
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
        top: "95%",
        height: 20,
        start: Math.max(0, 100 - (100 / candles.length) * 100),
        end: 100,
      },
    ],
  };
}

function createLineSeries(
  name: string,
  data: (number | null)[],
  color: string,
  lineType: "solid" | "dashed" = "solid"
): SeriesItem {
  return {
    name,
    type: "line",
    data,
    symbol: "none",
    lineStyle: {
      color,
      width: 1.5,
      type: lineType,
    },
  };
}

function buildTradeMarkers(
  candles: NormalizedCandle[],
  trades: { date: number; type: "BUY" | "SELL"; price: number }[]
): SeriesItem | undefined {
  if (trades.length === 0) return undefined;

  const data = trades
    .map((trade) => {
      const idx = candles.findIndex((c) => c.time === trade.date);
      if (idx === -1) return null;

      return {
        name: trade.type,
        value: trade.type,
        coord: [idx, trade.price],
        symbol: trade.type === "BUY" ? "triangle" : "pin",
        symbolSize: trade.type === "BUY" ? 15 : 20,
        symbolRotate: trade.type === "BUY" ? 0 : 180,
        itemStyle: {
          color: trade.type === "BUY" ? "#4ade80" : "#ef4444",
        },
        label: {
          show: true,
          formatter: trade.type === "BUY" ? "B" : "S",
          color: "#fff",
          fontSize: 10,
        },
      };
    })
    .filter(Boolean);

  return { data };
}
