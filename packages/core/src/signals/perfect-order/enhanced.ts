import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import type {
  PerfectOrderOptionsEnhanced,
  PerfectOrderState,
  PerfectOrderType,
  PerfectOrderValueEnhanced,
  SlopeDirection,
} from "./types";
import { DEFAULT_HYSTERESIS_MARGIN, ENHANCED_DEFAULTS } from "./types";
import {
  calculateStrength,
  getMaFunction,
  isCollapsed,
  isMaOrderBearish,
  isMaOrderBullish,
  slopeSign,
  stateToLegacyType,
} from "./utils";

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
  },
): { state: PerfectOrderState; confidence: number } {
  // 1. Check for null values
  if (maValues.some((v) => v === null)) {
    return { state: "NEUTRAL_MIXED", confidence: 0.3 };
  }

  const values = maValues.filter((v): v is number => v !== null);
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
    const hasGoodSlopes =
      !anySlopeFlat && slopes.filter((s) => s === "UP").length >= slopes.length / 2;
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
    const hasGoodSlopes =
      !anySlopeFlat && slopes.filter((s) => s === "DOWN").length >= slopes.length / 2;
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
 * const po = perfectOrderEnhanced(candles, {
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
  options: PerfectOrderOptionsEnhanced,
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
  // Track pullback buy signal state
  // Once PB fires, it won't fire again until slope goes UP → DOWN (new pullback cycle)
  let hasPullbackBuyFiredBullish = false;
  let hasPullbackBuyFiredBearish = false;
  let prevShortSlope: SlopeDirection = "FLAT";

  for (let i = 0; i < normalized.length; i++) {
    const time = normalized[i].time;
    const price = getPrice(normalized[i], source);
    const maValues = maSeries.map((series) => series[i].value);

    // Calculate slopes for each MA
    const slopes: SlopeDirection[] = maValueArrays.map((arr) =>
      slopeSign(arr, i, slopeLookback, flatEps),
    );

    // Determine enhanced state
    const { state, confidence } = determineEnhancedState(maValues, price, prevState, slopes, {
      collapseEps,
      hysteresisMargin,
    });

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
    const breakdownDetected =
      state === "PO_BREAKDOWN" &&
      (hasConfirmedBullishSinceLastBreakdown || hasConfirmedBearishSinceLastBreakdown);

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

    // Current short MA slope
    const currentShortSlope = slopes[0];

    // Reset PB tracking when slope transitions from UP to DOWN (new pullback cycle starts)
    if (prevShortSlope === "UP" && currentShortSlope === "DOWN") {
      hasPullbackBuyFiredBullish = false;
    }
    // Similar for bearish (short selling pullback)
    if (prevShortSlope === "DOWN" && currentShortSlope === "UP") {
      hasPullbackBuyFiredBearish = false;
    }

    // Calculate gap between short MA and mid MA for pullback validation
    const shortMa = maValues[0];
    const midMa = maValues[1];
    const gapPercent =
      shortMa !== null && midMa !== null && midMa !== 0 ? ((shortMa - midMa) / midMa) * 100 : 0;

    // Pullback buy signal detection (bullish)
    // Conditions:
    // 1. PO+ has been confirmed since last breakdown
    // 2. Short slope transitions from DOWN to UP (or FLAT in between)
    // 3. Gap between short and mid MA is sufficient (not touching)
    // 4. PB hasn't fired yet in this pullback cycle
    let pullbackBuySignal = false;

    // Check for DOWN → UP transition (allowing FLAT in between by looking back)
    const hadRecentDownSlope =
      i > 0 &&
      (prevShortSlope === "DOWN" ||
        (i > 1 && result[i - 2]?.value.slopes[0] === "DOWN") ||
        (i > 2 && result[i - 3]?.value.slopes[0] === "DOWN") ||
        (i > 3 && result[i - 4]?.value.slopes[0] === "DOWN") ||
        (i > 4 && result[i - 5]?.value.slopes[0] === "DOWN"));

    if (
      hasConfirmedBullishSinceLastBreakdown &&
      !hasPullbackBuyFiredBullish &&
      currentShortSlope === "UP" &&
      hadRecentDownSlope &&
      type === "bullish" &&
      gapPercent >= 0.5 // Min 0.5% gap
    ) {
      pullbackBuySignal = true;
      hasPullbackBuyFiredBullish = true;
    }

    // Reset PB tracking on breakdown
    if (breakdownDetected) {
      hasPullbackBuyFiredBullish = false;
      hasPullbackBuyFiredBearish = false;
    }

    // Continuous state flag
    const hasConfirmedSinceBreakdown =
      hasConfirmedBullishSinceLastBreakdown || hasConfirmedBearishSinceLastBreakdown;

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
        // New continuous state flags
        hasConfirmedSinceBreakdown,
        pullbackBuySignal,
      },
    });

    // Update tracking state for next iteration
    prevState = state;
    prevLegacyType = type;
    prevShortSlope = currentShortSlope;
  }

  return result;
}
