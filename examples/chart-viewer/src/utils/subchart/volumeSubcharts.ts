/**
 * Volume indicator subchart builders: MFI, OBV, CMF, Volume Anomaly, Volume Profile, Volume Trend
 */

import type { IndicatorData } from "../../hooks/useIndicators";
import type { IndicatorParams, SubChartType } from "../../types";
import {
  COLORS,
  type SeriesItem,
  type SubchartContext,
  createMarkLine,
  createSubchart,
  formatLargeNumber,
} from "../chartColors";

/**
 * Build volume indicator subchart series
 */
export function buildVolumeSubcharts(
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: SubChartType[],
  indicatorParams?: IndicatorParams,
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // MFI
  if (enabledIndicators.includes("mfi") && indicators.mfi) {
    const gridIndex = createSubchart(ctx, {
      title: `MFI (${indicatorParams?.mfiPeriod ?? 14})`,
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

  // CMF - Bar chart with dynamic coloring
  if (enabledIndicators.includes("cmf") && indicators.cmf) {
    const gridIndex = createSubchart(ctx, {
      title: `CMF (${indicatorParams?.cmfPeriod ?? 20})`,
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
          color: v !== null && v >= 0 ? COLORS.up : COLORS.down,
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
            label: {
              formatter: "+0.1",
              position: "end",
              fontSize: 9,
              color: "#888",
              textBorderWidth: 0,
            },
          },
          {
            yAxis: -0.1,
            lineStyle: { color: "#ef5350", type: "dashed" },
            label: {
              formatter: "-0.1",
              position: "end",
              fontSize: 9,
              color: "#888",
              textBorderWidth: 0,
            },
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
            label: {
              formatter: "2.0x High",
              position: "end",
              fontSize: 9,
              color: "#888",
              textBorderWidth: 0,
            },
          },
          {
            yAxis: 3.0,
            lineStyle: { color: "#ef5350" },
            label: {
              formatter: "3.0x Extreme",
              position: "end",
              fontSize: 9,
              color: "#888",
              textBorderWidth: 0,
            },
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
      titleColor: COLORS.volumeProfilePoc,
      seriesNames: ["POC", "VAH", "VAL"],
    });
    series.push({
      name: "POC",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.poc ?? null),
      symbol: "none",
      lineStyle: { color: COLORS.volumeProfilePoc, width: 2 },
    });
    series.push({
      name: "VAH",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.vah ?? null),
      symbol: "none",
      lineStyle: { color: COLORS.volumeProfileVah, width: 1.5, type: "dashed" },
    });
    series.push({
      name: "VAL",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.volumeProfile.map((v) => v?.val ?? null),
      symbol: "none",
      lineStyle: { color: COLORS.volumeProfileVal, width: 1.5, type: "dashed" },
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
            label: {
              formatter: "50%",
              position: "end",
              fontSize: 9,
              color: "#888",
              textBorderWidth: 0,
            },
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

  return series;
}
