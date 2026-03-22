/**
 * Chart pattern markers for ECharts
 * Renders key points, necklines, and target levels for detected chart patterns
 */

import type { NormalizedCandle, PatternSignal } from "trendcraft";

import { type MarkLineItem, type MarkPointItem, SIGNAL_COLORS } from "./signalColors";

/** Pattern-specific label abbreviations */
const PATTERN_LABELS: Record<string, string> = {
  double_top: "DT",
  double_bottom: "DB",
  head_shoulders: "H&S",
  inverse_head_shoulders: "IH&S",
  cup_handle: "C&H",
  triangle_symmetrical: "ST",
  triangle_ascending: "AT",
  triangle_descending: "DsT",
  rising_wedge: "RW",
  falling_wedge: "FW",
  channel_ascending: "AC",
  channel_descending: "DC",
  channel_horizontal: "HC",
  bull_flag: "BF",
  bear_flag: "BrF",
  bull_pennant: "BP",
  bear_pennant: "BrP",
};

/** Pattern-specific full names */
const PATTERN_NAMES: Record<string, string> = {
  double_top: "Double Top",
  double_bottom: "Double Bottom",
  head_shoulders: "Head & Shoulders",
  inverse_head_shoulders: "Inv H&S",
  cup_handle: "Cup & Handle",
  triangle_symmetrical: "Symmetrical Triangle",
  triangle_ascending: "Ascending Triangle",
  triangle_descending: "Descending Triangle",
  rising_wedge: "Rising Wedge",
  falling_wedge: "Falling Wedge",
  channel_ascending: "Ascending Channel",
  channel_descending: "Descending Channel",
  channel_horizontal: "Horizontal Channel",
  bull_flag: "Bull Flag",
  bear_flag: "Bear Flag",
  bull_pennant: "Bull Pennant",
  bear_pennant: "Bear Pennant",
};

/**
 * Determine if a pattern is bullish or bearish
 */
function isBullishPattern(type: string): boolean {
  return (
    type === "double_bottom" ||
    type === "inverse_head_shoulders" ||
    type === "cup_handle" ||
    type === "triangle_ascending" ||
    type === "falling_wedge" ||
    type === "bull_flag" ||
    type === "bull_pennant"
  );
}

/**
 * Create markPoint data for chart pattern key points
 */
export function createPatternMarkPoints(
  patterns: PatternSignal[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkPointItem[] {
  if (!patterns || patterns.length === 0) return [];

  const markPoints: MarkPointItem[] = [];
  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  for (const pattern of patterns) {
    const bullish = isBullishPattern(pattern.type);
    const color = bullish ? SIGNAL_COLORS.patternBullish : SIGNAL_COLORS.patternBearish;
    const label = PATTERN_LABELS[pattern.type] ?? pattern.type;
    const confPercent = Math.round(pattern.confidence);

    // Render key points as scatter markers
    for (const kp of pattern.pattern.keyPoints) {
      const idx = timeToIdx.get(kp.time);
      if (idx === undefined) continue;

      markPoints.push({
        name: `${PATTERN_NAMES[pattern.type]} - ${kp.label}`,
        coord: [dates[idx], kp.price],
        symbol: "circle",
        symbolSize: 8,
        itemStyle: {
          color,
          borderColor: "#fff",
          borderWidth: 1,
        },
        label: {
          show: false,
        },
      });
    }

    // Place pattern name + confidence label at the detection point
    const detectionIdx = timeToIdx.get(pattern.time);
    if (detectionIdx !== undefined) {
      const yPos = bullish ? candles[detectionIdx].low * 0.98 : candles[detectionIdx].high * 1.02;
      const position = bullish ? "bottom" : "top";

      markPoints.push({
        name: PATTERN_NAMES[pattern.type] ?? pattern.type,
        coord: [dates[detectionIdx], yPos],
        symbol: pattern.confirmed ? "diamond" : "roundRect",
        symbolSize: pattern.confirmed ? 14 : 12,
        itemStyle: {
          color: pattern.confirmed ? color : "transparent",
          borderColor: color,
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: `${label}\n${confPercent}%`,
          color,
          fontSize: 9,
          fontWeight: pattern.confirmed ? "bold" : "normal",
          position,
        },
      });
    }
  }

  return markPoints;
}

/**
 * Create markLine data for pattern necklines and target levels
 */
export function createPatternMarkLines(
  patterns: PatternSignal[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkLineItem[] {
  if (!patterns || patterns.length === 0) return [];

  const markLines: MarkLineItem[] = [];
  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  for (const pattern of patterns) {
    const bullish = isBullishPattern(pattern.type);
    const color = bullish ? SIGNAL_COLORS.patternBullish : SIGNAL_COLORS.patternBearish;

    // Neckline: draw from pattern start to end
    if (pattern.pattern.neckline) {
      const startIdx = timeToIdx.get(pattern.pattern.startTime);
      const endIdx = timeToIdx.get(pattern.pattern.endTime);

      if (startIdx !== undefined && endIdx !== undefined) {
        markLines.push([
          {
            coord: [dates[startIdx], pattern.pattern.neckline.startPrice],
            symbol: "none",
            lineStyle: {
              color,
              type: "dashed",
              width: 1.5,
            },
            label: {
              show: true,
              formatter: "Neckline",
              color,
              fontSize: 9,
              position: "start",
            },
          },
          {
            coord: [dates[endIdx], pattern.pattern.neckline.endPrice],
            symbol: "none",
          },
        ]);
      }
    }

    // Target level: horizontal dotted line from detection point
    if (pattern.pattern.target !== undefined && pattern.confirmed) {
      const detectionIdx = timeToIdx.get(pattern.time);
      if (detectionIdx !== undefined) {
        // Extend target line a few bars beyond detection
        const targetEndIdx = Math.min(dates.length - 1, detectionIdx + 20);

        markLines.push([
          {
            coord: [dates[detectionIdx], pattern.pattern.target],
            symbol: "none",
            lineStyle: {
              color: bullish ? "#4caf50" : "#f44336",
              type: "dotted",
              width: 1,
            },
            label: {
              show: true,
              formatter: `Target: ${pattern.pattern.target.toFixed(0)}`,
              color: bullish ? "#4caf50" : "#f44336",
              fontSize: 8,
              position: "end",
            },
          },
          {
            coord: [dates[targetEndIdx], pattern.pattern.target],
            symbol: "none",
          },
        ]);
      }
    }

    // Stop loss level: horizontal dotted line from detection point
    if (pattern.pattern.stopLoss !== undefined && pattern.confirmed) {
      const detectionIdx = timeToIdx.get(pattern.time);
      if (detectionIdx !== undefined) {
        const slEndIdx = Math.min(dates.length - 1, detectionIdx + 20);

        markLines.push([
          {
            coord: [dates[detectionIdx], pattern.pattern.stopLoss],
            symbol: "none",
            lineStyle: {
              color: "#ff9800",
              type: "dotted",
              width: 1,
            },
            label: {
              show: true,
              formatter: `SL: ${pattern.pattern.stopLoss.toFixed(0)}`,
              color: "#ff9800",
              fontSize: 8,
              position: "end",
            },
          },
          {
            coord: [dates[slEndIdx], pattern.pattern.stopLoss],
            symbol: "none",
          },
        ]);
      }
    }
  }

  return markLines;
}
