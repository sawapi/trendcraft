/**
 * Overlay series builder for main chart indicators
 */

import type { NormalizedCandle } from "trendcraft";
import type { OverlayType } from "../types";
import type { OverlayData } from "../hooks/useOverlays";
import { COLORS, type SeriesItem } from "./chartColors";

/**
 * Build overlay indicator series for the main chart
 */
export function buildOverlaySeries(
  candles: NormalizedCandle[],
  overlays: OverlayData,
  enabledOverlays: OverlayType[],
  dates: string[],
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

  // Supertrend
  if (enabledOverlays.includes("supertrend") && overlays.supertrend) {
    const bullishData = overlays.supertrend.map((v) =>
      v.direction === 1 ? v.supertrend : null
    );
    const bearishData = overlays.supertrend.map((v) =>
      v.direction === -1 ? v.supertrend : null
    );
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
    const bullishSar = overlays.psar.map((v) =>
      v.direction === 1 ? v.sar : null
    );
    const bearishSar = overlays.psar.map((v) =>
      v.direction === -1 ? v.sar : null
    );
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

  // Channel Line
  if (enabledOverlays.includes("channelLine") && overlays.channelLine) {
    series.push({
      name: "Channel Upper",
      type: "line",
      data: overlays.channelLine.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.channelUpper, width: 1.5 },
    });
    series.push({
      name: "Channel Lower",
      type: "line",
      data: overlays.channelLine.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.channelLower, width: 1.5 },
    });
    series.push({
      name: "Channel Middle",
      type: "line",
      data: overlays.channelLine.map((v) => v.middle),
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
        data: overlays.fibExtension.map((v) => v.levels?.[level.key] ?? null),
        symbol: "none",
        lineStyle: { color: level.color, width: level.width, type: level.lineType },
      });
    }
  }

  // Andrew's Pitchfork
  if (enabledOverlays.includes("andrewsPitchfork") && overlays.andrewsPitchfork) {
    series.push({
      name: "PF Median",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => v.median),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkMedian, width: 2 },
    });
    series.push({
      name: "PF Upper",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => v.upper),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkUpper, width: 1.5, type: "dashed" },
    });
    series.push({
      name: "PF Lower",
      type: "line",
      data: overlays.andrewsPitchfork.map((v) => v.lower),
      symbol: "none",
      lineStyle: { color: COLORS.pitchforkLower, width: 1.5, type: "dashed" },
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
            itemStyle: { color: "#ff9800" },
            label: {
              show: true,
              formatter: "R",
              position: isBullish ? "top" : "bottom",
              fontSize: 8,
              color: "#ff9800",
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
