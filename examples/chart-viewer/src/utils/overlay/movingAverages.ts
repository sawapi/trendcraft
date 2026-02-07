/**
 * Moving average overlay series builders (SMA, EMA, WMA)
 */

import type { OverlayType } from "../../types";
import type { OverlayData } from "../../hooks/useOverlays";
import { COLORS, type SeriesItem } from "../chartColors";

export function buildMovingAverageSeries(
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // SMA 5
  if (enabledOverlays.includes("sma5") && overlays.sma5) {
    series.push({
      name: "SMA 5",
      type: "line",
      data: overlays.sma5,
      symbol: "none",
      lineStyle: { color: COLORS.sma5, width: 1.5 },
    });
  }

  // SMA 25
  if (enabledOverlays.includes("sma25") && overlays.sma25) {
    series.push({
      name: "SMA 25",
      type: "line",
      data: overlays.sma25,
      symbol: "none",
      lineStyle: { color: COLORS.sma25, width: 1.5 },
    });
  }

  // SMA 75
  if (enabledOverlays.includes("sma75") && overlays.sma75) {
    series.push({
      name: "SMA 75",
      type: "line",
      data: overlays.sma75,
      symbol: "none",
      lineStyle: { color: COLORS.sma75, width: 1.5 },
    });
  }

  // EMA 12
  if (enabledOverlays.includes("ema12") && overlays.ema12) {
    series.push({
      name: "EMA 12",
      type: "line",
      data: overlays.ema12,
      symbol: "none",
      lineStyle: { color: COLORS.ema12, width: 1.5, type: "dashed" },
    });
  }

  // EMA 26
  if (enabledOverlays.includes("ema26") && overlays.ema26) {
    series.push({
      name: "EMA 26",
      type: "line",
      data: overlays.ema26,
      symbol: "none",
      lineStyle: { color: COLORS.ema26, width: 1.5, type: "dashed" },
    });
  }

  // WMA 20
  if (enabledOverlays.includes("wma20") && overlays.wma20) {
    series.push({
      name: "WMA 20",
      type: "line",
      data: overlays.wma20,
      symbol: "none",
      lineStyle: { color: COLORS.wma20, width: 1.5 },
    });
  }

  // VWMA 20
  if (enabledOverlays.includes("vwma20") && overlays.vwma20) {
    series.push({
      name: "VWMA 20",
      type: "line",
      data: overlays.vwma20,
      symbol: "none",
      lineStyle: { color: COLORS.vwma20, width: 1.5 },
    });
  }

  return series;
}
