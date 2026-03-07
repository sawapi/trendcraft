/**
 * Signal color constants and ECharts type aliases
 */

// biome-ignore lint/suspicious/noExplicitAny: ECharts internal type
export type MarkPointItem = any;
// biome-ignore lint/suspicious/noExplicitAny: ECharts internal type
export type MarkAreaItem = any;
// biome-ignore lint/suspicious/noExplicitAny: ECharts internal type
export type MarkLineItem = any;

/**
 * Signal colors
 */
export const SIGNAL_COLORS = {
  // Perfect Order
  bullishConfirmed: "#26a69a",
  bearishConfirmed: "#ef5350",
  preBullish: "#ff9f43",
  preBearish: "#ff9f43",
  collapsed: "#888",
  breakdown: "#e67e22",
  pullbackBuy: "#00bcd4",
  // Range-Bound
  rangeArea: "rgba(156, 39, 176, 0.12)",
  rangeBorder: "#9c27b0",
  tightRangeArea: "rgba(233, 30, 99, 0.15)",
  tightRangeBorder: "#e91e63",
  resistance: "#ef5350",
  support: "#4caf50",
  resistanceTight: "#ff5252",
  supportTight: "#69f0ae",
  // Cross
  goldenCross: "#26a69a",
  deadCross: "#ef5350",
  crossFake: "#ff9f43",
  // Divergence
  bullishDivergence: "#4caf50",
  bearishDivergence: "#f44336",
  // Bollinger Squeeze
  squeeze: "#ff9800",
  // Volume
  volumeBreakout: "#00bcd4", // Cyan
  volumeMaCross: "#9c27b0", // Purple
};
