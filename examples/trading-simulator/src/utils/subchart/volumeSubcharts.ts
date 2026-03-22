import type { NormalizedCandle } from "trendcraft";
import type { DetectedVolumeSpike } from "../../types";
import {
  COLORS,
  type SeriesItem,
  type SubchartContext,
  createSubchart,
  formatLargeNumber,
} from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build volume-related subchart series
 */
export function buildVolumeSubcharts(
  series: SeriesItem[],
  ctx: SubchartContext,
  indicators: IndicatorData,
  enabledIndicators: string[],
): void {
  // OBV
  if (enabledIndicators.includes("obv") && indicators.obv) {
    const gridIndex = createSubchart(ctx, {
      title: "OBV",
      titleColor: "#a0a0a0",
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
    });
  }

  // MFI
  if (enabledIndicators.includes("mfi") && indicators.mfi) {
    const gridIndex = createSubchart(ctx, {
      title: "MFI",
      titleColor: COLORS.mfi,
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
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 20 }, { yAxis: 80 }],
      },
    });
  }

  // CMF
  if (enabledIndicators.includes("cmf") && indicators.cmfData) {
    const gridIndex = createSubchart(ctx, {
      title: "CMF",
      titleColor: COLORS.cmfLine,
    });
    series.push({
      name: "CMF",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.cmfData,
      symbol: "none",
      lineStyle: { color: COLORS.cmfLine, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 0 }],
      },
    });
  }

  // ADL
  if (enabledIndicators.includes("adl") && indicators.adlData) {
    const gridIndex = createSubchart(ctx, {
      title: "ADL",
      titleColor: "#a0a0a0",
      yAxisLabelFormatter: formatLargeNumber,
    });
    series.push({
      name: "ADL",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.adlData,
      symbol: "none",
      lineStyle: { color: COLORS.adlLine, width: 1.5 },
    });
  }

  // Klinger
  if (enabledIndicators.includes("klinger") && indicators.klingerLine) {
    const gridIndex = createSubchart(ctx, {
      title: "Klinger",
      titleColor: COLORS.klingerLine,
      yAxisLabelFormatter: formatLargeNumber,
    });
    series.push({
      name: "Klinger",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.klingerLine,
      symbol: "none",
      lineStyle: { color: COLORS.klingerLine, width: 1.5 },
    });
    if (indicators.klingerSignal) {
      series.push({
        name: "Klinger Signal",
        type: "line",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: indicators.klingerSignal,
        symbol: "none",
        lineStyle: { color: COLORS.klingerSignal, width: 1.5 },
      });
    }
  }

  // Elder Force Index
  if (enabledIndicators.includes("elderForce") && indicators.elderForceData) {
    const gridIndex = createSubchart(ctx, {
      title: "Elder Force",
      titleColor: COLORS.elderForce,
      yAxisLabelFormatter: formatLargeNumber,
    });
    series.push({
      name: "Elder Force",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: indicators.elderForceData,
      symbol: "none",
      lineStyle: { color: COLORS.elderForce, width: 1.5 },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 0 }],
      },
    });
  }

  // Volume Anomaly
  if (enabledIndicators.includes("volumeAnomaly") && indicators.volumeAnomalyData) {
    const gridIndex = createSubchart(ctx, {
      title: "Vol Anomaly",
      titleColor: COLORS.volumeAnomalyHigh,
    });
    const ratioData = indicators.volumeAnomalyData.map((d) => {
      if (!d) return null;
      const color =
        d.level === "extreme"
          ? COLORS.volumeAnomalyExtreme
          : d.level === "high"
            ? COLORS.volumeAnomalyHigh
            : COLORS.volumeAnomalyNormal;
      return { value: d.ratio, itemStyle: { color } };
    });
    series.push({
      name: "Vol Ratio",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: ratioData,
    });
    series.push({
      name: "",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: [],
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#666", type: "dashed" },
        data: [{ yAxis: 1 }],
      },
    });
  }

  // Volume Profile (POC/VAH/VAL lines on main chart - rendered in overlay)
  if (enabledIndicators.includes("volumeProfile") && indicators.volumeProfileData) {
    const vp = indicators.volumeProfileData;
    const gridIndex = createSubchart(ctx, {
      title: "Vol Profile",
      titleColor: COLORS.volumeProfilePoc,
    });
    // Show POC, VAH, VAL as horizontal lines
    const vpData: (number | null)[] = new Array(indicators.volumeProfilePocLine?.length ?? 0).fill(
      null,
    );
    series.push({
      name: "VP POC",
      type: "line",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: vpData,
      symbol: "none",
      markLine: {
        silent: true,
        symbol: "none",
        data: [
          ...(vp.poc != null
            ? [
                {
                  yAxis: vp.poc,
                  lineStyle: { color: COLORS.volumeProfilePoc, type: "solid", width: 2 },
                  label: {
                    formatter: "POC",
                    color: COLORS.volumeProfilePoc,
                    fontSize: 9,
                    position: "end" as const,
                  },
                },
              ]
            : []),
        ],
      },
    });
  }

  // Volume Trend
  if (enabledIndicators.includes("volumeTrend") && indicators.volumeTrendData) {
    const gridIndex = createSubchart(ctx, {
      title: "Vol Trend",
      titleColor: COLORS.volumeTrendConfirmed,
    });
    const confidenceData = indicators.volumeTrendData.map((d) => {
      if (!d) return null;
      const color = d.isConfirmed ? COLORS.volumeTrendConfirmed : COLORS.volumeTrendDivergent;
      return { value: d.confidence, itemStyle: { color } };
    });
    series.push({
      name: "Vol Trend",
      type: "bar",
      xAxisIndex: gridIndex,
      yAxisIndex: gridIndex,
      data: confidenceData,
    });
  }
}

/**
 * Build the dedicated volume bar subchart (special grid below main chart)
 */
export function buildVolumeBarChart(
  series: SeriesItem[],
  grids: SeriesItem[],
  xAxes: SeriesItem[],
  yAxes: SeriesItem[],
  titles: SeriesItem[],
  dates: string[],
  volumes: SeriesItem[],
  candles: NormalizedCandle[],
  volumeTop: number,
  volumeHeight: number,
  volumeSpikeMarkers: DetectedVolumeSpike[],
): void {
  const gridIndex = grids.length;

  grids.push({ left: 60, right: 40, top: volumeTop, height: volumeHeight });

  xAxes.push({
    type: "category",
    gridIndex,
    data: dates,
    show: false,
  });

  yAxes.push({
    type: "value",
    gridIndex,
    show: false,
    splitLine: { show: false },
  });

  titles.push({
    text: "Volume",
    left: 5,
    top: volumeTop - 2,
    textStyle: { color: "#a0a0a0", fontSize: 10, fontWeight: "normal" },
  });

  // Generate volume spike markers
  const volumeSpikeMarkPointData = volumeSpikeMarkers
    .map((spike) => {
      const idx = candles.findIndex((c) => c.time === spike.time);
      if (idx === -1) return null;

      let symbol = "triangle";
      let symbolSize = 14;
      let symbolRotate = 180;
      let color = COLORS.volumeSpikeAvg;
      let label = `${spike.ratio.toFixed(1)}x`;

      switch (spike.type) {
        case "breakout":
          symbol = "pin";
          symbolSize = 20;
          symbolRotate = 0;
          color = COLORS.volumeSpikeBreakout;
          label = "NEW";
          break;
        case "accumulation":
          symbol = "diamond";
          symbolSize = 16;
          symbolRotate = 0;
          color = COLORS.volumeAccumulation;
          label = spike.consecutiveDays ? `${spike.consecutiveDays}d` : "Accumulation";
          break;
        case "ma_cross":
          symbol = "arrow";
          symbolSize = 16;
          symbolRotate = 0;
          color = COLORS.volumeMaCross;
          label = "Cross";
          break;
        default:
          break;
      }

      return {
        coord: [idx, spike.volume],
        symbol,
        symbolSize,
        symbolRotate,
        itemStyle: { color, borderColor: "#fff", borderWidth: 1 },
        label: {
          show: true,
          position: "top",
          formatter: label,
          fontSize: 9,
          color,
          fontWeight: "bold",
          distance: 5,
        },
      };
    })
    .filter(Boolean);

  series.push({
    name: "Volume",
    type: "bar",
    xAxisIndex: gridIndex,
    yAxisIndex: gridIndex,
    data: volumes,
    markPoint: volumeSpikeMarkPointData.length > 0 ? { data: volumeSpikeMarkPointData } : undefined,
  });
}
