import type { RangeBoundOptions, RangeBoundState, TrendReason } from "./types";

/**
 * Determine range-bound state based on score and indicators
 *
 * Key logic:
 * - ADX is the primary filter: if ADX > adxTrendThreshold, it's TRENDING regardless of other scores
 * - Price movement filter: if price moved significantly, it's TRENDING even with low ADX ("creeping trend")
 * - Directional trend filter: if DI difference, regression slope, or HH/LL pattern indicates trend, it's TRENDING
 * - Range detection requires BOTH low ADX AND high composite score AND low price movement AND no directional trend
 * - This prevents false positives where volatility indicators suggest range but price is clearly moving
 */
export function determineState(
  rangeScore: number,
  adx: number | null,
  pricePosition: number | null,
  priceMovement: number | null,
  directionalTrendReason: TrendReason,
  prevState: RangeBoundState,
  opts: Required<RangeBoundOptions>,
): { state: RangeBoundState; confidence: number; trendReason: TrendReason } {
  // 1. Check for insufficient data
  if (adx === null) {
    return { state: "NEUTRAL", confidence: 0.3, trendReason: null };
  }

  // 2. PRIMARY CHECK: ADX-based trend detection
  // If ADX is clearly above trend threshold, market is TRENDING - period.
  // This prevents false range detection during strong trends with temporarily low volatility.
  if (adx >= opts.adxTrendThreshold) {
    return {
      state: "TRENDING",
      confidence: Math.min(0.95, 0.7 + (adx - opts.adxTrendThreshold) * 0.01),
      trendReason: "adx_high",
    };
  }

  // 3. PRICE MOVEMENT CHECK: Detect "creeping" trends with low ADX
  // Even if ADX is low, significant price movement indicates a trend
  if (priceMovement !== null && priceMovement >= opts.priceMovementThreshold) {
    return { state: "TRENDING", confidence: 0.75, trendReason: "price_movement" };
  }

  // 4. DIRECTIONAL TREND CHECK: Detect trends via DI difference, slope, or HH/LL patterns
  // This catches gradual trends that have low ADX and low price movement but clear directionality
  if (directionalTrendReason !== null) {
    return { state: "TRENDING", confidence: 0.7, trendReason: directionalTrendReason };
  }

  // 5. SECONDARY CHECK: ADX in transition zone (between adxThreshold and adxTrendThreshold)
  // Be more cautious - require higher composite score
  const isAdxInTransitionZone = adx > opts.adxThreshold && adx < opts.adxTrendThreshold;
  const effectiveRangeThreshold = isAdxInTransitionZone
    ? opts.rangeScoreThreshold + 10 // Require higher score when ADX is borderline
    : opts.rangeScoreThreshold;

  // 6. Check for range conditions (ADX is low enough to consider range)
  if (rangeScore >= effectiveRangeThreshold && adx <= opts.adxThreshold) {
    // 6a. Tight range (very high score AND very low ADX)
    if (rangeScore >= opts.tightRangeThreshold && adx <= opts.adxThreshold - 5) {
      // Still check for breakout risk in tight range
      if (pricePosition !== null) {
        if (pricePosition >= 1 - opts.breakoutRiskZone) {
          return { state: "BREAKOUT_RISK_UP", confidence: 0.85, trendReason: null };
        }
        if (pricePosition <= opts.breakoutRiskZone) {
          return { state: "BREAKOUT_RISK_DOWN", confidence: 0.85, trendReason: null };
        }
      }
      return { state: "RANGE_TIGHT", confidence: 0.95, trendReason: null };
    }

    // 6b. Check for breakout risk (price near boundaries)
    if (pricePosition !== null) {
      if (pricePosition >= 1 - opts.breakoutRiskZone) {
        return { state: "BREAKOUT_RISK_UP", confidence: 0.8, trendReason: null };
      }
      if (pricePosition <= opts.breakoutRiskZone) {
        return { state: "BREAKOUT_RISK_DOWN", confidence: 0.8, trendReason: null };
      }
    }

    // 6c. Normal range state
    const isAlreadyConfirmed = prevState === "RANGE_CONFIRMED" || prevState === "RANGE_TIGHT";

    if (isAlreadyConfirmed) {
      return { state: "RANGE_CONFIRMED", confidence: 0.85, trendReason: null };
    }

    return { state: "RANGE_FORMING", confidence: 0.7, trendReason: null };
  }

  // 7. Transitioning out of range
  const wasInRange =
    prevState === "RANGE_FORMING" ||
    prevState === "RANGE_CONFIRMED" ||
    prevState === "RANGE_TIGHT" ||
    prevState === "BREAKOUT_RISK_UP" ||
    prevState === "BREAKOUT_RISK_DOWN";

  if (wasInRange && adx >= opts.adxThreshold) {
    return { state: "TRENDING", confidence: 0.75, trendReason: "adx_high" };
  }

  // 8. Neutral/mixed state (ADX in transition zone or score not high enough)
  return { state: "NEUTRAL", confidence: 0.5, trendReason: null };
}
