/**
 * Projection fan series for pattern replay
 *
 * Generates ECharts line series for upper/lower confidence bounds
 * and average return line, forming a fan-shaped projection area.
 *
 * The fan is rendered using three stacked area series:
 * 1. Lower bound (transparent area below lower)
 * 2. Band (colored area between lower and upper, via stacking)
 * 3. Average line (dotted center line)
 */

import type { PatternProjection } from "trendcraft";
import type { SeriesItem } from "../chartColors";

/**
 * Create projection fan ECharts series
 */
export function createProjectionFanSeries(
  projection: PatternProjection,
  basePrice: number,
  startDateIndex: number,
  dates: string[],
  bullish: boolean,
  currentReplayIndex: number,
  patternEndIndex: number,
): SeriesItem[] {
  if (
    projection.validCount === 0 ||
    projection.avgReturnByBar.length === 0 ||
    currentReplayIndex <= patternEndIndex
  ) {
    return [];
  }

  // How many projection bars to show (progressive reveal)
  const barsToShow = Math.min(
    currentReplayIndex - patternEndIndex,
    projection.avgReturnByBar.length,
  );

  if (barsToShow <= 0) return [];

  const fanColor = bullish ? "rgba(76, 175, 80, 0.15)" : "rgba(244, 67, 54, 0.15)";
  const lineColor = bullish ? "#4caf50" : "#f44336";
  const avgColor = bullish ? "#66bb6a" : "#ef5350";

  // Convert return% to absolute price
  const toPrice = (returnPct: number) => basePrice * (1 + returnPct / 100);

  // Build data arrays — null-fill as "-", then populate projection range
  const lowerData: (number | string)[] = new Array(dates.length).fill("-");
  const bandData: (number | string)[] = new Array(dates.length).fill("-");
  const avgData: (number | string)[] = new Array(dates.length).fill("-");

  // Anchor at pattern end (zero-width start)
  lowerData[patternEndIndex] = basePrice;
  bandData[patternEndIndex] = 0; // band height = 0 at start
  avgData[patternEndIndex] = basePrice;

  for (let i = 0; i < barsToShow; i++) {
    const dateIdx = startDateIndex + i;
    if (dateIdx >= dates.length) break;

    const lower = toPrice(projection.lowerBound[i]);
    const upper = toPrice(projection.upperBound[i]);
    lowerData[dateIdx] = lower;
    bandData[dateIdx] = upper - lower; // band height stacked on top of lower
    avgData[dateIdx] = toPrice(projection.avgReturnByBar[i]);
  }

  return [
    // Stack base: lower bound (transparent area)
    {
      name: "Proj Lower",
      type: "line",
      data: lowerData,
      stack: "projFan",
      lineStyle: { color: lineColor, width: 1, type: "dashed", opacity: 0.6 },
      itemStyle: { color: lineColor },
      areaStyle: { color: "transparent" },
      symbol: "none",
      yAxisIndex: 0,
      z: 5,
      silent: true,
    },
    // Stack top: band between lower and upper (colored fill)
    {
      name: "Proj Upper",
      type: "line",
      data: bandData,
      stack: "projFan",
      lineStyle: { color: lineColor, width: 1, type: "dashed", opacity: 0.6 },
      itemStyle: { color: lineColor },
      areaStyle: { color: fanColor },
      symbol: "none",
      yAxisIndex: 0,
      z: 5,
      silent: true,
    },
    // Average return line (center of fan, not stacked)
    {
      name: "Proj Avg",
      type: "line",
      data: avgData,
      lineStyle: { color: avgColor, width: 2, type: "dotted" },
      itemStyle: { color: avgColor },
      symbol: "none",
      yAxisIndex: 0,
      z: 6,
      silent: true,
    },
  ];
}
