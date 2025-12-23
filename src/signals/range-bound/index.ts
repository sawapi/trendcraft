/**
 * Range-Bound (Box Range) Market Detection
 *
 * Detects periods when the market is in a sideways consolidation phase,
 * also known as "box range" or "trading range" markets. These are periods
 * when price oscillates between support and resistance levels without
 * establishing a clear trend.
 *
 * ## Detection Algorithm
 *
 * Uses multiple indicators combined into a weighted composite score:
 *
 * | Indicator | Weight | Purpose |
 * |-----------|--------|---------|
 * | ADX | 50% | Primary trend strength (low = range) |
 * | Bollinger Bandwidth | 20% | Volatility measure (narrow = range) |
 * | Donchian Width | 20% | Price range (narrow = range) |
 * | ATR Ratio | 10% | Historical volatility comparison |
 *
 * ## Trend Detection
 *
 * In addition to ADX, the algorithm detects trends via:
 * - **Price Movement**: 5%+ price change in 20 bars → TRENDING
 * - **DI Difference**: +DI/-DI gap ≥ 10 → directional trend
 * - **Regression Slope**: Price slope ≥ 0.15 ATR → TRENDING
 * - **HH/LL Pattern**: 3+ consecutive higher highs or lower lows → TRENDING
 *
 * ## States
 *
 * - `NEUTRAL`: Insufficient data or mixed signals
 * - `RANGE_FORMING`: Range conditions detected, awaiting confirmation
 * - `RANGE_CONFIRMED`: Range persisted for `persistBars` (default: 3)
 * - `RANGE_TIGHT`: Very tight range with high confidence
 * - `BREAKOUT_RISK_UP`: Price near upper boundary
 * - `BREAKOUT_RISK_DOWN`: Price near lower boundary
 * - `TRENDING`: Market has clear directional movement
 *
 * ## Usage
 *
 * ```typescript
 * import { rangeBound } from 'trendcraft';
 *
 * const rb = rangeBound(candles);
 *
 * // Find confirmed ranges
 * const ranges = rb.filter(r =>
 *   r.value.state === 'RANGE_CONFIRMED' ||
 *   r.value.state === 'RANGE_TIGHT'
 * );
 *
 * // Check current state
 * const latest = rb[rb.length - 1];
 * if (latest.value.state === 'BREAKOUT_RISK_UP') {
 *   console.log('Watch for upside breakout!');
 * }
 *
 * // Debug trend detection
 * if (latest.value.trendReason === 'hhll') {
 *   console.log('Detected via consecutive higher highs/lows');
 * }
 * ```
 *
 * @module signals/range-bound
 */

import { normalizeCandles } from "../../core/normalize";
import { dmi } from "../../indicators/momentum/dmi";
import { bollingerBands } from "../../indicators/volatility/bollinger-bands";
import { donchianChannel } from "../../indicators/volatility/donchian-channel";
import { atr } from "../../indicators/volatility/atr";
import type { Candle, NormalizedCandle, Series } from "../../types";

import type { RangeBoundState, RangeBoundValue, RangeBoundOptions } from "./types";
import { DEFAULTS } from "./types";
import { calculateAdxScore, calculatePercentileScore, calculateRangeScore } from "./score-calculator";
import { calculateRegressionSlope, countConsecutiveHHLL, hasDirectionalTrend } from "./trend-detector";
import { determineState } from "./state-machine";

// Re-export types for backward compatibility
export type { RangeBoundState, TrendReason, RangeBoundValue, RangeBoundOptions } from "./types";

/**
 * Detect range-bound (box range) market conditions
 *
 * Combines multiple indicators to identify when the market is in a
 * consolidation phase with low volatility and weak trend.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options
 * @returns Series of range-bound values
 *
 * @example
 * ```ts
 * const rb = rangeBound(candles);
 *
 * // Find confirmed range periods
 * const ranges = rb.filter(r =>
 *   r.value.state === "RANGE_CONFIRMED" ||
 *   r.value.state === "RANGE_TIGHT"
 * );
 *
 * // Find breakout risk moments
 * const risks = rb.filter(r => r.value.breakoutRiskDetected);
 * ```
 */
export function rangeBound(
  candles: Candle[] | NormalizedCandle[],
  options: RangeBoundOptions = {}
): Series<RangeBoundValue> {
  const opts = { ...DEFAULTS, ...options };

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Calculate all required indicators
  const dmiData = dmi(normalized, {
    period: opts.dmiPeriod,
    adxPeriod: opts.dmiPeriod,
  });

  const bbData = bollingerBands(normalized, {
    period: opts.bbPeriod,
    stdDev: 2,
  });

  const donchianData = donchianChannel(normalized, {
    period: opts.donchianPeriod,
  });

  const atrData = atr(normalized, {
    period: opts.atrPeriod,
  });

  // Build history arrays for percentile calculations
  const bandwidthHistory: number[] = [];
  const donchianWidthHistory: number[] = [];
  const atrRatioHistory: number[] = [];

  // Price arrays for trend directionality detection
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];

  // Build result
  const result: Series<RangeBoundValue> = [];
  let prevState: RangeBoundState = "NEUTRAL";
  let persistCount = 0;
  let prevWasConfirmed = false;
  let wasInRange = false;
  let wasBreakoutRisk = false;

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    const close = candle.close;

    // Update price arrays for trend directionality
    closes.push(candle.close);
    highs.push(candle.high);
    lows.push(candle.low);

    // Get raw indicator values
    const adx = dmiData[i]?.value.adx ?? null;
    const plusDI = dmiData[i]?.value.plusDi ?? null;
    const minusDI = dmiData[i]?.value.minusDi ?? null;
    const bbValue = bbData[i]?.value;
    const donchianValue = donchianData[i]?.value;
    const atrValue = atrData[i]?.value ?? null;

    // Calculate derived values
    const bandwidth =
      bbValue?.upper !== null &&
      bbValue?.lower !== null &&
      bbValue?.middle !== null &&
      bbValue?.middle !== 0
        ? (bbValue.upper - bbValue.lower) / bbValue.middle
        : null;

    const rangeHigh = donchianValue?.upper ?? null;
    const rangeLow = donchianValue?.lower ?? null;
    const donchianMid = donchianValue?.middle ?? null;

    const donchianWidth =
      rangeHigh !== null && rangeLow !== null && donchianMid !== null && donchianMid !== 0
        ? (rangeHigh - rangeLow) / donchianMid
        : null;

    const atrRatio = atrValue !== null && close !== 0 ? atrValue / close : null;

    // Update history arrays
    if (bandwidth !== null) bandwidthHistory.push(bandwidth);
    if (donchianWidth !== null) donchianWidthHistory.push(donchianWidth);
    if (atrRatio !== null) atrRatioHistory.push(atrRatio);

    // Calculate individual scores
    const adxScore = calculateAdxScore(adx, opts.adxThreshold, opts.adxTrendThreshold);
    const bandwidthScore = calculatePercentileScore(bandwidth, bandwidthHistory, opts.lookbackPeriod);
    const donchianScore = calculatePercentileScore(donchianWidth, donchianWidthHistory, opts.lookbackPeriod);
    const atrScore = calculatePercentileScore(atrRatio, atrRatioHistory, opts.lookbackPeriod);

    // Calculate composite range score
    const rangeScore = calculateRangeScore(
      adxScore,
      bandwidthScore,
      donchianScore,
      atrScore,
      opts
    );

    // Calculate price position within range
    const pricePosition =
      rangeHigh !== null && rangeLow !== null && rangeHigh !== rangeLow
        ? (close - rangeLow) / (rangeHigh - rangeLow)
        : null;

    // Calculate price movement over period (to detect "creeping" trends with low ADX)
    let priceMovement: number | null = null;
    if (i >= opts.priceMovementPeriod) {
      const pastClose = normalized[i - opts.priceMovementPeriod].close;
      if (pastClose !== 0) {
        priceMovement = Math.abs(close - pastClose) / pastClose;
      }
    }

    // Calculate trend directionality indicators
    const regressionSlope = calculateRegressionSlope(closes, opts.priceMovementPeriod);
    const { consecutiveHH, consecutiveLL } = countConsecutiveHHLL(highs, lows, i, opts.hhllLookback);

    // Check for directional trend (even with low ADX)
    const isDirectionalTrend = hasDirectionalTrend(
      plusDI,
      minusDI,
      regressionSlope,
      atrValue,
      consecutiveHH,
      consecutiveLL,
      {
        diDifferenceThreshold: opts.diDifferenceThreshold,
        slopeThreshold: opts.slopeThreshold,
        consecutiveHHLLThreshold: opts.consecutiveHHLLThreshold,
      }
    );

    // Determine state
    const { state, confidence, trendReason } = determineState(
      rangeScore,
      adx,
      pricePosition,
      priceMovement,
      isDirectionalTrend,
      prevState,
      opts
    );

    // Track persistence
    if (state === prevState) {
      persistCount++;
    } else {
      persistCount = 1;
    }

    const isConfirmed = persistCount >= opts.persistBars;

    // Detect events
    const isInRangeState =
      state === "RANGE_FORMING" ||
      state === "RANGE_CONFIRMED" ||
      state === "RANGE_TIGHT";

    const isBreakoutRiskState =
      state === "BREAKOUT_RISK_UP" || state === "BREAKOUT_RISK_DOWN";

    const rangeDetected = isInRangeState && !wasInRange;

    const rangeConfirmed =
      (state === "RANGE_CONFIRMED" || state === "RANGE_TIGHT") &&
      isConfirmed &&
      !prevWasConfirmed;

    const breakoutRiskDetected = isBreakoutRiskState && !wasBreakoutRisk;

    const rangeBroken =
      state === "TRENDING" &&
      (wasInRange || wasBreakoutRisk);

    // Push result
    result.push({
      time: candle.time,
      value: {
        state,
        rangeScore,
        confidence,
        persistCount,
        isConfirmed,
        rangeDetected,
        rangeConfirmed,
        breakoutRiskDetected,
        rangeBroken,
        adxScore,
        bandwidthScore,
        donchianScore,
        atrScore,
        adx,
        bandwidth,
        donchianWidth,
        atrRatio,
        rangeHigh,
        rangeLow,
        pricePosition,
        trendReason,
      },
    });

    // Update tracking state
    prevState = state;
    prevWasConfirmed = isConfirmed && (state === "RANGE_CONFIRMED" || state === "RANGE_TIGHT");
    wasInRange = isInRangeState;
    wasBreakoutRisk = isBreakoutRiskState;
  }

  return result;
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
