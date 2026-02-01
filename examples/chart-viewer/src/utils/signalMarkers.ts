/**
 * Signal marker generation for ECharts
 * Perfect Order, Range-Bound, and Cross signals
 */

import type {
  NormalizedCandle,
  PerfectOrderValueEnhanced,
  RangeBoundValue,
  CrossSignalQuality,
  Series,
} from "trendcraft";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkPointItem = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkAreaItem = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkLineItem = any;

/**
 * Signal colors
 */
const SIGNAL_COLORS = {
  // Perfect Order
  bullishConfirmed: "#26a69a",
  bearishConfirmed: "#ef5350",
  preBullish: "#ff9f43",
  preBearish: "#ff9f43",
  collapsed: "#888",
  breakdown: "#e67e22",
  pullbackBuy: "#00bcd4",
  // Range-Bound
  rangeArea: "rgba(156, 39, 176, 0.12)",
  rangeBorder: "#9c27b0",
  tightRangeArea: "rgba(233, 30, 99, 0.15)",
  tightRangeBorder: "#e91e63",
  resistance: "#ef5350",
  support: "#4caf50",
  resistanceTight: "#ff5252",
  supportTight: "#69f0ae",
  // Cross
  goldenCross: "#26a69a",
  deadCross: "#ef5350",
  crossFake: "#ff9f43",
};

// ============================================================================
// Perfect Order Markers
// ============================================================================

/**
 * Create markPoint data for enhanced perfect order signals
 */
export function createPerfectOrderMarkPoints(
  poData: Series<PerfectOrderValueEnhanced>,
  candles: NormalizedCandle[],
  dates: string[]
): MarkPointItem[] {
  const markPoints: MarkPointItem[] = [];

  let hasEverConfirmedBullish = false;
  let hasEverConfirmedBearish = false;

  poData.forEach((po, idx) => {
    const state = po.value.state;
    const isConfirmed = po.value.isConfirmed;

    if (state === "BULLISH_PO" && isConfirmed) hasEverConfirmedBullish = true;
    if (state === "BEARISH_PO" && isConfirmed) hasEverConfirmedBearish = true;

    // Confirmed BULLISH_PO
    if (po.value.confirmationFormed && state === "BULLISH_PO") {
      const price = candles[idx].low * 0.995;
      markPoints.push({
        name: "PO Bullish Confirmed",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 16,
        itemStyle: { color: SIGNAL_COLORS.bullishConfirmed },
        label: { show: true, formatter: "PO+", color: "#fff", fontSize: 8, position: "inside" },
      });
    }

    // Confirmed BEARISH_PO
    if (po.value.confirmationFormed && state === "BEARISH_PO") {
      const price = candles[idx].high * 1.005;
      markPoints.push({
        name: "PO Bearish Confirmed",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 16,
        itemStyle: { color: SIGNAL_COLORS.bearishConfirmed },
        label: { show: true, formatter: "PO-", color: "#fff", fontSize: 8, position: "inside" },
      });
    }

    // PRE_BULLISH_PO
    if (
      state === "PRE_BULLISH_PO" &&
      !isConfirmed &&
      po.value.persistCount === 1 &&
      !hasEverConfirmedBullish
    ) {
      const price = candles[idx].low * 0.995;
      markPoints.push({
        name: "PO Pre-Bullish",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: SIGNAL_COLORS.preBullish },
        label: { show: true, formatter: "PO?", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // PRE_BEARISH_PO
    if (
      state === "PRE_BEARISH_PO" &&
      !isConfirmed &&
      po.value.persistCount === 1 &&
      !hasEverConfirmedBearish
    ) {
      const price = candles[idx].high * 1.005;
      markPoints.push({
        name: "PO Pre-Bearish",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: SIGNAL_COLORS.preBearish },
        label: { show: true, formatter: "PO?", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // COLLAPSED
    if (po.value.collapseDetected) {
      const price = candles[idx].low * 0.995;
      markPoints.push({
        name: "MA Collapsed",
        coord: [dates[idx], price],
        symbol: "rect",
        symbolSize: 12,
        itemStyle: { color: SIGNAL_COLORS.collapsed },
        label: { show: true, formatter: "SQ", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // PO_BREAKDOWN
    if (po.value.breakdownDetected) {
      const price = candles[idx].high * 1.005;
      markPoints.push({
        name: "PO Breakdown",
        coord: [dates[idx], price],
        symbol: "triangle",
        symbolSize: 12,
        symbolRotate: 180,
        itemStyle: { color: SIGNAL_COLORS.breakdown },
        label: { show: true, formatter: "BD", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // Pullback Buy Signal
    if (po.value.pullbackBuySignal && po.value.type === "bullish") {
      const price = candles[idx].low * 0.99;
      markPoints.push({
        name: "Pullback Buy",
        coord: [dates[idx], price],
        symbol: "triangle",
        symbolSize: 14,
        itemStyle: { color: SIGNAL_COLORS.pullbackBuy },
        label: { show: true, formatter: "PB", color: "#fff", fontSize: 7, position: "inside" },
      });
    }
  });

  return markPoints;
}

// ============================================================================
// Range-Bound Areas and Lines
// ============================================================================

interface RangeInfo {
  startIdx: number;
  endIdx: number;
  high: number;
  low: number;
  isTight: boolean;
}

function shouldMergeRanges(r1: RangeInfo, r2: RangeInfo): boolean {
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

function mergeRanges(r1: RangeInfo, r2: RangeInfo): RangeInfo {
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

// ============================================================================
// Cross Signal Markers
// ============================================================================

/**
 * Create markPoint data for Golden/Dead Cross signals
 */
export function createCrossMarkPoints(
  crossSignals: CrossSignalQuality[],
  candles: NormalizedCandle[],
  dates: string[]
): MarkPointItem[] {
  const markPoints: MarkPointItem[] = [];

  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  crossSignals.forEach((signal) => {
    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) return;

    const isGolden = signal.type === "golden";
    const isFake = signal.isFake;
    const candle = candles[idx];
    const price = isGolden ? candle.low * 0.995 : candle.high * 1.005;

    markPoints.push({
      name: isGolden ? "Golden Cross" : "Dead Cross",
      coord: [dates[idx], price],
      symbol: "circle",
      symbolSize: isFake ? 10 : 14,
      itemStyle: {
        color: isFake
          ? SIGNAL_COLORS.crossFake
          : isGolden
            ? SIGNAL_COLORS.goldenCross
            : SIGNAL_COLORS.deadCross,
      },
      label: {
        show: true,
        formatter: isGolden ? "GC" : "DC",
        color: "#fff",
        fontSize: isFake ? 6 : 8,
        position: "inside",
      },
    });
  });

  return markPoints;
}
