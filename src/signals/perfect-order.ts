/**
 * Perfect Order detection for trading signals
 * Detects when multiple moving averages are aligned in order (short > medium > long or vice versa)
 *
 * Uses hysteresis to prevent noise from price crossing the short MA:
 * - Formation requires: price > shortMA AND MA order OK
 * - Continuation requires: price > shortMA × (1 - margin) AND MA order OK
 * - Collapse when: price < shortMA × (1 - margin) OR MA order broken
 */

import { normalizeCandles } from "../core/normalize";
import { sma } from "../indicators/moving-average/sma";
import { ema } from "../indicators/moving-average/ema";
import { wma } from "../indicators/moving-average/wma";
import { getPrice } from "../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../types";

/**
 * Perfect order type (legacy)
 */
export type PerfectOrderType = "bullish" | "bearish" | "none";

/**
 * Slope direction for MA trend analysis
 */
export type SlopeDirection = "UP" | "DOWN" | "FLAT";

/**
 * Enhanced perfect order state (7 states)
 */
export type PerfectOrderState =
  | "BULLISH_PO"      // Confirmed bullish perfect order
  | "BEARISH_PO"      // Confirmed bearish perfect order
  | "COLLAPSED"       // MA convergence (energy accumulation)
  | "PRE_BULLISH_PO"  // Forming bullish (not yet confirmed)
  | "PRE_BEARISH_PO"  // Forming bearish (not yet confirmed)
  | "PO_BREAKDOWN"    // Perfect order breaking down
  | "NEUTRAL_MIXED";  // No clear pattern

/**
 * Perfect order result for each candle
 */
export type PerfectOrderValue = {
  /** Current perfect order state */
  type: PerfectOrderType;
  /** True when perfect order just formed on this candle */
  formed: boolean;
  /** True when perfect order just collapsed on this candle */
  collapsed: boolean;
  /** Trend strength score (0-100, 0 when type is 'none') */
  strength: number;
  /** MA values in order (short to long) */
  maValues: (number | null)[];
};

/**
 * Enhanced perfect order result with additional fields
 */
export type PerfectOrderValueEnhanced = PerfectOrderValue & {
  /** Enhanced state (7 states) */
  state: PerfectOrderState;
  /** Confidence score (0-1) */
  confidence: number;
  /** Slope direction for each MA (short to long) */
  slopes: SlopeDirection[];
  /** Number of consecutive bars in current state */
  persistCount: number;
  /** True when persistCount >= persistBars */
  isConfirmed: boolean;
  /** True when state just became confirmed */
  confirmationFormed: boolean;
  /** True when PO_BREAKDOWN just detected */
  breakdownDetected: boolean;
  /** True when COLLAPSED just detected */
  collapseDetected: boolean;
};

/** Default hysteresis margin (1%) */
const DEFAULT_HYSTERESIS_MARGIN = 0.01;

/**
 * Options for perfect order detection
 */
export type PerfectOrderOptions = {
  /** MA periods (default: [5, 25, 75] - Japanese stock standard) */
  periods?: number[];
  /** MA type (default: 'sma') */
  maType?: "sma" | "ema" | "wma";
  /** Price source (default: 'close') */
  source?: PriceSource;
  /** Hysteresis margin for price position check (default: 0.01 = 1%) */
  hysteresisMargin?: number;
};

/**
 * Enhanced options for perfect order detection
 */
export type PerfectOrderOptionsEnhanced = PerfectOrderOptions & {
  /** Enable enhanced mode with slope/persistence/collapse detection (default: false) */
  enhanced: true;
  /** Lookback period for slope calculation (default: 3) */
  slopeLookback?: number;
  /** Number of consecutive bars required for confirmation (default: 3) */
  persistBars?: number;
  /** Threshold for MA convergence detection as ratio (default: 0.003 = 0.3%) */
  collapseEps?: number;
  /** Threshold for flat slope detection as ratio per bar (default: 0.001 = 0.1%) */
  flatEps?: number;
};

/**
 * Detect Perfect Order alignment of multiple moving averages
 *
 * Perfect Order occurs when MAs are aligned in order AND price is positioned correctly:
 * - Bullish: Price > Short MA > Medium MA > Long MA (uptrend)
 * - Bearish: Price < Short MA < Medium MA < Long MA (downtrend)
 *
 * Uses hysteresis (1% default margin) to prevent noise from price crossing the short MA:
 * - Formation: price must be above/below shortMA (strict)
 * - Continuation: price can be within margin of shortMA (relaxed)
 * - Collapse: price falls below/above margin OR MA order breaks
 *
 * The strength score (0-100) reflects how "ideal" the perfect order is:
 * - MA spread: wider spread = stronger trend
 * - MA uniformity: evenly spaced MAs = healthier trend
 * - Price position: price deviation from short MA adds bonus points
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Perfect order options
 * @returns Series of perfect order values with formation/collapse signals
 *
 * @example
 * ```ts
 * // Default: 5, 25, 75 SMA (Japanese stock standard)
 * const po = perfectOrder(candles);
 *
 * // Custom periods with EMA
 * const po4 = perfectOrder(candles, {
 *   periods: [10, 20, 50, 200],
 *   maType: 'ema'
 * });
 *
 * // Find strong formation signals
 * const strongFormations = po.filter(p => p.value.formed && p.value.strength >= 50);
 * ```
 */
export function perfectOrder(
  candles: Candle[] | NormalizedCandle[],
  options: PerfectOrderOptions = {}
): Series<PerfectOrderValue> {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    source = "close",
    hysteresisMargin = DEFAULT_HYSTERESIS_MARGIN,
  } = options;

  // Sort and dedupe periods
  const sortedPeriods = [...new Set(periods)].sort((a, b) => a - b);

  if (sortedPeriods.length < 2) {
    throw new Error("At least 2 different periods are required");
  }

  if (sortedPeriods.some((p) => p < 1)) {
    throw new Error("All periods must be positive integers");
  }

  if (candles.length === 0) {
    return [];
  }

  // Normalize candles
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Calculate all MAs
  const maFn = getMaFunction(maType);
  const maSeries = sortedPeriods.map((period) => maFn(normalized, { period, source }));

  // Build result
  const result: Series<PerfectOrderValue> = [];
  let prevType: PerfectOrderType = "none";

  for (let i = 0; i < normalized.length; i++) {
    const time = normalized[i].time;
    const price = getPrice(normalized[i], source);
    const maValues = maSeries.map((series) => series[i].value);

    // Determine perfect order type with hysteresis
    // - Formation: strict price check (price > shortMA for bullish)
    // - Continuation: relaxed price check (price > shortMA × (1 - margin))
    const type = determinePerfectOrderTypeWithHysteresis(
      maValues,
      price,
      prevType,
      hysteresisMargin
    );

    // Detect formation and collapse
    const formed = prevType === "none" && type !== "none";
    const collapsed = prevType !== "none" && type === "none";

    // Calculate strength (includes price deviation)
    const strength = type !== "none" ? calculateStrength(maValues, type, price) : 0;

    result.push({
      time,
      value: {
        type,
        formed,
        collapsed,
        strength,
        maValues,
      },
    });

    prevType = type;
  }

  return result;
}

/**
 * Get the appropriate MA function based on type
 */
function getMaFunction(
  maType: "sma" | "ema" | "wma"
): (candles: NormalizedCandle[], options: { period: number; source: PriceSource }) => Series<number | null> {
  switch (maType) {
    case "ema":
      return ema;
    case "wma":
      return wma;
    default:
      return sma;
  }
}

/**
 * Check if MAs are in bullish order (short > medium > long)
 */
function isMaOrderBullish(maValues: number[]): boolean {
  for (let i = 0; i < maValues.length - 1; i++) {
    if (maValues[i] <= maValues[i + 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Check if MAs are in bearish order (short < medium < long)
 */
function isMaOrderBearish(maValues: number[]): boolean {
  for (let i = 0; i < maValues.length - 1; i++) {
    if (maValues[i] >= maValues[i + 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Determine perfect order type with hysteresis
 *
 * Standard Perfect Order definition (Japanese stock trading):
 * - Bullish: Price > Short MA > Medium MA > Long MA
 * - Bearish: Price < Short MA < Medium MA < Long MA
 *
 * Hysteresis prevents noise from price crossing the short MA:
 * - Formation (from none): price must strictly cross the threshold
 * - Continuation (already in state): price can be within margin
 *
 * @param maValues - MA values in order (short to long)
 * @param price - Current price
 * @param prevType - Previous perfect order type
 * @param margin - Hysteresis margin (default 1%)
 */
function determinePerfectOrderTypeWithHysteresis(
  maValues: (number | null)[],
  price: number,
  prevType: PerfectOrderType,
  margin: number
): PerfectOrderType {
  // Check for null values
  if (maValues.some((v) => v === null)) {
    return "none";
  }

  const values = maValues as number[];
  const shortestMa = values[0];

  // Check MA order first
  const bullishMaOrder = isMaOrderBullish(values);
  const bearishMaOrder = isMaOrderBearish(values);

  // If MA order is not valid, return none
  if (!bullishMaOrder && !bearishMaOrder) {
    return "none";
  }

  // Price thresholds with hysteresis
  // For bullish: price > shortMA (formation), price > shortMA × (1 - margin) (continuation)
  // For bearish: price < shortMA (formation), price < shortMA × (1 + margin) (continuation)
  const bullishFormationThreshold = shortestMa;
  const bullishContinuationThreshold = shortestMa * (1 - margin);
  const bearishFormationThreshold = shortestMa;
  const bearishContinuationThreshold = shortestMa * (1 + margin);

  // Check bullish perfect order
  if (bullishMaOrder) {
    if (prevType === "bullish") {
      // Continuation: relaxed threshold
      if (price > bullishContinuationThreshold) {
        return "bullish";
      }
    } else {
      // Formation: strict threshold
      if (price > bullishFormationThreshold) {
        return "bullish";
      }
    }
  }

  // Check bearish perfect order
  if (bearishMaOrder) {
    if (prevType === "bearish") {
      // Continuation: relaxed threshold
      if (price < bearishContinuationThreshold) {
        return "bearish";
      }
    } else {
      // Formation: strict threshold
      if (price < bearishFormationThreshold) {
        return "bearish";
      }
    }
  }

  return "none";
}

/**
 * Calculate strength score (0-100) based on MA spread and price deviation
 *
 * Factors considered:
 * 1. Total spread between shortest and longest MA (as % of price) - 0-35 points
 * 2. Uniformity of spacing between MAs - 0-35 points
 * 3. Price deviation from shortest MA - 0-30 points (only if price is on correct side)
 *
 * For bullish: price > shortMA gives bonus points
 * For bearish: price < shortMA gives bonus points
 * If price is on wrong side, deviation score is 0 (weaker signal)
 */
function calculateStrength(maValues: (number | null)[], type: PerfectOrderType, price: number): number {
  const values = maValues as number[];

  if (values.length < 2) {
    return 0;
  }

  // Calculate total spread as percentage of the longest MA (most stable reference)
  const longestMa = values[values.length - 1];
  const shortestMa = values[0];
  const totalSpreadPercent = Math.abs((shortestMa - longestMa) / longestMa) * 100;

  // Calculate individual spreads between adjacent MAs
  const spreads: number[] = [];
  for (let i = 0; i < values.length - 1; i++) {
    const spread = Math.abs(values[i] - values[i + 1]);
    spreads.push(spread);
  }

  // Calculate uniformity: how evenly spaced are the MAs?
  // Perfect uniformity = 1.0, poor uniformity approaches 0
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const spreadVariance = spreads.reduce((sum, s) => sum + Math.pow(s - avgSpread, 2), 0) / spreads.length;
  const spreadStdDev = Math.sqrt(spreadVariance);
  const uniformityScore = avgSpread > 0 ? Math.max(0, 1 - spreadStdDev / avgSpread) : 0;

  // Calculate price deviation score (conditional on price being on correct side)
  // Bullish: price > shortMA gives bonus, otherwise 0
  // Bearish: price < shortMA gives bonus, otherwise 0
  let deviationScore = 0;
  if (type === "bullish" && price > shortestMa) {
    const deviationPercent = ((price - shortestMa) / shortestMa) * 100;
    deviationScore = Math.min(30, deviationPercent * 15);
  } else if (type === "bearish" && price < shortestMa) {
    const deviationPercent = ((shortestMa - price) / shortestMa) * 100;
    deviationScore = Math.min(30, deviationPercent * 15);
  }
  // If price is on wrong side (e.g., bullish but price < shortMA), deviationScore stays 0

  // Spread score: 0-35 points based on total spread
  // 2% spread = 35 points, scales linearly, capped at 35
  const spreadScore = Math.min(35, totalSpreadPercent * 17.5);

  // Uniformity score: 0-35 points
  const uniformityPoints = uniformityScore * 35;

  // Total score
  const totalScore = Math.round(spreadScore + uniformityPoints + deviationScore);

  return Math.min(100, Math.max(0, totalScore));
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}

// ============================================================================
// Enhanced Mode Functions
// ============================================================================

/** Default values for enhanced options */
const ENHANCED_DEFAULTS = {
  slopeLookback: 3,
  persistBars: 3,
  collapseEps: 0.003,  // 0.3%
  flatEps: 0.001,      // 0.1% per bar
};

/**
 * Calculate slope direction of a series at a given index
 *
 * @param series - Array of values (may contain nulls)
 * @param t - Current index
 * @param lookback - Number of bars to look back
 * @param flatEps - Threshold for flat detection (relative change per bar)
 * @returns Slope direction: UP, DOWN, or FLAT
 */
function slopeSign(
  series: (number | null)[],
  t: number,
  lookback: number,
  flatEps: number
): SlopeDirection {
  if (t < lookback) return "FLAT";

  const current = series[t];
  const past = series[t - lookback];

  if (current === null || past === null || past === 0) return "FLAT";

  // Calculate relative change per bar
  const relativeChangePerBar = (current - past) / past / lookback;

  if (relativeChangePerBar > flatEps) return "UP";
  if (relativeChangePerBar < -flatEps) return "DOWN";
  return "FLAT";
}

/**
 * Check if MAs are collapsed (converged within threshold)
 *
 * @param maValues - MA values (short to long)
 * @param collapseEps - Convergence threshold as ratio
 * @returns True if all MAs are within collapseEps of each other
 */
function isCollapsed(
  maValues: (number | null)[],
  collapseEps: number
): boolean {
  const values = maValues.filter((v): v is number => v !== null);
  if (values.length < 2) return false;

  // Use longest MA as reference (most stable)
  const reference = values[values.length - 1];
  if (reference === 0) return false;

  const max = Math.max(...values);
  const min = Math.min(...values);

  return (max - min) / reference < collapseEps;
}

/**
 * Map enhanced state to legacy type
 */
function stateToLegacyType(state: PerfectOrderState): PerfectOrderType {
  switch (state) {
    case "BULLISH_PO":
    case "PRE_BULLISH_PO":
      return "bullish";
    case "BEARISH_PO":
    case "PRE_BEARISH_PO":
      return "bearish";
    default:
      return "none";
  }
}

/**
 * Determine enhanced state based on MA order, slopes, price position, and persistence
 */
function determineEnhancedState(
  maValues: (number | null)[],
  price: number,
  prevState: PerfectOrderState,
  slopes: SlopeDirection[],
  options: {
    collapseEps: number;
    hysteresisMargin: number;
  }
): { state: PerfectOrderState; confidence: number } {
  // 1. Check for null values
  if (maValues.some((v) => v === null)) {
    return { state: "NEUTRAL_MIXED", confidence: 0.3 };
  }

  const values = maValues as number[];
  const shortestMa = values[0];

  // 2. Check for collapsed state first (highest priority)
  if (isCollapsed(maValues, options.collapseEps)) {
    return { state: "COLLAPSED", confidence: 0.5 };
  }

  // 3. Check MA order
  const bullishOrder = isMaOrderBullish(values);
  const bearishOrder = isMaOrderBearish(values);

  // 4. Check slope alignment
  const allSlopesUp = slopes.every((s) => s === "UP");
  const allSlopesDown = slopes.every((s) => s === "DOWN");
  const anySlopeFlat = slopes.some((s) => s === "FLAT");

  // 5. Check price position with hysteresis
  const priceAboveShortMa = price > shortestMa;
  const priceBelowShortMa = price < shortestMa;
  const priceWithinBullishMargin = price > shortestMa * (1 - options.hysteresisMargin);
  const priceWithinBearishMargin = price < shortestMa * (1 + options.hysteresisMargin);

  // 6. Determine state

  // Bullish Perfect Order: order OK + all slopes UP + price above short MA
  if (bullishOrder && allSlopesUp && priceAboveShortMa) {
    return { state: "BULLISH_PO", confidence: 0.95 };
  }

  // Pre-bullish: order OK but slopes not all up OR price not strictly above
  if (bullishOrder) {
    const hasGoodSlopes = !anySlopeFlat && slopes.filter((s) => s === "UP").length >= slopes.length / 2;
    if (hasGoodSlopes || priceWithinBullishMargin) {
      return { state: "PRE_BULLISH_PO", confidence: 0.7 };
    }
  }

  // Bearish Perfect Order: order OK + all slopes DOWN + price below short MA
  if (bearishOrder && allSlopesDown && priceBelowShortMa) {
    return { state: "BEARISH_PO", confidence: 0.95 };
  }

  // Pre-bearish: order OK but slopes not all down OR price not strictly below
  if (bearishOrder) {
    const hasGoodSlopes = !anySlopeFlat && slopes.filter((s) => s === "DOWN").length >= slopes.length / 2;
    if (hasGoodSlopes || priceWithinBearishMargin) {
      return { state: "PRE_BEARISH_PO", confidence: 0.7 };
    }
  }

  // Breakdown: was in PO state but conditions degraded
  const wasBullish = prevState === "BULLISH_PO" || prevState === "PRE_BULLISH_PO";
  const wasBearish = prevState === "BEARISH_PO" || prevState === "PRE_BEARISH_PO";

  if (wasBullish && (!bullishOrder || anySlopeFlat)) {
    return { state: "PO_BREAKDOWN", confidence: 0.6 };
  }

  if (wasBearish && (!bearishOrder || anySlopeFlat)) {
    return { state: "PO_BREAKDOWN", confidence: 0.6 };
  }

  return { state: "NEUTRAL_MIXED", confidence: 0.5 };
}

/**
 * Detect Perfect Order with enhanced analysis (slope, persistence, collapse detection)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Enhanced perfect order options (must include enhanced: true)
 * @returns Series of enhanced perfect order values
 *
 * @example
 * ```ts
 * const po = perfectOrder(candles, {
 *   enhanced: true,
 *   periods: [5, 25, 75],
 *   slopeLookback: 3,
 *   persistBars: 3
 * });
 *
 * // Find confirmed bullish signals
 * const confirmed = po.filter(p => p.value.state === "BULLISH_PO" && p.value.isConfirmed);
 *
 * // Find collapse events (MA convergence)
 * const collapses = po.filter(p => p.value.collapseDetected);
 * ```
 */
export function perfectOrderEnhanced(
  candles: Candle[] | NormalizedCandle[],
  options: PerfectOrderOptionsEnhanced
): Series<PerfectOrderValueEnhanced> {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    source = "close",
    hysteresisMargin = DEFAULT_HYSTERESIS_MARGIN,
    slopeLookback = ENHANCED_DEFAULTS.slopeLookback,
    persistBars = ENHANCED_DEFAULTS.persistBars,
    collapseEps = ENHANCED_DEFAULTS.collapseEps,
    flatEps = ENHANCED_DEFAULTS.flatEps,
  } = options;

  // Sort and dedupe periods
  const sortedPeriods = [...new Set(periods)].sort((a, b) => a - b);

  if (sortedPeriods.length < 2) {
    throw new Error("At least 2 different periods are required");
  }

  if (sortedPeriods.some((p) => p < 1)) {
    throw new Error("All periods must be positive integers");
  }

  if (candles.length === 0) {
    return [];
  }

  // Normalize candles
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Calculate all MAs
  const maFn = getMaFunction(maType);
  const maSeries = sortedPeriods.map((period) => maFn(normalized, { period, source }));

  // Extract value arrays for slope calculation
  const maValueArrays = maSeries.map((series) => series.map((s) => s.value));

  // Build result
  const result: Series<PerfectOrderValueEnhanced> = [];
  let prevState: PerfectOrderState = "NEUTRAL_MIXED";
  let prevLegacyType: PerfectOrderType = "none";
  let persistCount = 0;
  // Track if we've seen a confirmed PO state since the last breakdown
  // This prevents PO+ from firing multiple times without an intervening breakdown
  let hasConfirmedBullishSinceLastBreakdown = false;
  let hasConfirmedBearishSinceLastBreakdown = false;

  for (let i = 0; i < normalized.length; i++) {
    const time = normalized[i].time;
    const price = getPrice(normalized[i], source);
    const maValues = maSeries.map((series) => series[i].value);

    // Calculate slopes for each MA
    const slopes: SlopeDirection[] = maValueArrays.map((arr) =>
      slopeSign(arr, i, slopeLookback, flatEps)
    );

    // Determine enhanced state
    const { state, confidence } = determineEnhancedState(
      maValues,
      price,
      prevState,
      slopes,
      { collapseEps, hysteresisMargin }
    );

    // Track persistence
    if (state === prevState) {
      persistCount++;
    } else {
      persistCount = 1;
    }

    // Calculate confirmation status
    const isConfirmed = persistCount >= persistBars;

    // Current confirmed PO status
    const isBullishPOConfirmed = state === "BULLISH_PO" && isConfirmed;
    const isBearishPOConfirmed = state === "BEARISH_PO" && isConfirmed;

    // Detect breakdown first (before updating confirmation tracking)
    // breakdownDetected: fires when transitioning TO breakdown AND we had a confirmed PO
    const breakdownDetected = state === "PO_BREAKDOWN" && (hasConfirmedBullishSinceLastBreakdown || hasConfirmedBearishSinceLastBreakdown);

    // Reset confirmation tracking on breakdown
    if (breakdownDetected) {
      hasConfirmedBullishSinceLastBreakdown = false;
      hasConfirmedBearishSinceLastBreakdown = false;
    }

    // confirmationFormed: fires when we become confirmed AND haven't been confirmed since last breakdown
    // This ensures PO+ only fires once per "cycle" (from breakdown to breakdown)
    const confirmationFormed =
      (isBullishPOConfirmed && !hasConfirmedBullishSinceLastBreakdown) ||
      (isBearishPOConfirmed && !hasConfirmedBearishSinceLastBreakdown);

    // Update confirmation tracking after determining confirmationFormed
    if (isBullishPOConfirmed) {
      hasConfirmedBullishSinceLastBreakdown = true;
    }
    if (isBearishPOConfirmed) {
      hasConfirmedBearishSinceLastBreakdown = true;
    }

    const collapseDetected = state === "COLLAPSED" && prevState !== "COLLAPSED";

    // Map to legacy type
    const type = stateToLegacyType(state);

    // Legacy formed/collapsed detection
    const formed = prevLegacyType === "none" && type !== "none";
    const collapsed = prevLegacyType !== "none" && type === "none";

    // Calculate strength (includes price deviation)
    const strength = type !== "none" ? calculateStrength(maValues, type, price) : 0;

    result.push({
      time,
      value: {
        // Legacy fields
        type,
        formed,
        collapsed,
        strength,
        maValues,
        // Enhanced fields
        state,
        confidence,
        slopes,
        persistCount,
        isConfirmed,
        confirmationFormed,
        breakdownDetected,
        collapseDetected,
      },
    });

    // Update tracking state for next iteration
    prevState = state;
    prevLegacyType = type;
  }

  return result;
}
