/**
 * Other indicator subchart builders: DMI/ADX, Range-Bound, ATR, Volatility Regime, PER, PBR, ROE, Scoring
 */

import type { IndicatorParams, SubChartType } from "../../types";
import type { IndicatorData } from "../../hooks/useIndicators";
import {
  COLORS,
  createMarkLine,
  createSubchart,
  type SeriesItem,
  type SubchartContext,
} from "../chartColors";

/**
 * Build other indicator subchart series (DMI/ADX, Range-Bound, ATR, Volatility Regime, PER, PBR, ROE, Scoring)
 */
export function buildOtherSubcharts(
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: SubChartType[],
  indicatorParams?: IndicatorParams,
): SeriesItem[] {
  const series: SeriesItem[] = [];

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

  // Roofing Filter
  if (enabledIndicators.includes("roofingFilter") && indicators.roofingFilter) {
    const gridIndex = createSubchart(ctx, {
      title: "Roofing Filter",
      titleColor: COLORS.roofingFilter,
      seriesNames: ["Roofing"],
      markLines: [0],
    });
    series.push({
      name: "Roofing",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.roofingFilter,
      symbol: "none",
      lineStyle: { color: COLORS.roofingFilter, width: 1.5 },
      markLine: createMarkLine([0]),
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
