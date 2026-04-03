/**
 * Wyckoff Phase Detection
 *
 * Identifies Wyckoff market phases (Accumulation, Markup, Distribution, Markdown)
 * using a state machine driven by VSA bar classifications, swing points, and
 * structure breaks (BOS/CHoCH).
 *
 * The Wyckoff method models the market cycle as institutional accumulation and
 * distribution. Each phase consists of characteristic events (PS, SC, AR, ST,
 * Spring, SOS, etc.) that this detector identifies and scores.
 *
 * @packageDocumentation
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { breakOfStructure } from "../price/break-of-structure";
import { swingPoints } from "../price/swing-points";
import { atr } from "../volatility/atr";
import { vsa } from "./vsa";
import type { VsaBarType } from "./vsa";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Wyckoff market phase */
export type WyckoffPhase = "accumulation" | "markup" | "distribution" | "markdown" | "unknown";

/** Wyckoff schematic events */
export type WyckoffEvent =
  | "PS"
  | "SC"
  | "AR"
  | "ST"
  | "spring"
  | "test"
  | "SOS"
  | "LPS"
  | "BU"
  | "PSY"
  | "BC"
  | "SOW"
  | "LPSY"
  | "UT"
  | "UTAD";

/** Per-bar Wyckoff phase analysis result */
export type WyckoffValue = {
  /** Current phase */
  phase: WyckoffPhase;
  /** Sub-phase within the schematic (e.g. "phase_A", "phase_B", "phase_C") */
  subPhase: string | null;
  /** Most recent event detected at this bar */
  event: WyckoffEvent | null;
  /** Confidence score 0-100 based on confirmed events vs expected */
  confidence: number;
  /** Upper boundary of the trading range */
  rangeHigh: number | null;
  /** Lower boundary of the trading range */
  rangeLow: number | null;
  /** All events detected so far in this phase */
  eventsDetected: WyckoffEvent[];
};

/** Options for Wyckoff phase detection */
export type WyckoffPhaseOptions = {
  /** Swing point detection period (default: 5) */
  swingPeriod?: number;
  /** Minimum bars for a trading range to be considered (default: 20) */
  minRangeBars?: number;
  /** ATR period (default: 14) */
  atrPeriod?: number;
  /** Volume MA period (default: 20) */
  volumeMaPeriod?: number;
  /** ATR multiplier for range boundary tolerance (default: 0.5) */
  rangeTolerance?: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCUMULATION_EVENTS: WyckoffEvent[] = ["PS", "SC", "AR", "ST", "spring", "SOS", "LPS"];
const DISTRIBUTION_EVENTS: WyckoffEvent[] = ["PSY", "BC", "AR", "ST", "UT", "SOW", "LPSY"];

// ---------------------------------------------------------------------------
// Internal state machine
// ---------------------------------------------------------------------------

type DetectorState = {
  phase: WyckoffPhase;
  subPhase: string | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  events: WyckoffEvent[];
  rangeStartIndex: number;
  // Tracking previous trend direction from BOS
  prevTrend: "bullish" | "bearish" | "neutral";
  // Volume at SC/BC for comparison
  climaxVolume: number;
  // Price at key events
  scPrice: number | null;
  arPrice: number | null;
  bcPrice: number | null;
};

function createInitialState(): DetectorState {
  return {
    phase: "unknown",
    subPhase: null,
    rangeHigh: null,
    rangeLow: null,
    events: [],
    rangeStartIndex: 0,
    prevTrend: "neutral",
    climaxVolume: 0,
    scPrice: null,
    arPrice: null,
    bcPrice: null,
  };
}

function hasEvent(state: DetectorState, event: WyckoffEvent): boolean {
  return state.events.includes(event);
}

function addEvent(state: DetectorState, event: WyckoffEvent): void {
  if (!state.events.includes(event)) {
    state.events.push(event);
  }
}

function calculateConfidence(state: DetectorState): number {
  let expected: WyckoffEvent[];
  if (state.phase === "accumulation" || state.phase === "markup") {
    expected = ACCUMULATION_EVENTS;
  } else if (state.phase === "distribution" || state.phase === "markdown") {
    expected = DISTRIBUTION_EVENTS;
  } else {
    return 0;
  }
  const matched = expected.filter((e) => state.events.includes(e)).length;
  return Math.round((matched / expected.length) * 100);
}

function getSubPhase(state: DetectorState): string | null {
  if (state.phase === "accumulation") {
    if (hasEvent(state, "SOS")) return "phase_D";
    if (hasEvent(state, "spring") || hasEvent(state, "test")) return "phase_C";
    if (hasEvent(state, "ST")) return "phase_B";
    if (hasEvent(state, "AR")) return "phase_A";
    return "phase_A";
  }
  if (state.phase === "distribution") {
    if (hasEvent(state, "SOW")) return "phase_D";
    if (hasEvent(state, "UT") || hasEvent(state, "UTAD")) return "phase_C";
    if (hasEvent(state, "ST")) return "phase_B";
    if (hasEvent(state, "AR")) return "phase_A";
    return "phase_A";
  }
  return null;
}

function isNearLevel(price: number, level: number, tolerance: number): boolean {
  return Math.abs(price - level) <= tolerance;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Detect Wyckoff market phases and schematic events.
 *
 * Combines VSA bar analysis, swing point detection, and break-of-structure
 * signals to identify accumulation/distribution phases and their component
 * events (PS, SC, AR, ST, Spring, SOS, etc.).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options
 * @returns Series of Wyckoff values with phase, event, and confidence
 *
 * @example
 * ```ts
 * const phases = wyckoffPhases(candles);
 * const last = phases[phases.length - 1].value;
 * if (last.phase === 'accumulation' && last.confidence > 60) {
 *   console.log('Accumulation phase detected with high confidence');
 *   console.log('Events:', last.eventsDetected);
 * }
 * ```
 */
export function wyckoffPhases(
  candles: Candle[] | NormalizedCandle[],
  options: WyckoffPhaseOptions = {},
): Series<WyckoffValue> {
  const {
    swingPeriod = 5,
    minRangeBars = 20,
    atrPeriod = 14,
    volumeMaPeriod = 20,
    rangeTolerance = 0.5,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) return [];

  // Pre-compute indicators
  const vsaSeries = vsa(normalized, { atrPeriod, volumeMaPeriod });
  const swingSeries = swingPoints(normalized, {
    leftBars: swingPeriod,
    rightBars: swingPeriod,
  });
  const bosSeries = breakOfStructure(normalized, { swingPeriod });
  const atrSeries = atr(normalized, { period: atrPeriod });

  const state = createInitialState();
  const result: Series<WyckoffValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    const vsaVal = vsaSeries[i]?.value;
    const swingVal = swingSeries[i]?.value;
    const bosVal = bosSeries[i]?.value;
    const atrVal = atrSeries[i]?.value ?? 0;
    const tolerance = atrVal * rangeTolerance;
    let currentEvent: WyckoffEvent | null = null;

    // Track trend from BOS
    if (bosVal) {
      if (bosVal.bullishBos) state.prevTrend = "bullish";
      if (bosVal.bearishBos) state.prevTrend = "bearish";
    }

    const barType: VsaBarType = vsaVal?.barType ?? "normal";
    const isSwingHigh = swingVal?.isSwingHigh ?? false;
    const isSwingLow = swingVal?.isSwingLow ?? false;

    // --- Phase detection logic ---

    if (state.phase === "unknown") {
      // Look for potential phase start based on trend + swing + volume
      if (isSwingLow && state.prevTrend === "bearish" && isHighVolumeBar(barType)) {
        // Preliminary Support after downtrend
        state.phase = "accumulation";
        state.rangeStartIndex = i;
        state.rangeLow = c.low;
        addEvent(state, "PS");
        currentEvent = "PS";
      } else if (isSwingHigh && state.prevTrend === "bullish" && isHighVolumeBar(barType)) {
        // Preliminary Supply after uptrend
        state.phase = "distribution";
        state.rangeStartIndex = i;
        state.rangeHigh = c.high;
        addEvent(state, "PSY");
        currentEvent = "PSY";
      }
    } else if (state.phase === "accumulation") {
      currentEvent = detectAccumulationEvent(
        state,
        c,
        barType,
        isSwingHigh,
        isSwingLow,
        bosVal,
        tolerance,
      );

      // Transition to markup
      if (hasEvent(state, "SOS") && hasEvent(state, "LPS")) {
        state.phase = "markup";
      }
    } else if (state.phase === "distribution") {
      currentEvent = detectDistributionEvent(
        state,
        c,
        barType,
        isSwingHigh,
        isSwingLow,
        bosVal,
        tolerance,
      );

      // Transition to markdown
      if (hasEvent(state, "SOW") && hasEvent(state, "LPSY")) {
        state.phase = "markdown";
      }
    } else if (state.phase === "markup") {
      // Look for distribution start
      if (isSwingHigh && isHighVolumeBar(barType) && i - state.rangeStartIndex > minRangeBars) {
        // Reset to potential distribution
        resetState(state, "distribution", i, null, c.high);
        addEvent(state, "PSY");
        currentEvent = "PSY";
      }
    } else if (state.phase === "markdown") {
      // Look for accumulation start
      if (isSwingLow && isHighVolumeBar(barType) && i - state.rangeStartIndex > minRangeBars) {
        resetState(state, "accumulation", i, c.low, null);
        addEvent(state, "PS");
        currentEvent = "PS";
      }
    }

    state.subPhase = getSubPhase(state);

    result.push({
      time: c.time,
      value: {
        phase: state.phase,
        subPhase: state.subPhase,
        event: currentEvent,
        confidence: calculateConfidence(state),
        rangeHigh: state.rangeHigh,
        rangeLow: state.rangeLow,
        eventsDetected: [...state.events],
      },
    });
  }

  return tagSeries(result, { overlay: false, label: "Wyckoff" });
}

// ---------------------------------------------------------------------------
// Event detectors
// ---------------------------------------------------------------------------

function detectAccumulationEvent(
  state: DetectorState,
  c: NormalizedCandle,
  barType: VsaBarType,
  isSwingHigh: boolean,
  isSwingLow: boolean,
  bosVal: { bullishBos: boolean; bearishBos: boolean } | undefined,
  tolerance: number,
): WyckoffEvent | null {
  // SC: Selling Climax — swing low below PS with climactic volume
  if (
    !hasEvent(state, "SC") &&
    isSwingLow &&
    isClimacticBar(barType) &&
    state.rangeLow != null &&
    c.low <= state.rangeLow
  ) {
    state.rangeLow = c.low;
    state.scPrice = c.low;
    state.climaxVolume = c.volume;
    addEvent(state, "SC");
    return "SC";
  }

  // AR: Automatic Rally — first swing high after SC
  if (hasEvent(state, "SC") && !hasEvent(state, "AR") && isSwingHigh) {
    state.rangeHigh = c.high;
    state.arPrice = c.high;
    addEvent(state, "AR");
    return "AR";
  }

  // ST: Secondary Test — swing low near SC with decreasing volume
  if (
    hasEvent(state, "AR") &&
    !hasEvent(state, "ST") &&
    isSwingLow &&
    state.scPrice != null &&
    isNearLevel(c.low, state.scPrice, tolerance) &&
    c.volume < state.climaxVolume
  ) {
    addEvent(state, "ST");
    return "ST";
  }

  // Spring: price breaks below range low then closes back inside
  if (
    hasEvent(state, "ST") &&
    !hasEvent(state, "spring") &&
    state.rangeLow != null &&
    c.low < state.rangeLow &&
    c.close > state.rangeLow &&
    (barType === "spring" || barType === "test")
  ) {
    addEvent(state, "spring");
    return "spring";
  }

  // Test: low volume test near range low
  if (
    hasEvent(state, "ST") &&
    !hasEvent(state, "test") &&
    !hasEvent(state, "spring") &&
    state.rangeLow != null &&
    isNearLevel(c.low, state.rangeLow, tolerance) &&
    barType === "test"
  ) {
    addEvent(state, "test");
    return "test";
  }

  // SOS: Sign of Strength — bullish BOS above range high
  if (
    (hasEvent(state, "spring") || hasEvent(state, "test") || hasEvent(state, "ST")) &&
    !hasEvent(state, "SOS") &&
    bosVal?.bullishBos &&
    state.rangeHigh != null &&
    c.close > state.rangeHigh
  ) {
    addEvent(state, "SOS");
    return "SOS";
  }

  // LPS: Last Point of Support — pullback after SOS that holds above midpoint
  if (hasEvent(state, "SOS") && !hasEvent(state, "LPS") && isSwingLow) {
    const midpoint =
      state.rangeLow != null && state.rangeHigh != null
        ? (state.rangeLow + state.rangeHigh) / 2
        : null;
    if (midpoint != null && c.low >= midpoint) {
      addEvent(state, "LPS");
      return "LPS";
    }
  }

  return null;
}

function detectDistributionEvent(
  state: DetectorState,
  c: NormalizedCandle,
  barType: VsaBarType,
  isSwingHigh: boolean,
  isSwingLow: boolean,
  bosVal: { bullishBos: boolean; bearishBos: boolean } | undefined,
  tolerance: number,
): WyckoffEvent | null {
  // BC: Buying Climax — swing high above PSY with climactic volume
  if (
    !hasEvent(state, "BC") &&
    isSwingHigh &&
    isClimacticBar(barType) &&
    state.rangeHigh != null &&
    c.high >= state.rangeHigh
  ) {
    state.rangeHigh = c.high;
    state.bcPrice = c.high;
    state.climaxVolume = c.volume;
    addEvent(state, "BC");
    return "BC";
  }

  // AR: Automatic Reaction — first swing low after BC
  if (hasEvent(state, "BC") && !hasEvent(state, "AR") && isSwingLow) {
    state.rangeLow = c.low;
    state.arPrice = c.low;
    addEvent(state, "AR");
    return "AR";
  }

  // ST: Secondary Test — swing high near BC with decreasing volume
  if (
    hasEvent(state, "AR") &&
    !hasEvent(state, "ST") &&
    isSwingHigh &&
    state.bcPrice != null &&
    isNearLevel(c.high, state.bcPrice, tolerance) &&
    c.volume < state.climaxVolume
  ) {
    addEvent(state, "ST");
    return "ST";
  }

  // UT: Upthrust — price exceeds range high then reverses
  if (
    hasEvent(state, "ST") &&
    !hasEvent(state, "UT") &&
    state.rangeHigh != null &&
    c.high > state.rangeHigh &&
    c.close < state.rangeHigh &&
    (barType === "upthrust" || c.close < c.open)
  ) {
    addEvent(state, "UT");
    return "UT";
  }

  // UTAD: Upthrust After Distribution — late-stage UT
  if (
    hasEvent(state, "UT") &&
    !hasEvent(state, "UTAD") &&
    state.rangeHigh != null &&
    c.high > state.rangeHigh &&
    c.close < state.rangeHigh
  ) {
    addEvent(state, "UTAD");
    return "UTAD";
  }

  // SOW: Sign of Weakness — bearish BOS below range low
  if (
    (hasEvent(state, "UT") || hasEvent(state, "ST")) &&
    !hasEvent(state, "SOW") &&
    bosVal?.bearishBos &&
    state.rangeLow != null &&
    c.close < state.rangeLow
  ) {
    addEvent(state, "SOW");
    return "SOW";
  }

  // LPSY: Last Point of Supply — rally that fails to reach range high
  if (hasEvent(state, "SOW") && !hasEvent(state, "LPSY") && isSwingHigh) {
    const midpoint =
      state.rangeLow != null && state.rangeHigh != null
        ? (state.rangeLow + state.rangeHigh) / 2
        : null;
    if (
      midpoint != null &&
      state.rangeHigh != null &&
      c.high <= state.rangeHigh &&
      c.high < midpoint + (state.rangeHigh - midpoint) * 0.5
    ) {
      addEvent(state, "LPSY");
      return "LPSY";
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHighVolumeBar(barType: VsaBarType): boolean {
  return (
    barType === "climacticAction" ||
    barType === "stoppingVolume" ||
    barType === "absorption" ||
    barType === "effortUp" ||
    barType === "effortDown"
  );
}

function isClimacticBar(barType: VsaBarType): boolean {
  return (
    barType === "climacticAction" ||
    barType === "stoppingVolume" ||
    barType === "effortUp" ||
    barType === "effortDown"
  );
}

function resetState(
  state: DetectorState,
  phase: WyckoffPhase,
  startIndex: number,
  rangeLow: number | null,
  rangeHigh: number | null,
): void {
  state.phase = phase;
  state.rangeStartIndex = startIndex;
  state.rangeLow = rangeLow;
  state.rangeHigh = rangeHigh;
  state.events = [];
  state.subPhase = null;
  state.climaxVolume = 0;
  state.scPrice = null;
  state.arPrice = null;
  state.bcPrice = null;
}
