/**
 * SMC overlay series builders (Order Blocks, FVG, BOS, CHoCH, Liquidity Sweep)
 */

import type { NormalizedCandle } from "trendcraft";
import type { OverlayType } from "../../types";
import type { OverlayData } from "../../hooks/useOverlays";
import { COLORS, type SeriesItem } from "../chartColors";

export function buildSmcOverlaySeries(
  candles: NormalizedCandle[],
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
  dates: string[],
): SeriesItem[] {
  const series: SeriesItem[] = [];

  // Order Block
  if (enabledOverlays.includes("orderBlock") && overlays.orderBlock) {
    const orderBlockMarkAreas: SeriesItem[][] = [];
    const lastOb = overlays.orderBlock[overlays.orderBlock.length - 1];
    if (lastOb) {
      for (const ob of lastOb.activeOrderBlocks) {
        const color = ob.type === "bullish" ? COLORS.orderBlockBullish : COLORS.orderBlockBearish;
        orderBlockMarkAreas.push([
          {
            xAxis: dates[ob.startIndex],
            yAxis: ob.low,
            itemStyle: { color },
          },
          {
            xAxis: dates[dates.length - 1],
            yAxis: ob.high,
          },
        ]);
      }
    }
    if (orderBlockMarkAreas.length > 0) {
      series.push({
        name: "Order Block",
        type: "line",
        data: [],
        markArea: {
          silent: true,
          data: orderBlockMarkAreas,
        },
      });
    }
  }

  // Fair Value Gap
  if (enabledOverlays.includes("fvg") && overlays.fvg) {
    const fvgMarkAreas: SeriesItem[][] = [];
    const lastFvg = overlays.fvg[overlays.fvg.length - 1];
    if (lastFvg) {
      for (const fvg of lastFvg.activeBullishFvgs) {
        fvgMarkAreas.push([
          {
            xAxis: dates[fvg.startIndex],
            yAxis: fvg.low,
            itemStyle: {
              color: COLORS.fvgBullish,
              borderColor: "rgba(100, 181, 246, 0.5)",
              borderWidth: 1,
              borderType: "dashed",
            },
          },
          {
            xAxis: dates[dates.length - 1],
            yAxis: fvg.high,
          },
        ]);
      }
      for (const fvg of lastFvg.activeBearishFvgs) {
        fvgMarkAreas.push([
          {
            xAxis: dates[fvg.startIndex],
            yAxis: fvg.low,
            itemStyle: {
              color: COLORS.fvgBearish,
              borderColor: "rgba(255, 183, 77, 0.5)",
              borderWidth: 1,
              borderType: "dashed",
            },
          },
          {
            xAxis: dates[dates.length - 1],
            yAxis: fvg.high,
          },
        ]);
      }
    }
    if (fvgMarkAreas.length > 0) {
      series.push({
        name: "FVG",
        type: "line",
        data: [],
        markArea: {
          silent: true,
          data: fvgMarkAreas,
        },
      });
    }
  }

  // Break of Structure
  if (enabledOverlays.includes("bos") && overlays.bos) {
    const bosMarkPoints: SeriesItem[] = [];
    overlays.bos.forEach((v, i) => {
      if (v.bullishBos) {
        bosMarkPoints.push({
          coord: [dates[i], candles[i].high],
          symbol: "arrow",
          symbolSize: 12,
          symbolRotate: 0,
          itemStyle: { color: COLORS.bosBullish },
          label: {
            show: true,
            formatter: "BOS",
            position: "top",
            fontSize: 9,
            color: COLORS.bosBullish,
            fontWeight: "bold",
          },
        });
      }
      if (v.bearishBos) {
        bosMarkPoints.push({
          coord: [dates[i], candles[i].low],
          symbol: "arrow",
          symbolSize: 12,
          symbolRotate: 180,
          itemStyle: { color: COLORS.bosBearish },
          label: {
            show: true,
            formatter: "BOS",
            position: "bottom",
            fontSize: 9,
            color: COLORS.bosBearish,
            fontWeight: "bold",
          },
        });
      }
    });
    if (bosMarkPoints.length > 0) {
      series.push({
        name: "BOS",
        type: "line",
        data: [],
        markPoint: {
          data: bosMarkPoints,
        },
      });
    }
  }

  // Change of Character
  if (enabledOverlays.includes("choch") && overlays.choch) {
    const chochMarkPoints: SeriesItem[] = [];
    overlays.choch.forEach((v, i) => {
      if (v.bullishBos) {
        chochMarkPoints.push({
          coord: [dates[i], candles[i].high],
          symbol: "diamond",
          symbolSize: 14,
          itemStyle: { color: COLORS.chochBullish },
          label: {
            show: true,
            formatter: "CHoCH",
            position: "top",
            fontSize: 9,
            color: COLORS.chochBullish,
            fontWeight: "bold",
          },
        });
      }
      if (v.bearishBos) {
        chochMarkPoints.push({
          coord: [dates[i], candles[i].low],
          symbol: "diamond",
          symbolSize: 14,
          itemStyle: { color: COLORS.chochBearish },
          label: {
            show: true,
            formatter: "CHoCH",
            position: "bottom",
            fontSize: 9,
            color: COLORS.chochBearish,
            fontWeight: "bold",
          },
        });
      }
    });
    if (chochMarkPoints.length > 0) {
      series.push({
        name: "CHoCH",
        type: "line",
        data: [],
        markPoint: {
          data: chochMarkPoints,
        },
      });
    }
  }

  // Liquidity Sweep
  if (enabledOverlays.includes("liquiditySweep") && overlays.liquiditySweep) {
    const sweepMarkPoints: SeriesItem[] = [];
    const sweepMarkAreas: SeriesItem[][] = [];

    overlays.liquiditySweep.forEach((v, i) => {
      // New sweep detected
      if (v.isSweep && v.sweep) {
        const isBullish = v.sweep.type === "bullish";

        sweepMarkPoints.push({
          coord: [dates[i], isBullish ? candles[i].low : candles[i].high],
          symbol: "triangle",
          symbolSize: 12,
          symbolRotate: isBullish ? 0 : 180,
          itemStyle: { color: isBullish ? COLORS.liquiditySweepBullish : COLORS.liquiditySweepBearish },
          label: {
            show: true,
            formatter: isBullish ? "SL" : "SH",
            position: isBullish ? "bottom" : "top",
            fontSize: 9,
            color: isBullish ? COLORS.liquiditySweepBullish : COLORS.liquiditySweepBearish,
            fontWeight: "bold",
          },
        });

        const areaColor = isBullish
          ? "rgba(38, 166, 154, 0.15)"
          : "rgba(239, 83, 80, 0.15)";
        sweepMarkAreas.push([
          {
            xAxis: dates[i],
            yAxis: v.sweep.sweptLevel,
            itemStyle: { color: areaColor },
          },
          {
            xAxis: dates[Math.min(i + 10, dates.length - 1)],
            yAxis: v.sweep.sweepExtreme,
          },
        ]);
      }

      // Recovery markers
      if (v.recoveredThisBar.length > 0) {
        for (const sweep of v.recoveredThisBar) {
          const isBullish = sweep.type === "bullish";
          sweepMarkPoints.push({
            coord: [dates[i], isBullish ? candles[i].high : candles[i].low],
            symbol: "pin",
            symbolSize: 14,
            itemStyle: { color: COLORS.liquiditySweepRecovery },
            label: {
              show: true,
              formatter: "R",
              position: isBullish ? "top" : "bottom",
              fontSize: 8,
              color: COLORS.liquiditySweepRecovery,
              fontWeight: "bold",
            },
          });
        }
      }
    });

    if (sweepMarkPoints.length > 0 || sweepMarkAreas.length > 0) {
      series.push({
        name: "Liquidity Sweep",
        type: "line",
        data: [],
        ...(sweepMarkPoints.length > 0 && {
          markPoint: {
            data: sweepMarkPoints,
          },
        }),
        ...(sweepMarkAreas.length > 0 && {
          markArea: {
            silent: true,
            data: sweepMarkAreas,
          },
        }),
      });
    }
  }

  return series;
}
