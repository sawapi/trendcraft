/**
 * Bollinger Bands, Donchian, Keltner, and Ichimoku overlay series builders
 */

import type { OverlayData } from "../../hooks/useOverlays";
import type { OverlayType } from "../../types";
import { COLORS, type SeriesItem } from "../chartColors";

export function buildBollingerIchimokuSeries(
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // Bollinger Bands
  if (enabledOverlays.includes("bb") && overlays.bb) {
    series.push({
      name: "BB Upper",
      type: "line",
      data: overlays.bb.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.bb, width: 1, type: "dashed" },
    });
    series.push({
      name: "BB Middle",
      type: "line",
      data: overlays.bb.map((v) => v.middle),
      symbol: "none",
      lineStyle: { color: COLORS.bb, width: 1.5 },
    });
    series.push({
      name: "BB Lower",
      type: "line",
      data: overlays.bb.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.bb, width: 1, type: "dashed" },
    });
  }

  // Donchian Channel
  if (enabledOverlays.includes("donchian") && overlays.donchian) {
    series.push({
      name: "Donchian Upper",
      type: "line",
      data: overlays.donchian.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.donchian, width: 1, type: "dashed" },
    });
    series.push({
      name: "Donchian Middle",
      type: "line",
      data: overlays.donchian.map((v) => v.middle),
      symbol: "none",
      lineStyle: { color: COLORS.donchian, width: 1.5 },
    });
    series.push({
      name: "Donchian Lower",
      type: "line",
      data: overlays.donchian.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.donchian, width: 1, type: "dashed" },
    });
  }

  // Keltner Channel
  if (enabledOverlays.includes("keltner") && overlays.keltner) {
    series.push({
      name: "KC Upper",
      type: "line",
      data: overlays.keltner.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.keltner, width: 1, type: "dashed" },
    });
    series.push({
      name: "KC Middle",
      type: "line",
      data: overlays.keltner.map((v) => v.middle),
      symbol: "none",
      lineStyle: { color: COLORS.keltner, width: 1.5 },
    });
    series.push({
      name: "KC Lower",
      type: "line",
      data: overlays.keltner.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.keltner, width: 1, type: "dashed" },
    });
  }

  // Ichimoku
  if (enabledOverlays.includes("ichimoku") && overlays.ichimoku) {
    series.push({
      name: "Tenkan",
      type: "line",
      data: overlays.ichimoku.map((v) => v.tenkan),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuTenkan, width: 1.5 },
    });
    series.push({
      name: "Kijun",
      type: "line",
      data: overlays.ichimoku.map((v) => v.kijun),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuKijun, width: 1.5 },
    });
    series.push({
      name: "Senkou A",
      type: "line",
      data: overlays.ichimoku.map((v) => v.senkouA),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuSenkouA, width: 1, type: "dashed" },
    });
    series.push({
      name: "Senkou B",
      type: "line",
      data: overlays.ichimoku.map((v) => v.senkouB),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuSenkouB, width: 1, type: "dashed" },
    });
    series.push({
      name: "Chikou",
      type: "line",
      data: overlays.ichimoku.map((v) => v.chikou),
      symbol: "none",
      lineStyle: { color: COLORS.ichimokuChikou, width: 1, type: "dotted" },
    });
  }

  return series;
}
