/**
 * Subchart series builder for indicator subcharts (RSI, MACD, etc.)
 */

import type { IndicatorParams, SubChartType } from "../types";
import type { IndicatorData } from "../hooks/useIndicators";
import {
  COLORS,
  createMarkLine,
  createSubchart,
  formatLargeNumber,
  type SeriesItem,
  type SubchartContext,
} from "./chartColors";

/**
 * Build subchart indicator series
 */
export function buildSubchartSeries(
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: SubChartType[],
  indicatorParams?: IndicatorParams,
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // RSI
  if (enabledIndicators.includes("rsi") && indicators.rsi) {
    const gridIndex = createSubchart(ctx, {
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

  // DMI/ADX
  if (
    enabledIndicators.includes("dmi") &&
    indicators.dmiPlusDi &&
    indicators.dmiMinusDi &&
    indicators.dmiAdx
  ) {
    const gridIndex = createSubchart(ctx, {
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

  // MFI
  if (enabledIndicators.includes("mfi") && indicators.mfi) {
    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
      title: "Range-Bound",
      titleColor: COLORS.rangebound,
      seriesNames: ["RB Score"],
      yAxisMin: 0,
      yAxisMax: 100,
    });
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
    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
      title: "Volume Anomaly",
      titleColor: COLORS.volumeAnomaly,
      seriesNames: ["Vol Ratio"],
    });

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
    const gridIndex = createSubchart(ctx, {
      title: "Volume Profile",
      titleColor: "#ff5722",
      seriesNames: ["POC", "VAH", "VAL"],
    });
    series.push({
      name: "POC",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.poc ?? null),
      symbol: "none",
      lineStyle: { color: "#ff5722", width: 2 },
    });
    series.push({
      name: "VAH",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.vah ?? null),
      symbol: "none",
      lineStyle: { color: "#4caf50", width: 1.5, type: "dashed" },
    });
    series.push({
      name: "VAL",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.val ?? null),
      symbol: "none",
      lineStyle: { color: "#f44336", width: 1.5, type: "dashed" },
    });
  }

  // Volume Trend
  if (enabledIndicators.includes("volumeTrend") && indicators.volumeTrend) {
    const gridIndex = createSubchart(ctx, {
      title: "Volume Trend",
      titleColor: COLORS.volumeTrendUp,
      seriesNames: ["VT Confidence"],
      yAxisMin: 0,
      yAxisMax: 100,
    });

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

    series.push({
      name: "VT Confidence",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeTrend.map((v) => ({
        value: v.confidence,
        itemStyle: {
          color: v.hasDivergence
            ? "#ff9800"
            : v.isConfirmed && v.priceTrend === "up"
              ? COLORS.volumeTrendUp
              : v.isConfirmed && v.priceTrend === "down"
                ? COLORS.volumeTrendDown
                : "#888",
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
    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
      title: "Volatility Regime",
      titleColor: COLORS.volRegimeHigh,
      seriesNames: ["ATR Percentile"],
      yAxisMin: 0,
      yAxisMax: 100,
    });

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
    const lastPerValue = indicators.per.filter((v): v is number => v !== null).pop();
    let perTitle = "PER";
    if (lastPerValue !== undefined) {
      if (indicators.perPercentile) {
        perTitle = `PER ${lastPerValue.toFixed(1)} (${indicators.perPercentile.level} ${indicators.perPercentile.value}%)`;
      } else {
        perTitle = `PER ${lastPerValue.toFixed(1)}`;
      }
    }

    const gridIndex = createSubchart(ctx, {
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
    const lastPbrValue = indicators.pbr.filter((v): v is number => v !== null).pop();
    let pbrTitle = "PBR";
    if (lastPbrValue !== undefined) {
      if (indicators.pbrPercentile) {
        pbrTitle = `PBR ${lastPbrValue.toFixed(2)} (${indicators.pbrPercentile.level} ${indicators.pbrPercentile.value}%)`;
      } else {
        pbrTitle = `PBR ${lastPbrValue.toFixed(2)}`;
      }
    }

    const gridIndex = createSubchart(ctx, {
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
    const lastRoeValue = indicators.roe.filter((v): v is number => v !== null).pop();
    let roeTitle = "ROE";
    if (lastRoeValue !== undefined) {
      if (indicators.roePercentile) {
        roeTitle = `ROE ${lastRoeValue.toFixed(1)}% (${indicators.roePercentile.level} ${indicators.roePercentile.value}%)`;
      } else {
        roeTitle = `ROE ${lastRoeValue.toFixed(1)}%`;
      }
    }

    const gridIndex = createSubchart(ctx, {
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
    const gridIndex = createSubchart(ctx, {
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

  return series;
}
