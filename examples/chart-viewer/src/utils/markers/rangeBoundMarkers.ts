/**
 * Range-Bound area and support/resistance line markers for ECharts
 */

import type {
  RangeBoundValue,
  Series,
} from "trendcraft";

import { SIGNAL_COLORS, type MarkAreaItem, type MarkLineItem } from "./signalColors";

interface RangeInfo {
  startIdx: number;
  endIdx: number;
  high: number;
  low: number;
  isTight: boolean;
}

export function shouldMergeRanges(r1: RangeInfo, r2: RangeInfo): boolean {
  const MAX_GAP = 5;
  const MIN_OVERLAP_RATIO = 0.3;

  const gap = r2.startIdx - r1.endIdx;
  if (gap > MAX_GAP) return false;

  const overlap = Math.min(r1.high, r2.high) - Math.max(r1.low, r2.low);
  const r1Range = r1.high - r1.low;
  const r2Range = r2.high - r2.low;
  const minRange = Math.min(r1Range, r2Range);

  if (minRange === 0) return false;
  return overlap / minRange >= MIN_OVERLAP_RATIO;
}

export function mergeRanges(r1: RangeInfo, r2: RangeInfo): RangeInfo {
  return {
    startIdx: r1.startIdx,
    endIdx: r2.endIdx,
    high: Math.max(r1.high, r2.high),
    low: Math.min(r1.low, r2.low),
    isTight: r1.isTight && r2.isTight,
  };
}

/**
 * Create markArea data for Range-Bound periods
 */
export function createRangeBoundAreas(
  rbData: Series<RangeBoundValue>,
  dates: string[]
): MarkAreaItem[] {
  const ranges: RangeInfo[] = [];

  let rangeStart: number | null = null;
  let rangeHigh: number | null = null;
  let rangeLow: number | null = null;
  let currentRangeType: "range" | "tight" | null = null;

  const closeRange = (endIdx: number) => {
    if (rangeStart === null || rangeHigh === null || rangeLow === null) return;
    ranges.push({
      startIdx: rangeStart,
      endIdx,
      high: rangeHigh,
      low: rangeLow,
      isTight: currentRangeType === "tight",
    });
    rangeStart = null;
    rangeHigh = null;
    rangeLow = null;
    currentRangeType = null;
  };

  rbData.forEach((rb, idx) => {
    const isInRange =
      rb.value.state === "RANGE_CONFIRMED" ||
      rb.value.state === "RANGE_TIGHT" ||
      rb.value.state === "BREAKOUT_RISK_UP" ||
      rb.value.state === "BREAKOUT_RISK_DOWN";
    const isTight = rb.value.state === "RANGE_TIGHT";
    const high = rb.value.rangeHigh;
    const low = rb.value.rangeLow;

    if (isInRange && high !== null && low !== null) {
      if (rangeStart === null) {
        rangeStart = idx;
        rangeHigh = high;
        rangeLow = low;
        currentRangeType = isTight ? "tight" : "range";
      } else {
        if (high > (rangeHigh ?? high)) rangeHigh = high;
        if (low < (rangeLow ?? low)) rangeLow = low;
        if (isTight) currentRangeType = "tight";
      }
    } else {
      if (rangeStart !== null) closeRange(idx - 1);
    }
  });

  if (rangeStart !== null) closeRange(rbData.length - 1);

  // Merge adjacent ranges
  const mergedRanges: RangeInfo[] = [];
  for (const range of ranges) {
    if (mergedRanges.length === 0) {
      mergedRanges.push(range);
    } else {
      const lastRange = mergedRanges[mergedRanges.length - 1];
      if (shouldMergeRanges(lastRange, range)) {
        mergedRanges[mergedRanges.length - 1] = mergeRanges(lastRange, range);
      } else {
        mergedRanges.push(range);
      }
    }
  }

  return mergedRanges.map((range) => {
    const color = range.isTight ? SIGNAL_COLORS.tightRangeArea : SIGNAL_COLORS.rangeArea;
    const borderColor = range.isTight ? SIGNAL_COLORS.tightRangeBorder : SIGNAL_COLORS.rangeBorder;
    const label = range.isTight ? "Tight" : "Range";

    return [
      {
        xAxis: dates[range.startIdx],
        yAxis: range.high,
        itemStyle: { color, borderColor, borderWidth: 1 },
        label: {
          show: true,
          position: "insideTop",
          color: borderColor,
          fontSize: 9,
          formatter: label,
        },
      },
      { xAxis: dates[range.endIdx], yAxis: range.low },
    ];
  });
}

/**
 * Create support/resistance lines
 */
export function createSupportResistanceLines(
  rbData: Series<RangeBoundValue>,
  dates: string[]
): MarkLineItem[] {
  interface SupportResistanceLine {
    type: "resistance" | "support";
    price: number;
    startIdx: number;
    endIdx: number;
    isTight: boolean;
  }

  const lines: SupportResistanceLine[] = [];
  const dataLength = dates.length;

  let rangeStart: number | null = null;
  let currentHigh: number | null = null;
  let currentLow: number | null = null;
  let isTight = false;

  const closeLine = (endIdx: number) => {
    if (rangeStart === null || currentHigh === null || currentLow === null) return;
    lines.push({ type: "resistance", price: currentHigh, startIdx: rangeStart, endIdx, isTight });
    lines.push({ type: "support", price: currentLow, startIdx: rangeStart, endIdx, isTight });
    rangeStart = null;
    currentHigh = null;
    currentLow = null;
  };

  rbData.forEach((rb, idx) => {
    const isInRange =
      rb.value.state === "RANGE_CONFIRMED" ||
      rb.value.state === "RANGE_TIGHT" ||
      rb.value.state === "BREAKOUT_RISK_UP" ||
      rb.value.state === "BREAKOUT_RISK_DOWN";
    const high = rb.value.rangeHigh;
    const low = rb.value.rangeLow;

    if (isInRange && high !== null && low !== null) {
      if (rangeStart === null) {
        rangeStart = idx;
        currentHigh = high;
        currentLow = low;
        isTight = rb.value.state === "RANGE_TIGHT";
      } else {
        if (high > (currentHigh ?? high)) currentHigh = high;
        if (low < (currentLow ?? low)) currentLow = low;
        isTight = rb.value.state === "RANGE_TIGHT";
      }
    } else {
      if (rangeStart !== null) closeLine(idx - 1);
    }
  });

  if (rangeStart !== null) closeLine(rbData.length - 1);

  const result: MarkLineItem[] = [];

  lines.forEach((line) => {
    const isResistance = line.type === "resistance";
    const color = isResistance
      ? line.isTight
        ? SIGNAL_COLORS.resistanceTight
        : SIGNAL_COLORS.resistance
      : line.isTight
        ? SIGNAL_COLORS.supportTight
        : SIGNAL_COLORS.support;
    const position = isResistance ? "insideEndTop" : "insideEndBottom";

    // Solid line for actual range period
    result.push([
      {
        xAxis: dates[line.startIdx],
        yAxis: line.price,
        lineStyle: { color, width: line.isTight ? 2 : 1.5, type: "solid" },
        label: {
          show: true,
          position,
          formatter: `${isResistance ? "R" : "S"}: ${line.price.toFixed(0)}`,
          color,
          fontSize: 10,
        },
      },
      { xAxis: dates[line.endIdx], yAxis: line.price },
    ]);

    // Dashed extension line
    if (line.endIdx < dataLength - 1) {
      result.push([
        {
          xAxis: dates[line.endIdx],
          yAxis: line.price,
          lineStyle: { color: `${color}80`, width: 1, type: "dashed" },
          label: { show: false, position, formatter: "", color, fontSize: 10 },
        },
        { xAxis: dates[dataLength - 1], yAxis: line.price },
      ]);
    }
  });

  return result;
}
