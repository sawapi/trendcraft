/**
 * Filter overlay series builders (Super Smoother, Heikin-Ashi, Candlestick Patterns)
 */

import type { NormalizedCandle } from "trendcraft";
import type { OverlayType } from "../../types";
import type { OverlayData } from "../../hooks/useOverlays";
import { COLORS, type SeriesItem } from "../chartColors";

export function buildFilterOverlaySeries(
  candles: NormalizedCandle[],
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // Super Smoother
  if (enabledOverlays.includes("superSmoother") && overlays.superSmoother) {
    series.push({
      name: "Super Smoother",
      type: "line",
      data: overlays.superSmoother,
      symbol: "none",
      lineStyle: { color: COLORS.superSmoother, width: 1.5 },
    });
  }

  // Heikin-Ashi
  if (enabledOverlays.includes("heikinAshi") && overlays.heikinAshi) {
    series.push({
      name: "Heikin-Ashi",
      type: "candlestick",
      data: overlays.heikinAshi.map((v) => [v.open, v.close, v.low, v.high]),
      itemStyle: {
        color: COLORS.heikinAshiUp,
        color0: COLORS.heikinAshiDown,
        borderColor: COLORS.heikinAshiUp,
        borderColor0: COLORS.heikinAshiDown,
      },
      z: 1,
    });
  }

  // Candlestick Patterns
  if (enabledOverlays.includes("candlestickPatterns") && overlays.candlestickPatterns) {
    const priceRange = candles.reduce((max, c) => Math.max(max, c.high - c.low), 0);
    const offset = priceRange * 0.5;

    const bullishData: SeriesItem[] = [];
    const bearishData: SeriesItem[] = [];

    overlays.candlestickPatterns.forEach((v, i) => {
      if (v.hasBullish) {
        const names = v.patterns
          .filter((p) => p.direction === "bullish")
          .map((p) => p.name)
          .join(", ");
        bullishData.push({
          value: [i, candles[i].low - offset],
          patternName: names,
        });
      }
      if (v.hasBearish) {
        const names = v.patterns
          .filter((p) => p.direction === "bearish")
          .map((p) => p.name)
          .join(", ");
        bearishData.push({
          value: [i, candles[i].high + offset],
          patternName: names,
        });
      }
    });

    if (bullishData.length > 0) {
      series.push({
        name: "Bullish Pattern",
        type: "scatter",
        data: bullishData,
        symbol: "triangle",
        symbolSize: 10,
        symbolOffset: [0, 10],
        itemStyle: { color: COLORS.candlePatternBull },
        tooltip: {
          formatter: (params: SeriesItem) => {
            return `Bullish: ${params.data?.patternName ?? ""}`;
          },
        },
        z: 10,
      });
    }

    if (bearishData.length > 0) {
      series.push({
        name: "Bearish Pattern",
        type: "scatter",
        data: bearishData,
        symbol: "triangle",
        symbolSize: 10,
        symbolRotate: 180,
        symbolOffset: [0, -10],
        itemStyle: { color: COLORS.candlePatternBear },
        tooltip: {
          formatter: (params: SeriesItem) => {
            return `Bearish: ${params.data?.patternName ?? ""}`;
          },
        },
        z: 10,
      });
    }
  }

  return series;
}
