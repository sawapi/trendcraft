import type { NormalizedCandle } from "trendcraft";
import type { EquityPoint } from "../../types";
import {
  COLORS,
  type SeriesItem,
  type SubchartContext,
  createSubchart,
  formatLargeNumber,
} from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build other subchart series (ATR, DMI, Choppiness, Vortex, ADXR, Roofing Filter, etc.)
 */
export function buildOtherSubcharts(
  series: SeriesItem[],
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: string[],
): void {
  // DMI/ADX
  if (
    enabledIndicators.includes("dmi") &&
    indicators.dmiPlusDi &&
    indicators.dmiMinusDi &&
    indicators.dmiAdx
  ) {
    const gridIndex = createSubchart(ctx, {
      title: "DMI",
      titleColor: COLORS.dmiAdx,
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
  }

  // ATR
  if (enabledIndicators.includes("atr") && indicators.atr) {
    const gridIndex = createSubchart(ctx, {
      title: "ATR",
      titleColor: COLORS.atr,
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

  // ADXR
  if (enabledIndicators.includes("adxr") && indicators.adxrData) {
    const gridIndex = createSubchart(ctx, {
      title: "ADXR",
      titleColor: COLORS.adxrLine,
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "ADXR",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.adxrData,
      symbol: "none",
      lineStyle: { color: COLORS.adxrLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 25 }],
      },
    });
  }

  // Vortex
  if (enabledIndicators.includes("vortex") && indicators.vortexPlus && indicators.vortexMinus) {
    const gridIndex = createSubchart(ctx, {
      title: "Vortex",
      titleColor: COLORS.vortexPlus,
    });
    series.push({
      name: "VI+",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.vortexPlus,
      symbol: "none",
      lineStyle: { color: COLORS.vortexPlus, width: 1.5 },
    });
    series.push({
      name: "VI-",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.vortexMinus,
      symbol: "none",
      lineStyle: { color: COLORS.vortexMinus, width: 1.5 },
    });
  }

  // Roofing Filter
  if (enabledIndicators.includes("roofingFilter") && indicators.roofingFilterData) {
    const gridIndex = createSubchart(ctx, {
      title: "Roofing Filter",
      titleColor: COLORS.roofingFilterLine,
    });
    series.push({
      name: "Roofing",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.roofingFilterData,
      symbol: "none",
      lineStyle: { color: COLORS.roofingFilterLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 0 }],
      },
    });
  }

  // Choppiness Index
  if (enabledIndicators.includes("choppiness") && indicators.choppinessData) {
    const gridIndex = createSubchart(ctx, {
      title: "Choppiness",
      titleColor: COLORS.choppiness,
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "Choppiness",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.choppinessData,
      symbol: "none",
      lineStyle: { color: COLORS.choppiness, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 38.2 }, { yAxis: 61.8 }],
      },
    });
  }

  // Volatility Regime (HMM)
  if (enabledIndicators.includes("volatilityRegime") && indicators.volatilityRegimeData) {
    const gridIndex = createSubchart(ctx, {
      title: "Vol Regime",
      titleColor: COLORS.volatilityRegime,
    });
    const regimeColors = ["#4ade80", "#f59e0b", "#ef4444", "#818cf8"];
    const regimeData = indicators.volatilityRegimeData.map((d) => {
      if (!d) return null;
      const color = regimeColors[d.regime % regimeColors.length];
      return { value: d.regime, itemStyle: { color } };
    });
    series.push({
      name: "Regime",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: regimeData,
    });
  }
}

/**
 * Build equity curve subchart
 */
export function buildEquityCurve(
  series: SeriesItem[],
  ctx: SubchartContext,
  candles: NormalizedCandle[],
  equityCurve: EquityPoint[],
): void {
  const gridIndex = createSubchart(ctx, {
    title: "Equity",
    titleColor: COLORS.equity,
    yAxisLabelFormatter: formatLargeNumber,
  });

  const equityByTime = new Map(equityCurve.map((p) => [p.time, p]));
  const equityData = candles.map((c) => {
    const point = equityByTime.get(c.time);
    return point ? point.equity : null;
  });
  const buyHoldData = candles.map((c) => {
    const point = equityByTime.get(c.time);
    return point ? point.buyHoldEquity : null;
  });

  // Buy & Hold line
  series.push({
    name: "Buy&Hold",
    type: "line",
    xAxisIndex: gridIndex,
    yAxisIndex: gridIndex,
    data: buyHoldData,
    symbol: "none",
    lineStyle: { color: COLORS.buyHold, width: 1, type: "dashed" },
  });

  // Equity line
  series.push({
    name: "Equity",
    type: "line",
    xAxisIndex: gridIndex,
    yAxisIndex: gridIndex,
    data: equityData,
    symbol: "none",
    lineStyle: { color: COLORS.equity, width: 2 },
    areaStyle: {
      color: {
        type: "linear",
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: "rgba(74, 222, 128, 0.3)" },
          { offset: 1, color: "rgba(74, 222, 128, 0)" },
        ],
      },
    },
  });

  // Trade markers
  const tradePoints = equityCurve
    .filter((p) => p.tradeType)
    .map((p) => {
      const idx = candles.findIndex((c) => c.time === p.time);
      if (idx === -1) return null;
      return {
        coord: [idx, p.equity],
        symbol: p.tradeType === "BUY" ? "triangle" : "pin",
        symbolSize: 10,
        symbolRotate: p.tradeType === "BUY" ? 0 : 180,
        itemStyle: { color: p.tradeType === "BUY" ? "#4ade80" : "#ef4444" },
      };
    })
    .filter(Boolean);

  if (tradePoints.length > 0) {
    series.push({
      name: "Trade Markers",
      type: "scatter",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: [],
      markPoint: { data: tradePoints },
    });
  }
}
