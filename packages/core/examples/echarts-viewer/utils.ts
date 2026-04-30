/**
 * Chart Viewer Utilities
 * Shared utility functions for chart operations
 */

import type * as echarts from "echarts";
import type { Series } from "trendcraft";

/**
 * Format timestamp to display date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

/**
 * Create line series option for ECharts
 */
export function createLineSeries(
  name: string,
  data: Series<number | null>,
  color: string,
  lineStyle: "solid" | "dashed" | "dotted" = "solid",
): echarts.LineSeriesOption {
  return {
    name,
    type: "line",
    data: data.map((d) => d.value),
    smooth: false,
    showSymbol: false,
    lineStyle: {
      width: 1.5,
      color,
      type: lineStyle,
    },
  };
}
