import type { NormalizedCandle } from "trendcraft";
import { COLORS, type SeriesItem } from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build SMC overlay series (Order Block, Liquidity Sweep, FVG, BOS, CHoCH)
 */
export function buildSmcOverlays(
  series: SeriesItem[],
  indicators: IndicatorData,
  enabledIndicators: string[],
  candles: NormalizedCandle[],
): void {
  // Order Blocks
  if (enabledIndicators.includes("orderBlock") && indicators.orderBlockData) {
    const currentIndex = candles.length - 1;
    const currentOBData = indicators.orderBlockData[currentIndex];

    if (currentOBData?.activeOrderBlocks) {
      const markAreaData = currentOBData.activeOrderBlocks.map((ob) => {
        const startIdx = candles.findIndex((c) => c.time === ob.startTime);
        const isBullish = ob.type === "bullish";

        return [
          {
            name: `${ob.type} OB`,
            xAxis: startIdx >= 0 ? startIdx : 0,
            yAxis: ob.high,
            itemStyle: {
              color: isBullish ? COLORS.orderBlockBullish : COLORS.orderBlockBearish,
              borderColor: isBullish
                ? COLORS.orderBlockBullishBorder
                : COLORS.orderBlockBearishBorder,
              borderWidth: 1,
            },
          },
          {
            xAxis: currentIndex,
            yAxis: ob.low,
          },
        ];
      });

      if (markAreaData.length > 0) {
        series.push({
          name: "Order Blocks",
          type: "line",
          data: [],
          markArea: {
            silent: false,
            data: markAreaData,
          },
        });
      }
    }

    // Markers for newly formed order blocks
    const newOBMarkers = indicators.orderBlockData
      .map((data, idx) => {
        if (!data?.newOrderBlock) return null;
        const ob = data.newOrderBlock;
        return {
          coord: [idx, ob.type === "bullish" ? ob.low : ob.high],
          symbol: ob.type === "bullish" ? "triangle" : "pin",
          symbolSize: 12,
          symbolRotate: ob.type === "bullish" ? 0 : 180,
          itemStyle: {
            color:
              ob.type === "bullish"
                ? COLORS.orderBlockBullishBorder
                : COLORS.orderBlockBearishBorder,
          },
          label: {
            show: true,
            formatter: "OB",
            fontSize: 8,
            color: "#fff",
          },
        };
      })
      .filter(Boolean);

    if (newOBMarkers.length > 0) {
      series.push({
        name: "OB Markers",
        type: "scatter",
        data: [],
        markPoint: { data: newOBMarkers },
      });
    }
  }

  // Liquidity Sweeps
  if (enabledIndicators.includes("liquiditySweep") && indicators.liquiditySweepData) {
    const sweepMarkers = indicators.liquiditySweepData
      .map((data, idx) => {
        if (!data?.sweep) return null;
        const sweep = data.sweep;
        const isBullish = sweep.type === "bullish";

        return {
          coord: [idx, sweep.sweepExtreme],
          symbol: "arrow",
          symbolSize: 14,
          symbolRotate: isBullish ? 0 : 180,
          itemStyle: {
            color: isBullish ? COLORS.liquiditySweepBullish : COLORS.liquiditySweepBearish,
            borderColor: "#fff",
            borderWidth: 1,
          },
          label: {
            show: true,
            position: isBullish ? "bottom" : "top",
            formatter: sweep.recovered ? "Sweep!" : "Sweep",
            fontSize: 9,
            color: isBullish ? COLORS.liquiditySweepBullish : COLORS.liquiditySweepBearish,
          },
        };
      })
      .filter(Boolean);

    if (sweepMarkers.length > 0) {
      series.push({
        name: "Liquidity Sweeps",
        type: "scatter",
        data: [],
        markPoint: { data: sweepMarkers },
      });
    }
  }

  // Fair Value Gap (FVG)
  if (enabledIndicators.includes("fvg") && indicators.fvgData) {
    const currentIndex = candles.length - 1;
    const currentFvg = indicators.fvgData[currentIndex];

    if (currentFvg) {
      const fvgAreas: SeriesItem[][] = [];

      // Active bullish FVGs
      if (currentFvg.activeBullishFvgs) {
        for (const gap of currentFvg.activeBullishFvgs) {
          const startIdx = candles.findIndex((c) => c.time === gap.startTime);
          fvgAreas.push([
            {
              name: "Bull FVG",
              xAxis: startIdx >= 0 ? startIdx : 0,
              yAxis: gap.high,
              itemStyle: {
                color: COLORS.fvgBullish,
                borderColor: COLORS.fvgBullishBorder,
                borderWidth: 1,
              },
            },
            { xAxis: currentIndex, yAxis: gap.low },
          ]);
        }
      }

      // Active bearish FVGs
      if (currentFvg.activeBearishFvgs) {
        for (const gap of currentFvg.activeBearishFvgs) {
          const startIdx = candles.findIndex((c) => c.time === gap.startTime);
          fvgAreas.push([
            {
              name: "Bear FVG",
              xAxis: startIdx >= 0 ? startIdx : 0,
              yAxis: gap.high,
              itemStyle: {
                color: COLORS.fvgBearish,
                borderColor: COLORS.fvgBearishBorder,
                borderWidth: 1,
              },
            },
            { xAxis: currentIndex, yAxis: gap.low },
          ]);
        }
      }

      if (fvgAreas.length > 0) {
        series.push({
          name: "FVG",
          type: "line",
          data: [],
          markArea: { silent: false, data: fvgAreas },
        });
      }
    }
  }

  // Break of Structure (BOS)
  if (enabledIndicators.includes("bos") && indicators.bosData) {
    const bosMarkers = indicators.bosData
      .map((data, idx) => {
        if (!data) return null;
        if (data.bullishBos) {
          return {
            coord: [idx, data.brokenLevel ?? candles[idx].high],
            symbol: "arrow",
            symbolSize: 12,
            itemStyle: { color: COLORS.bosBullish },
            label: {
              show: true,
              formatter: "BOS",
              fontSize: 8,
              color: COLORS.bosBullish,
              position: "top",
            },
          };
        }
        if (data.bearishBos) {
          return {
            coord: [idx, data.brokenLevel ?? candles[idx].low],
            symbol: "arrow",
            symbolSize: 12,
            symbolRotate: 180,
            itemStyle: { color: COLORS.bosBearish },
            label: {
              show: true,
              formatter: "BOS",
              fontSize: 8,
              color: COLORS.bosBearish,
              position: "bottom",
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    if (bosMarkers.length > 0) {
      series.push({
        name: "BOS",
        type: "scatter",
        data: [],
        markPoint: { data: bosMarkers },
      });
    }
  }

  // Change of Character (CHoCH)
  if (enabledIndicators.includes("choch") && indicators.chochData) {
    const chochMarkers = indicators.chochData
      .map((data, idx) => {
        if (!data) return null;
        if (data.bullishBos) {
          return {
            coord: [idx, data.brokenLevel ?? candles[idx].high],
            symbol: "diamond",
            symbolSize: 12,
            itemStyle: { color: COLORS.chochBullish },
            label: {
              show: true,
              formatter: "CHoCH",
              fontSize: 8,
              color: COLORS.chochBullish,
              position: "top",
            },
          };
        }
        if (data.bearishBos) {
          return {
            coord: [idx, data.brokenLevel ?? candles[idx].low],
            symbol: "diamond",
            symbolSize: 12,
            itemStyle: { color: COLORS.chochBearish },
            label: {
              show: true,
              formatter: "CHoCH",
              fontSize: 8,
              color: COLORS.chochBearish,
              position: "bottom",
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    if (chochMarkers.length > 0) {
      series.push({
        name: "CHoCH",
        type: "scatter",
        data: [],
        markPoint: { data: chochMarkers },
      });
    }
  }
}
