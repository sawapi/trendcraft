/**
 * Signal rendering: Perfect Order, Range-Bound, Cross events
 */

import * as TrendCraft from "trendcraft";
import type {
  PerfectOrderValueEnhanced,
  RangeBoundValue,
  SqueezeSignal,
  TrendReason,
} from "trendcraft";
import { currentCandles, currentZoomRange } from "./state";
import { formatDate } from "./utils";

// ============================================================================
// Squeeze Signals
// ============================================================================

/**
 * Create markPoint data for squeeze signals
 */
export function createSqueezeMarkPoints(
  squeezeSignals: SqueezeSignal[],
  dates: string[],
): Array<{
  name: string;
  coord: [string, number];
  symbol: string;
  symbolSize: number;
  itemStyle: { color: string };
  label: { show: boolean; formatter: string; color: string; fontSize: number; position: "inside" };
}> {
  const markPoints: Array<{
    name: string;
    coord: [string, number];
    symbol: string;
    symbolSize: number;
    itemStyle: { color: string };
    label: {
      show: boolean;
      formatter: string;
      color: string;
      fontSize: number;
      position: "inside";
    };
  }> = [];

  const timeToIdx = new Map<number, number>();
  currentCandles.forEach((c, i) => timeToIdx.set(c.time, i));

  squeezeSignals.forEach((signal) => {
    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) return;

    const price = currentCandles[idx].low;
    markPoints.push({
      name: "Squeeze",
      coord: [dates[idx], price],
      symbol: "triangle",
      symbolSize: 12,
      itemStyle: { color: "#ffd93d" },
      label: { show: true, formatter: "SQ", color: "#000", fontSize: 7, position: "inside" },
    });
  });

  return markPoints;
}

// ============================================================================
// Cross Events (GC/DC)
// ============================================================================

/**
 * Get visible date range based on current zoom
 */
export function getVisibleDateRange(): { startDate: number; endDate: number } {
  const totalCandles = currentCandles.length;
  const startIdx = Math.floor((currentZoomRange.start / 100) * totalCandles);
  const endIdx = Math.ceil((currentZoomRange.end / 100) * totalCandles) - 1;

  const startDate = currentCandles[Math.max(0, startIdx)]?.time ?? 0;
  const endDate =
    currentCandles[Math.min(totalCandles - 1, endIdx)]?.time ?? Number.POSITIVE_INFINITY;

  return { startDate, endDate };
}

/**
 * Update GC/DC events list
 */
export function updateCrossEventsList(show: boolean): void {
  const container = document.getElementById("cross-events") as HTMLDivElement;
  const listEl = document.getElementById("cross-events-list") as HTMLDivElement;

  if (!show || currentCandles.length === 0) {
    container.classList.remove("visible");
    return;
  }

  const signals = TrendCraft.validateCrossSignals(currentCandles, {
    short: 5,
    long: 25,
    volumeMaPeriod: 20,
    trendPeriod: 5,
  });

  const { startDate, endDate } = getVisibleDateRange();
  const visibleSignals = signals.filter((s) => s.time >= startDate && s.time <= endDate);
  visibleSignals.sort((a, b) => b.time - a.time);

  if (visibleSignals.length === 0) {
    listEl.innerHTML = '<span style="color: #666;">No events in visible range</span>';
  } else {
    listEl.innerHTML = visibleSignals
      .map((s) => {
        const label = s.type === "golden" ? "GC" : "DC";
        const cssClass = s.type === "golden" ? "gc" : "dc";
        const fakeClass = s.isFake ? " fake" : "";
        const fakeLabel = s.isFake ? " (Maybe fake?)" : "";
        const daysLabel =
          s.details.daysUntilReverse !== null ? ` [→${s.details.daysUntilReverse}d]` : "";

        const volIcon = s.details.volumeConfirmed ? "✓" : "✗";
        const trendIcon = s.details.trendConfirmed ? "✓" : "✗";
        const holdIcon =
          s.details.holdingConfirmed === true
            ? "✓"
            : s.details.holdingConfirmed === false
              ? "✗"
              : "?";
        const priceIcon = s.details.pricePositionConfirmed ? "✓" : "✗";
        const daysInfo =
          s.details.daysUntilReverse !== null ? `${s.details.daysUntilReverse}d` : "N/A";
        const tooltip = `Volume: ${volIcon} / Trend: ${trendIcon} / 5d Hold: ${holdIcon} / Price: ${priceIcon} / Reverse: ${daysInfo}`;

        return `<span class="cross-event ${cssClass}${fakeClass}" title="${tooltip}">${label} ${formatDate(s.time)}${daysLabel}${fakeLabel}</span>`;
      })
      .join("");
  }

  container.classList.add("visible");
}

// ============================================================================
// Perfect Order
// ============================================================================

type POMarkPoint = {
  name: string;
  coord: [string, number];
  symbol: string;
  symbolSize: number;
  symbolRotate?: number;
  itemStyle: { color: string };
  label: {
    show: boolean;
    formatter: string;
    color: string;
    fontSize: number;
    position: "inside" | "top" | "bottom";
  };
};

/**
 * Create markPoint data for enhanced perfect order signals
 */
export function createPerfectOrderMarkPointsEnhanced(
  poData: TrendCraft.Series<PerfectOrderValueEnhanced>,
  dates: string[],
): POMarkPoint[] {
  const markPoints: POMarkPoint[] = [];

  let hasEverConfirmedBullish = false;
  let hasEverConfirmedBearish = false;

  poData.forEach((po, idx) => {
    const state = po.value.state;
    const isConfirmed = po.value.isConfirmed;

    if (state === "BULLISH_PO" && isConfirmed) hasEverConfirmedBullish = true;
    if (state === "BEARISH_PO" && isConfirmed) hasEverConfirmedBearish = true;

    // Confirmed BULLISH_PO
    if (po.value.confirmationFormed && state === "BULLISH_PO") {
      const price = currentCandles[idx].low * 0.995;
      markPoints.push({
        name: "PO Bullish Confirmed",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 16,
        itemStyle: { color: "#26a69a" },
        label: { show: true, formatter: "PO+", color: "#fff", fontSize: 8, position: "inside" },
      });
    }

    // Confirmed BEARISH_PO
    if (po.value.confirmationFormed && state === "BEARISH_PO") {
      const price = currentCandles[idx].high * 1.005;
      markPoints.push({
        name: "PO Bearish Confirmed",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 16,
        itemStyle: { color: "#ef5350" },
        label: { show: true, formatter: "PO+", color: "#fff", fontSize: 8, position: "inside" },
      });
    }

    // PRE_BULLISH_PO
    if (
      state === "PRE_BULLISH_PO" &&
      !isConfirmed &&
      po.value.persistCount === 1 &&
      !hasEverConfirmedBullish
    ) {
      const price = currentCandles[idx].low * 0.995;
      markPoints.push({
        name: "PO Pre-Bullish",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: "#ff9f43" },
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
      const price = currentCandles[idx].high * 1.005;
      markPoints.push({
        name: "PO Pre-Bearish",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: "#ff9f43" },
        label: { show: true, formatter: "PO?", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // COLLAPSED
    if (po.value.collapseDetected) {
      const price = currentCandles[idx].low * 0.995;
      markPoints.push({
        name: "MA Collapsed",
        coord: [dates[idx], price],
        symbol: "rect",
        symbolSize: 12,
        itemStyle: { color: "#888" },
        label: { show: true, formatter: "SQ", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // PO_BREAKDOWN
    if (po.value.breakdownDetected) {
      const price = currentCandles[idx].high * 1.005;
      markPoints.push({
        name: "PO Breakdown",
        coord: [dates[idx], price],
        symbol: "triangle",
        symbolSize: 12,
        itemStyle: { color: "#e67e22" },
        label: { show: true, formatter: "BD", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // Pullback Buy Signal
    if (po.value.pullbackBuySignal && po.value.type === "bullish") {
      const price = currentCandles[idx].low * 0.99;
      markPoints.push({
        name: "Pullback Buy",
        coord: [dates[idx], price],
        symbol: "triangle",
        symbolSize: 14,
        itemStyle: { color: "#00bcd4" },
        label: { show: true, formatter: "PB", color: "#fff", fontSize: 7, position: "inside" },
      });
    }
  });

  return markPoints;
}

/**
 * Update Perfect Order events list (enhanced version)
 */
export function updatePerfectOrderEventsListEnhanced(
  show: boolean,
  poData: TrendCraft.Series<PerfectOrderValueEnhanced>,
): void {
  const container = document.getElementById("perfect-order-events") as HTMLDivElement;
  const listEl = document.getElementById("perfect-order-events-list") as HTMLDivElement;

  if (!show || currentCandles.length === 0) {
    container.classList.remove("visible");
    return;
  }

  const { startDate, endDate } = getVisibleDateRange();

  type EventType =
    | "bullish_confirmed"
    | "bearish_confirmed"
    | "pre_bullish"
    | "pre_bearish"
    | "breakdown"
    | "collapsed"
    | "pullback_buy";
  const events: Array<{
    time: number;
    type: EventType;
    confidence: number;
    strength: number;
    persistCount: number;
    gapPercent?: number;
  }> = [];

  let hasEverConfirmedBullish = false;
  let hasEverConfirmedBearish = false;

  poData.forEach((po) => {
    if (po.value.state === "BULLISH_PO" && po.value.isConfirmed) hasEverConfirmedBullish = true;
    if (po.value.state === "BEARISH_PO" && po.value.isConfirmed) hasEverConfirmedBearish = true;

    if (po.time < startDate || po.time > endDate) return;

    if (po.value.confirmationFormed && po.value.state === "BULLISH_PO") {
      events.push({
        time: po.time,
        type: "bullish_confirmed",
        confidence: po.value.confidence,
        strength: po.value.strength,
        persistCount: po.value.persistCount,
      });
    }
    if (po.value.confirmationFormed && po.value.state === "BEARISH_PO") {
      events.push({
        time: po.time,
        type: "bearish_confirmed",
        confidence: po.value.confidence,
        strength: po.value.strength,
        persistCount: po.value.persistCount,
      });
    }
    if (
      po.value.state === "PRE_BULLISH_PO" &&
      po.value.persistCount === 1 &&
      !hasEverConfirmedBullish
    ) {
      events.push({
        time: po.time,
        type: "pre_bullish",
        confidence: po.value.confidence,
        strength: po.value.strength,
        persistCount: po.value.persistCount,
      });
    }
    if (
      po.value.state === "PRE_BEARISH_PO" &&
      po.value.persistCount === 1 &&
      !hasEverConfirmedBearish
    ) {
      events.push({
        time: po.time,
        type: "pre_bearish",
        confidence: po.value.confidence,
        strength: po.value.strength,
        persistCount: po.value.persistCount,
      });
    }
    if (po.value.breakdownDetected) {
      events.push({
        time: po.time,
        type: "breakdown",
        confidence: po.value.confidence,
        strength: 0,
        persistCount: 0,
      });
    }
    if (po.value.collapseDetected) {
      events.push({
        time: po.time,
        type: "collapsed",
        confidence: po.value.confidence,
        strength: 0,
        persistCount: 0,
      });
    }
  });

  // Pullback buy signals
  poData.forEach((po) => {
    if (po.time < startDate || po.time > endDate) return;

    if (po.value.pullbackBuySignal && po.value.type === "bullish") {
      const shortMa = po.value.maValues[0];
      const midMa = po.value.maValues[1];
      const gapPercent =
        shortMa !== null && midMa !== null && midMa !== 0 ? ((shortMa - midMa) / midMa) * 100 : 0;
      events.push({
        time: po.time,
        type: "pullback_buy",
        confidence: po.value.confidence,
        strength: po.value.strength,
        persistCount: 0,
        gapPercent,
      });
    }
  });

  events.sort((a, b) => b.time - a.time);

  if (events.length === 0) {
    listEl.innerHTML = '<span style="color: #666;">No events in visible range</span>';
  } else {
    listEl.innerHTML = events
      .map((e) => {
        const confPercent = Math.round(e.confidence * 100);
        switch (e.type) {
          case "bullish_confirmed":
            return `<span class="po-event bullish" title="Confidence: ${confPercent}%, Strength: ${e.strength}">↑ Bullish [${confPercent}%] ${formatDate(e.time)}</span>`;
          case "bearish_confirmed":
            return `<span class="po-event bearish" title="Confidence: ${confPercent}%, Strength: ${e.strength}">↓ Bearish [${confPercent}%] ${formatDate(e.time)}</span>`;
          case "pre_bullish":
            return `<span class="po-event pre-bullish" title="Confidence: ${confPercent}%">? Pre-Bull [${confPercent}%] ${formatDate(e.time)}</span>`;
          case "pre_bearish":
            return `<span class="po-event pre-bearish" title="Confidence: ${confPercent}%">? Pre-Bear [${confPercent}%] ${formatDate(e.time)}</span>`;
          case "breakdown":
            return `<span class="po-event breakdown" title="Confidence: ${confPercent}%">▼ Breakdown ${formatDate(e.time)}</span>`;
          case "collapsed":
            return `<span class="po-event collapsed" title="MA Convergence">■ Collapsed ${formatDate(e.time)}</span>`;
          case "pullback_buy":
            return `<span class="po-event pullback-buy" title="Gap: ${e.gapPercent?.toFixed(1)}%">▲ Pullback Buy [${e.gapPercent?.toFixed(1)}%] ${formatDate(e.time)}</span>`;
          default:
            return "";
        }
      })
      .join("");
  }

  container.classList.add("visible");
}

// ============================================================================
// Range-Bound
// ============================================================================

type RangeBoxMarkArea = [
  {
    xAxis: string;
    yAxis: number;
    itemStyle: { color: string; borderColor: string; borderWidth: number };
    label?: {
      show: boolean;
      position: "insideTop";
      color: string;
      fontSize: number;
      formatter: string;
    };
  },
  { xAxis: string; yAxis: number },
];

type RangeInfo = {
  startIdx: number;
  endIdx: number;
  high: number;
  low: number;
  isTight: boolean;
};

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
export function createRangeBoundMarkAreas(
  rbData: TrendCraft.Series<RangeBoundValue>,
  dates: string[],
): RangeBoxMarkArea[] {
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
    const color = range.isTight ? "rgba(233, 30, 99, 0.15)" : "rgba(156, 39, 176, 0.12)";
    const borderColor = range.isTight ? "#e91e63" : "#9c27b0";
    const label = range.isTight ? "Tight" : "Range";

    return [
      {
        xAxis: dates[range.startIdx],
        yAxis: range.high,
        itemStyle: { color, borderColor, borderWidth: 1 },
        label: {
          show: true,
          position: "insideTop" as const,
          color: borderColor,
          fontSize: 9,
          formatter: label,
        },
      },
      { xAxis: dates[range.endIdx], yAxis: range.low },
    ];
  });
}

type MarkLinePosition =
  | "start"
  | "end"
  | "middle"
  | "insideStart"
  | "insideStartTop"
  | "insideStartBottom"
  | "insideMiddle"
  | "insideMiddleTop"
  | "insideMiddleBottom"
  | "insideEnd"
  | "insideEndTop"
  | "insideEndBottom";
type LineType = "solid" | "dashed" | "dotted";
type SRMarkLine = [
  {
    xAxis: string;
    yAxis: number;
    lineStyle: { color: string; width: number; type: LineType };
    label: {
      show: boolean;
      position: MarkLinePosition;
      formatter: string;
      color: string;
      fontSize: number;
    };
  },
  { xAxis: string; yAxis: number },
];

/**
 * Create support/resistance lines
 */
export function createSupportResistanceLines(
  rbData: TrendCraft.Series<RangeBoundValue>,
  dates: string[],
): SRMarkLine[] {
  type SupportResistanceLine = {
    type: "resistance" | "support";
    price: number;
    startIdx: number;
    endIdx: number;
    isTight: boolean;
  };

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

  const result: SRMarkLine[] = [];

  lines.forEach((line) => {
    const isResistance = line.type === "resistance";
    const color = isResistance
      ? line.isTight
        ? "#ff5252"
        : "#ef5350"
      : line.isTight
        ? "#69f0ae"
        : "#4caf50";
    const position: MarkLinePosition = isResistance ? "insideEndTop" : "insideEndBottom";

    // Solid line for actual range period
    result.push([
      {
        xAxis: dates[line.startIdx],
        yAxis: line.price,
        lineStyle: { color, width: line.isTight ? 2 : 1.5, type: "solid" as LineType },
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
          lineStyle: { color: `${color}80`, width: 1, type: "dashed" as LineType },
          label: { show: false, position, formatter: "", color, fontSize: 10 },
        },
        { xAxis: dates[dataLength - 1], yAxis: line.price },
      ]);
    }
  });

  return result;
}

/**
 * Update Range-Bound events list
 */
export function updateRangeBoundEventsList(
  show: boolean,
  rbData: TrendCraft.Series<RangeBoundValue>,
): void {
  const container = document.getElementById("range-bound-events") as HTMLDivElement;
  const listEl = document.getElementById("range-bound-events-list") as HTMLDivElement;

  if (!show || currentCandles.length === 0) {
    container.classList.remove("visible");
    return;
  }

  const { startDate, endDate } = getVisibleDateRange();

  type RBEventType =
    | "range_confirmed"
    | "tight_range"
    | "breakout_risk_up"
    | "breakout_risk_down"
    | "range_broken"
    | "trending";
  const events: Array<{
    time: number;
    type: RBEventType;
    rangeScore: number;
    trendReason?: TrendReason;
  }> = [];

  rbData.forEach((rb) => {
    if (rb.time < startDate || rb.time > endDate) return;

    if (rb.value.rangeConfirmed && rb.value.state === "RANGE_CONFIRMED") {
      events.push({ time: rb.time, type: "range_confirmed", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.state === "RANGE_TIGHT") {
      events.push({ time: rb.time, type: "tight_range", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.breakoutRiskDetected && rb.value.state === "BREAKOUT_RISK_UP") {
      events.push({ time: rb.time, type: "breakout_risk_up", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.breakoutRiskDetected && rb.value.state === "BREAKOUT_RISK_DOWN") {
      events.push({ time: rb.time, type: "breakout_risk_down", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.rangeBroken) {
      events.push({ time: rb.time, type: "range_broken", rangeScore: rb.value.rangeScore });
    }
    if (rb.value.state === "TRENDING" && rb.value.trendReason !== null) {
      events.push({
        time: rb.time,
        type: "trending",
        rangeScore: rb.value.rangeScore,
        trendReason: rb.value.trendReason,
      });
    }
  });

  events.sort((a, b) => b.time - a.time);
  const limitedEvents = events.slice(0, 50);

  if (limitedEvents.length === 0) {
    listEl.innerHTML = '<span style="color: #666;">No events in visible range</span>';
  } else {
    listEl.innerHTML = limitedEvents
      .map((e) => {
        const scoreStr = e.rangeScore.toFixed(0);
        switch (e.type) {
          case "range_confirmed":
            return `<span class="rb-event range-confirmed" title="Range Score: ${scoreStr}">■ Range [${scoreStr}] ${formatDate(e.time)}</span>`;
          case "tight_range":
            return `<span class="rb-event tight" title="Range Score: ${scoreStr}">■ Tight [${scoreStr}] ${formatDate(e.time)}</span>`;
          case "breakout_risk_up":
            return `<span class="rb-event breakout-risk" title="Range Score: ${scoreStr}">▲ Risk↑ [${scoreStr}] ${formatDate(e.time)}</span>`;
          case "breakout_risk_down":
            return `<span class="rb-event breakout-risk" title="Range Score: ${scoreStr}">▼ Risk↓ [${scoreStr}] ${formatDate(e.time)}</span>`;
          case "range_broken":
            return `<span class="rb-event trending" title="Range Score: ${scoreStr}">◆ Broken ${formatDate(e.time)}</span>`;
          case "trending": {
            const reason = e.trendReason || "unknown";
            return `<span class="rb-event trending" title="Range Score: ${scoreStr}, Reason: ${reason}">→ ${reason} [${scoreStr}] ${formatDate(e.time)}</span>`;
          }
          default:
            return "";
        }
      })
      .join("");
  }

  container.classList.add("visible");
}
