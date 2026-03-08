/**
 * Momentum indicator subchart builders: RSI, MACD, Stochastics, Stoch RSI, CCI, Williams %R, ROC
 */

import type { IndicatorData } from "../../hooks/useIndicators";
import type { IndicatorParams, SubChartType } from "../../types";
import {
  COLORS,
  type SeriesItem,
  type SubchartContext,
  createMarkLine,
  createSubchart,
} from "../chartColors";

/**
 * Build momentum indicator subchart series
 */
export function buildMomentumSubcharts(
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: SubChartType[],
  indicatorParams?: IndicatorParams,
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // RSI
  if (enabledIndicators.includes("rsi") && indicators.rsi) {
    const gridIndex = createSubchart(ctx, {
      title: `RSI (${indicatorParams?.rsiPeriod ?? 14})`,
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
    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
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

  // Stoch RSI
  if (enabledIndicators.includes("stochrsi") && indicators.stochRsiK && indicators.stochRsiD) {
    const gridIndex = createSubchart(ctx, {
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

  // CCI
  if (enabledIndicators.includes("cci") && indicators.cci) {
    const gridIndex = createSubchart(ctx, {
      title: `CCI (${indicatorParams?.cciPeriod ?? 20})`,
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
    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
      title: `ROC (${indicatorParams?.rocPeriod ?? 12})`,
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

  // TRIX
  if (enabledIndicators.includes("trix") && indicators.trixLine && indicators.trixSignal) {
    const gridIndex = createSubchart(ctx, {
      title: `TRIX (${indicatorParams?.trixPeriod ?? 15})`,
      titleColor: COLORS.trixLine,
      seriesNames: ["TRIX", "TRIX Signal"],
    });
    series.push({
      name: "TRIX",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.trixLine,
      symbol: "none",
      lineStyle: { color: COLORS.trixLine, width: 1.5 },
    });
    series.push({
      name: "TRIX Signal",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.trixSignal,
      symbol: "none",
      lineStyle: { color: COLORS.trixSignal, width: 1.5 },
    });
    series.push({
      name: "TRIX Markers",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: [],
      markLine: createMarkLine([0]),
    });
  }

  // Aroon
  if (
    enabledIndicators.includes("aroon") &&
    indicators.aroonUp &&
    indicators.aroonDown &&
    indicators.aroonOscillator
  ) {
    const gridIndex = createSubchart(ctx, {
      title: `Aroon (${indicatorParams?.aroonPeriod ?? 25})`,
      titleColor: COLORS.aroonUp,
      seriesNames: ["Aroon Up", "Aroon Down", "Aroon Osc"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "Aroon Up",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.aroonUp,
      symbol: "none",
      lineStyle: { color: COLORS.aroonUp, width: 1.5 },
    });
    series.push({
      name: "Aroon Down",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.aroonDown,
      symbol: "none",
      lineStyle: { color: COLORS.aroonDown, width: 1.5 },
    });
    series.push({
      name: "Aroon Markers",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: [],
      markLine: createMarkLine([30, 70]),
    });
  }

  // DPO
  if (enabledIndicators.includes("dpo") && indicators.dpo) {
    const gridIndex = createSubchart(ctx, {
      title: `DPO (${indicatorParams?.dpoPeriod ?? 20})`,
      titleColor: COLORS.dpo,
      seriesNames: ["DPO"],
    });
    series.push({
      name: "DPO",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dpo,
      symbol: "none",
      lineStyle: { color: COLORS.dpo, width: 1.5 },
      markLine: createMarkLine([0]),
    });
  }

  // Hurst Exponent
  if (enabledIndicators.includes("hurst") && indicators.hurst) {
    const gridIndex = createSubchart(ctx, {
      title: "Hurst Exponent",
      titleColor: COLORS.hurst,
      seriesNames: ["Hurst"],
      yAxisMin: 0,
      yAxisMax: 1,
    });
    series.push({
      name: "Hurst",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.hurst,
      symbol: "none",
      lineStyle: { color: COLORS.hurst, width: 1.5 },
      markLine: createMarkLine([0.5]),
    });
  }

  return series;
}
