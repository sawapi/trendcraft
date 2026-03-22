import type { NormalizedCandle } from "trendcraft";
import { COLORS, type SeriesItem, createLineSeries } from "../chartColors";
import type { IndicatorData } from "../indicators";

/**
 * Build price-action overlay series (swing points, pivots, fibonacci, etc.)
 */
export function buildPriceOverlays(
  series: SeriesItem[],
  indicators: IndicatorData,
  enabledIndicators: string[],
  candles: NormalizedCandle[],
): void {
  // Swing Points
  if (enabledIndicators.includes("swingPoints") && indicators.swingPointData) {
    const highMarkers: SeriesItem[] = [];
    const lowMarkers: SeriesItem[] = [];

    indicators.swingPointData.forEach((sp, idx) => {
      if (sp?.isSwingHigh && sp.swingHighPrice != null) {
        highMarkers.push({
          coord: [idx, sp.swingHighPrice],
          symbol: "triangle",
          symbolSize: 8,
          symbolRotate: 180,
          itemStyle: { color: COLORS.swingHigh },
        });
      }
      if (sp?.isSwingLow && sp.swingLowPrice != null) {
        lowMarkers.push({
          coord: [idx, sp.swingLowPrice],
          symbol: "triangle",
          symbolSize: 8,
          itemStyle: { color: COLORS.swingLow },
        });
      }
    });

    if (highMarkers.length > 0 || lowMarkers.length > 0) {
      series.push({
        name: "Swing Points",
        type: "scatter",
        data: [],
        markPoint: { data: [...highMarkers, ...lowMarkers] },
      });
    }
  }

  // Pivot Points
  if (enabledIndicators.includes("pivotPoints") && indicators.pivotData) {
    const lastPivot = indicators.pivotData[indicators.pivotData.length - 1];
    if (lastPivot) {
      const lines: SeriesItem[] = [];
      if (lastPivot.pivot != null) {
        lines.push({
          yAxis: lastPivot.pivot,
          lineStyle: { color: COLORS.pivotPivot, type: "solid", width: 1.5 },
          label: { formatter: "P", color: COLORS.pivotPivot, fontSize: 9, position: "end" },
        });
      }
      const rLevels = [lastPivot.r1, lastPivot.r2, lastPivot.r3];
      const sLevels = [lastPivot.s1, lastPivot.s2, lastPivot.s3];
      rLevels.forEach((r, i) => {
        if (r != null) {
          lines.push({
            yAxis: r,
            lineStyle: { color: COLORS.pivotResistance, type: "dashed", width: 1 },
            label: {
              formatter: `R${i + 1}`,
              color: COLORS.pivotResistance,
              fontSize: 9,
              position: "end",
            },
          });
        }
      });
      sLevels.forEach((s, i) => {
        if (s != null) {
          lines.push({
            yAxis: s,
            lineStyle: { color: COLORS.pivotSupport, type: "dashed", width: 1 },
            label: {
              formatter: `S${i + 1}`,
              color: COLORS.pivotSupport,
              fontSize: 9,
              position: "end",
            },
          });
        }
      });
      if (lines.length > 0) {
        series.push({
          name: "Pivot Points",
          type: "line",
          data: [],
          markLine: { silent: true, symbol: "none", data: lines },
        });
      }
    }
  }

  // Fibonacci Retracement
  if (enabledIndicators.includes("fibonacci") && indicators.fibRetracementData) {
    const lastFib = indicators.fibRetracementData[indicators.fibRetracementData.length - 1];
    if (lastFib?.levels) {
      const fibLines: SeriesItem[] = [];
      for (const [level, price] of Object.entries(lastFib.levels)) {
        fibLines.push({
          yAxis: price,
          lineStyle: { color: COLORS.fibLevel, type: "dashed", width: 1 },
          label: {
            formatter: `Fib ${level}`,
            color: COLORS.fibLevel,
            fontSize: 8,
            position: "end",
          },
        });
      }
      if (fibLines.length > 0) {
        series.push({
          name: "Fibonacci",
          type: "line",
          data: [],
          markLine: { silent: true, symbol: "none", data: fibLines },
        });
      }
    }
  }

  // Fibonacci Extension
  if (enabledIndicators.includes("fibExtension") && indicators.fibExtensionData) {
    const lastExt = indicators.fibExtensionData[indicators.fibExtensionData.length - 1];
    if (lastExt?.levels) {
      const extLines: SeriesItem[] = [];
      for (const [level, price] of Object.entries(lastExt.levels)) {
        extLines.push({
          yAxis: price,
          lineStyle: { color: COLORS.fibExtLevel, type: "dotted", width: 1 },
          label: {
            formatter: `Ext ${level}`,
            color: COLORS.fibExtLevel,
            fontSize: 8,
            position: "end",
          },
        });
      }
      if (extLines.length > 0) {
        series.push({
          name: "Fib Extension",
          type: "line",
          data: [],
          markLine: { silent: true, symbol: "none", data: extLines },
        });
      }
    }
  }

  // Highest / Lowest
  if (enabledIndicators.includes("highestLowest")) {
    if (indicators.highestLine) {
      series.push(
        createLineSeries("Highest", indicators.highestLine, COLORS.highestLine, "dotted"),
      );
    }
    if (indicators.lowestLine) {
      series.push(createLineSeries("Lowest", indicators.lowestLine, COLORS.lowestLine, "dotted"));
    }
  }

  // Auto Trend Line
  if (enabledIndicators.includes("autoTrendLine")) {
    if (indicators.autoTrendResistance) {
      series.push(
        createLineSeries(
          "Trend Resistance",
          indicators.autoTrendResistance,
          COLORS.autoTrendResistance,
          "dashed",
        ),
      );
    }
    if (indicators.autoTrendSupport) {
      series.push(
        createLineSeries(
          "Trend Support",
          indicators.autoTrendSupport,
          COLORS.autoTrendSupport,
          "dashed",
        ),
      );
    }
  }

  // Channel Line
  if (enabledIndicators.includes("channelLine")) {
    if (indicators.channelUpper) {
      series.push(
        createLineSeries("Channel Upper", indicators.channelUpper, COLORS.channelUpper, "dashed"),
      );
    }
    if (indicators.channelMiddle) {
      series.push(
        createLineSeries("Channel Mid", indicators.channelMiddle, COLORS.channelMiddle, "dotted"),
      );
    }
    if (indicators.channelLower) {
      series.push(
        createLineSeries("Channel Lower", indicators.channelLower, COLORS.channelLower, "dashed"),
      );
    }
  }

  // Andrews Pitchfork
  if (enabledIndicators.includes("andrewsPitchfork")) {
    if (indicators.pitchforkMedian) {
      series.push(
        createLineSeries(
          "Pitchfork Median",
          indicators.pitchforkMedian,
          COLORS.pitchforkMedian,
          "solid",
          2,
        ),
      );
    }
    if (indicators.pitchforkUpper) {
      series.push(
        createLineSeries(
          "Pitchfork Upper",
          indicators.pitchforkUpper,
          COLORS.pitchforkUpper,
          "dashed",
        ),
      );
    }
    if (indicators.pitchforkLower) {
      series.push(
        createLineSeries(
          "Pitchfork Lower",
          indicators.pitchforkLower,
          COLORS.pitchforkLower,
          "dashed",
        ),
      );
    }
  }

  // Heikin-Ashi (replace candlestick data)
  // Note: heikinAshi modifies the main candlestick series in the orchestrator

  // Unused parameter suppression
  void candles;
}
