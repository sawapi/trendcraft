/**
 * Price overlay series builders (VWAP, Swing Points, Pivot, Trend Lines, Fibonacci)
 */

import type { NormalizedCandle } from "trendcraft";
import type { OverlayType } from "../../types";
import type { OverlayData } from "../../hooks/useOverlays";
import { COLORS, type SeriesItem } from "../chartColors";

/**
 * Clip a value to a range, returning null if outside bounds.
 * Used to prevent extreme data points from distorting Y-axis scale.
 */
function clipToRange(
  value: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined) return null;
  return value < min || value > max ? null : value;
}

export function buildPriceOverlaySeries(
  candles: NormalizedCandle[],
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // Compute clip bounds from candle price range (used for Channel, Pitchfork, FibExtension)
  const visibleHigh = Math.max(...candles.map((c) => c.high));
  const visibleLow = Math.min(...candles.map((c) => c.low));
  const range = visibleHigh - visibleLow;
  const clipMax = visibleHigh + range * 0.5;
  const clipMin = visibleLow - range * 0.5;

  // VWAP
  if (enabledOverlays.includes("vwap") && overlays.vwap) {
    series.push({
      name: "VWAP",
      type: "line",
      data: overlays.vwap.map((v) => v.vwap),
      symbol: "none",
      lineStyle: { color: COLORS.vwap, width: 2 },
    });
    series.push({
      name: "VWAP Upper",
      type: "line",
      data: overlays.vwap.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.vwap, width: 1, type: "dashed", opacity: 0.6 },
    });
    series.push({
      name: "VWAP Lower",
      type: "line",
      data: overlays.vwap.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.vwap, width: 1, type: "dashed", opacity: 0.6 },
    });
  }

  // Swing Points
  if (enabledOverlays.includes("swingPoints") && overlays.swingPoints) {
    const swingHighData = overlays.swingPoints.map((v, i) =>
      v.isSwingHigh ? candles[i].high : null
    );
    series.push({
      name: "Swing High",
      type: "scatter",
      data: swingHighData,
      symbol: "triangle",
      symbolSize: 10,
      symbolRotate: 180,
      itemStyle: { color: COLORS.swingHigh },
    });

    const swingLowData = overlays.swingPoints.map((v, i) =>
      v.isSwingLow ? candles[i].low : null
    );
    series.push({
      name: "Swing Low",
      type: "scatter",
      data: swingLowData,
      symbol: "triangle",
      symbolSize: 10,
      itemStyle: { color: COLORS.swingLow },
    });
  }

  // Pivot Points
  if (enabledOverlays.includes("pivotPoints") && overlays.pivotPoints) {
    series.push({
      name: "Pivot",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.pivot),
      symbol: "none",
      lineStyle: { color: COLORS.pivot, width: 1.5, type: "dashed" },
    });
    series.push({
      name: "R1",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.r1),
      symbol: "none",
      lineStyle: { color: COLORS.pivotR1, width: 1, type: "dotted" },
    });
    series.push({
      name: "R2",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.r2),
      symbol: "none",
      lineStyle: { color: COLORS.pivotR2, width: 1, type: "dotted" },
    });
    series.push({
      name: "R3",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.r3),
      symbol: "none",
      lineStyle: { color: COLORS.pivotR3, width: 1, type: "dotted" },
    });
    series.push({
      name: "S1",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.s1),
      symbol: "none",
      lineStyle: { color: COLORS.pivotS1, width: 1, type: "dotted" },
    });
    series.push({
      name: "S2",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.s2),
      symbol: "none",
      lineStyle: { color: COLORS.pivotS2, width: 1, type: "dotted" },
    });
    series.push({
      name: "S3",
      type: "line",
      data: overlays.pivotPoints.map((v) => v.s3),
      symbol: "none",
      lineStyle: { color: COLORS.pivotS3, width: 1, type: "dotted" },
    });
  }

  // Fibonacci Retracement
  if (enabledOverlays.includes("fibonacci") && overlays.fibonacci) {
    const fibLevels: { key: string; color: string; width: number; lineType: string }[] = [
      { key: "0", color: COLORS.fib0, width: 1.5, lineType: "solid" },
      { key: "0.236", color: COLORS.fib236, width: 1, lineType: "dashed" },
      { key: "0.382", color: COLORS.fib382, width: 1, lineType: "dashed" },
      { key: "0.5", color: COLORS.fib50, width: 1, lineType: "dashed" },
      { key: "0.618", color: COLORS.fib618, width: 2, lineType: "dashed" },
      { key: "0.786", color: COLORS.fib786, width: 1, lineType: "dashed" },
      { key: "1", color: COLORS.fib100, width: 1.5, lineType: "solid" },
    ];

    for (const level of fibLevels) {
      const label = level.key === "0.5" ? "50%" : `${(parseFloat(level.key) * 100).toFixed(1)}%`;
      series.push({
        name: `Fib ${label}`,
        type: "line",
        data: overlays.fibonacci.map((v) => v.levels?.[level.key] ?? null),
        symbol: "none",
        lineStyle: { color: level.color, width: level.width, type: level.lineType },
        endLabel: {
          show: true,
          formatter: (params: { value: number | number[] | null }) => {
            const val = Array.isArray(params.value) ? params.value[1] : params.value;
            return `${label} (${typeof val === "number" ? val.toLocaleString() : ""})`;
          },
          fontSize: 10,
          color: level.color,
        },
      });
    }
  }

  // Auto Trend Line
  if (enabledOverlays.includes("autoTrendLine") && overlays.autoTrendLine) {
    series.push({
      name: "Resistance TL",
      type: "line",
      data: overlays.autoTrendLine.map((v) => v.resistance),
      symbol: "none",
      lineStyle: { color: COLORS.trendLineResistance, width: 1.5, type: "dashed" },
    });
    series.push({
      name: "Support TL",
      type: "line",
      data: overlays.autoTrendLine.map((v) => v.support),
      symbol: "none",
      lineStyle: { color: COLORS.trendLineSupport, width: 1.5, type: "dashed" },
    });
  }

  // Channel Line (clipped to prevent extreme extrapolation)
  if (enabledOverlays.includes("channelLine") && overlays.channelLine) {
    series.push({
      name: "Channel Upper",
      type: "line",
      data: overlays.channelLine.map((v) => clipToRange(v.upper, clipMin, clipMax)),
      symbol: "none",
      lineStyle: { color: COLORS.channelUpper, width: 1.5 },
    });
    series.push({
      name: "Channel Lower",
      type: "line",
      data: overlays.channelLine.map((v) => clipToRange(v.lower, clipMin, clipMax)),
      symbol: "none",
      lineStyle: { color: COLORS.channelLower, width: 1.5 },
    });
    series.push({
      name: "Channel Middle",
      type: "line",
      data: overlays.channelLine.map((v) => clipToRange(v.middle, clipMin, clipMax)),
      symbol: "none",
      lineStyle: { color: COLORS.channelMiddle, width: 1, type: "dashed" },
    });
  }

  // Fibonacci Extension
  if (enabledOverlays.includes("fibExtension") && overlays.fibExtension) {
    const extLevels: { key: string; color: string; width: number; lineType: string }[] = [
      { key: "0", color: COLORS.fibExt0, width: 1, lineType: "solid" },
      { key: "0.618", color: COLORS.fibExt618, width: 1, lineType: "dashed" },
      { key: "1", color: COLORS.fibExt100, width: 1.5, lineType: "solid" },
      { key: "1.272", color: COLORS.fibExt1272, width: 2, lineType: "dashed" },
      { key: "1.618", color: COLORS.fibExt1618, width: 2, lineType: "dashed" },
      { key: "2", color: COLORS.fibExt200, width: 1.5, lineType: "solid" },
      { key: "2.618", color: COLORS.fibExt2618, width: 1, lineType: "dashed" },
    ];

    for (const level of extLevels) {
      const label = `${(parseFloat(level.key) * 100).toFixed(1)}%`;
      series.push({
        name: `Ext ${label}`,
        type: "line",
        data: overlays.fibExtension.map((v) => {
          const val = v.levels?.[level.key] ?? null;
          return clipToRange(val, clipMin, clipMax);
        }),
        symbol: "none",
        lineStyle: { color: level.color, width: level.width, type: level.lineType },
        endLabel: {
          show: true,
          formatter: (params: { value: number | number[] | null }) => {
            const val = Array.isArray(params.value) ? params.value[1] : params.value;
            return `${label} (${typeof val === "number" ? val.toLocaleString() : ""})`;
          },
          fontSize: 10,
          color: level.color,
        },
      });
    }
  }

  // Andrew's Pitchfork (clipped to prevent extreme extrapolation)
  if (enabledOverlays.includes("andrewsPitchfork") && overlays.andrewsPitchfork) {
    series.push({
      name: "PF Median",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => clipToRange(v.median, clipMin, clipMax)),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkMedian, width: 2 },
    });
    series.push({
      name: "PF Upper",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => clipToRange(v.upper, clipMin, clipMax)),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkUpper, width: 1.5, type: "dashed" },
    });
    series.push({
      name: "PF Lower",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => clipToRange(v.lower, clipMin, clipMax)),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkLower, width: 1.5, type: "dashed" },
    });
  }

  return series;
}
