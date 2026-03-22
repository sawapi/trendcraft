import {
  COLORS,
  type SeriesItem,
  type SubchartContext,
  createLineSeries,
  createSubchart,
} from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build momentum subchart series (RSI, MACD, Stoch, Williams, ROC, etc.)
 */
export function buildMomentumSubcharts(
  series: SeriesItem[],
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: string[],
): void {
  // RSI
  if (enabledIndicators.includes("rsi") && indicators.rsi) {
    const gridIndex = createSubchart(ctx, {
      title: "RSI",
      titleColor: COLORS.rsi,
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
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 30 }, { yAxis: 70 }],
      },
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

  // Stochastics
  if (enabledIndicators.includes("stochastics") && indicators.stochK && indicators.stochD) {
    const gridIndex = createSubchart(ctx, {
      title: "Stoch",
      titleColor: COLORS.stochK,
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
  }

  // Stochastic RSI
  if (enabledIndicators.includes("stochRsi") && indicators.stochRsiK && indicators.stochRsiD) {
    const gridIndex = createSubchart(ctx, {
      title: "StochRSI",
      titleColor: COLORS.stochRsiK,
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "StochRSI %K",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochRsiK,
      symbol: "none",
      lineStyle: { color: COLORS.stochRsiK, width: 1.5 },
    });
    series.push({
      name: "StochRSI %D",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.stochRsiD,
      symbol: "none",
      lineStyle: { color: COLORS.stochRsiD, width: 1.5 },
    });
  }

  // CCI
  if (enabledIndicators.includes("cci") && indicators.cci) {
    const gridIndex = createSubchart(ctx, {
      title: "CCI",
      titleColor: COLORS.cci,
    });
    series.push({
      name: "CCI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.cci,
      symbol: "none",
      lineStyle: { color: COLORS.cci, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: -100 }, { yAxis: 100 }],
      },
    });
  }

  // Williams %R
  if (enabledIndicators.includes("williams") && indicators.williams) {
    const gridIndex = createSubchart(ctx, {
      title: "Williams %R",
      titleColor: COLORS.williams,
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
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: -20 }, { yAxis: -80 }],
      },
    });
  }

  // ROC
  if (enabledIndicators.includes("roc") && indicators.rocData) {
    const gridIndex = createSubchart(ctx, {
      title: "ROC",
      titleColor: COLORS.rocLine,
    });
    series.push({
      name: "ROC",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.rocData,
      symbol: "none",
      lineStyle: { color: COLORS.rocLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 0 }],
      },
    });
  }

  // Connors RSI
  if (enabledIndicators.includes("connorsRsi") && indicators.connorsRsiLine) {
    const gridIndex = createSubchart(ctx, {
      title: "Connors RSI",
      titleColor: COLORS.connorsRsiLine,
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "Connors RSI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.connorsRsiLine,
      symbol: "none",
      lineStyle: { color: COLORS.connorsRsiLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 10 }, { yAxis: 90 }],
      },
    });
  }

  // CMO
  if (enabledIndicators.includes("cmo") && indicators.cmoData) {
    const gridIndex = createSubchart(ctx, {
      title: "CMO",
      titleColor: COLORS.cmo,
      yAxisMin: -100,
      yAxisMax: 100,
    });
    series.push({
      name: "CMO",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.cmoData,
      symbol: "none",
      lineStyle: { color: COLORS.cmo, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: -50 }, { yAxis: 50 }],
      },
    });
  }

  // IMI
  if (enabledIndicators.includes("imi") && indicators.imiData) {
    const gridIndex = createSubchart(ctx, {
      title: "IMI",
      titleColor: COLORS.imiLine,
      yAxisMin: 0,
      yAxisMax: 100,
    });
    series.push({
      name: "IMI",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.imiData,
      symbol: "none",
      lineStyle: { color: COLORS.imiLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 30 }, { yAxis: 70 }],
      },
    });
  }

  // TRIX
  if (enabledIndicators.includes("trix") && indicators.trixLine) {
    const gridIndex = createSubchart(ctx, {
      title: "TRIX",
      titleColor: COLORS.trixLine,
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
    if (indicators.trixSignal) {
      series.push({
        name: "TRIX Signal",
        type: "line",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: indicators.trixSignal,
        symbol: "none",
        lineStyle: { color: COLORS.trixSignal, width: 1.5 },
      });
    }
    series.push({
      ...createLineSeries("", [], "#666"),
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 0 }],
      },
    });
  }

  // Aroon
  if (enabledIndicators.includes("aroon") && indicators.aroonUp && indicators.aroonDown) {
    const gridIndex = createSubchart(ctx, {
      title: "Aroon",
      titleColor: COLORS.aroonUp,
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
  }

  // DPO
  if (enabledIndicators.includes("dpo") && indicators.dpoData) {
    const gridIndex = createSubchart(ctx, {
      title: "DPO",
      titleColor: COLORS.dpoLine,
    });
    series.push({
      name: "DPO",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.dpoData,
      symbol: "none",
      lineStyle: { color: COLORS.dpoLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 0 }],
      },
    });
  }

  // Hurst Exponent
  if (enabledIndicators.includes("hurst") && indicators.hurstData) {
    const gridIndex = createSubchart(ctx, {
      title: "Hurst",
      titleColor: COLORS.hurstLine,
    });
    series.push({
      name: "Hurst",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.hurstData,
      symbol: "none",
      lineStyle: { color: COLORS.hurstLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 0.5 }],
      },
    });
  }
}
