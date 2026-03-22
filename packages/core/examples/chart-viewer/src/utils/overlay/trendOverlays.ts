/**
 * Trend overlay series builders (Supertrend, PSAR, Chandelier, ATR Stops, Highest/Lowest)
 */

import type { OverlayData } from "../../hooks/useOverlays";
import type { OverlayType } from "../../types";
import { COLORS, type SeriesItem } from "../chartColors";

export function buildTrendOverlaySeries(
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // Supertrend
  if (enabledOverlays.includes("supertrend") && overlays.supertrend) {
    const bullishData = overlays.supertrend.map((v) => (v.direction === 1 ? v.supertrend : null));
    const bearishData = overlays.supertrend.map((v) => (v.direction === -1 ? v.supertrend : null));
    series.push({
      name: "Supertrend Up",
      type: "line",
      data: bullishData,
      symbol: "none",
      lineStyle: { color: COLORS.up, width: 2 },
    });
    series.push({
      name: "Supertrend Down",
      type: "line",
      data: bearishData,
      symbol: "none",
      lineStyle: { color: COLORS.down, width: 2 },
    });
  }

  // Parabolic SAR
  if (enabledOverlays.includes("psar") && overlays.psar) {
    const bullishSar = overlays.psar.map((v) => (v.direction === 1 ? v.sar : null));
    const bearishSar = overlays.psar.map((v) => (v.direction === -1 ? v.sar : null));
    series.push({
      name: "PSAR Up",
      type: "scatter",
      data: bullishSar,
      symbolSize: 4,
      itemStyle: { color: COLORS.up },
    });
    series.push({
      name: "PSAR Down",
      type: "scatter",
      data: bearishSar,
      symbolSize: 4,
      itemStyle: { color: COLORS.down },
    });
  }

  // Highest/Lowest Channel
  if (enabledOverlays.includes("highestLowest") && overlays.highestLowest) {
    series.push({
      name: "Highest",
      type: "line",
      data: overlays.highestLowest.map((v) => v.highest),
      symbol: "none",
      lineStyle: { color: COLORS.highestLowestUpper, width: 1.5 },
    });
    series.push({
      name: "Lowest",
      type: "line",
      data: overlays.highestLowest.map((v) => v.lowest),
      symbol: "none",
      lineStyle: { color: COLORS.highestLowestLower, width: 1.5 },
    });
  }

  // Chandelier Exit
  if (enabledOverlays.includes("chandelierExit") && overlays.chandelierExit) {
    series.push({
      name: "CE Long Exit",
      type: "line",
      data: overlays.chandelierExit.map((v) => v.longExit),
      symbol: "none",
      lineStyle: { color: COLORS.chandelierLong, width: 1.5 },
    });
    series.push({
      name: "CE Short Exit",
      type: "line",
      data: overlays.chandelierExit.map((v) => v.shortExit),
      symbol: "none",
      lineStyle: { color: COLORS.chandelierShort, width: 1.5 },
    });
  }

  // ATR Stops
  if (enabledOverlays.includes("atrStops") && overlays.atrStops) {
    series.push({
      name: "ATR Long Stop",
      type: "line",
      data: overlays.atrStops.map((v) => v.longStopLevel),
      symbol: "none",
      lineStyle: { color: COLORS.atrStopsLong, width: 1, type: "dashed" },
    });
    series.push({
      name: "ATR Short Stop",
      type: "line",
      data: overlays.atrStops.map((v) => v.shortStopLevel),
      symbol: "none",
      lineStyle: { color: COLORS.atrStopsShort, width: 1, type: "dashed" },
    });
  }

  return series;
}
