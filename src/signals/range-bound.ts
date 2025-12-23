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

import { normalizeCandles, getPrice } from "../core/normalize";
import { dmi } from "../indicators/momentum/dmi";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import { donchianChannel } from "../indicators/volatility/donchian-channel";
import { atr } from "../indicators/volatility/atr";
import type { Candle, NormalizedCandle, Series } from "../types";

/**
 * Range-bound market state
 *
 * State machine transitions:
 * ```
 * NEUTRAL → RANGE_FORMING → RANGE_CONFIRMED ↔ RANGE_TIGHT
 *                ↓                ↓               ↓
 *          BREAKOUT_RISK_*  BREAKOUT_RISK_*  BREAKOUT_RISK_*
 *                ↓                ↓               ↓
 *             TRENDING ←──────────┴───────────────┘
 * ```
 *
 * @example
 * ```typescript
 * const isInRange = (state: RangeBoundState) =>
 *   state === 'RANGE_FORMING' ||
 *   state === 'RANGE_CONFIRMED' ||
 *   state === 'RANGE_TIGHT';
 * ```
 */
export type RangeBoundState =
  | "RANGE_FORMING" // Range conditions starting to appear
  | "RANGE_CONFIRMED" // Range confirmed after persist bars
  | "RANGE_TIGHT" // Very tight range (extreme low volatility)
  | "BREAKOUT_RISK_UP" // Price near upper bound, breakout risk
  | "BREAKOUT_RISK_DOWN" // Price near lower bound, breakout risk
  | "TRENDING" // Market is trending (not range-bound)
  | "NEUTRAL"; // Insufficient data or mixed signals

/**
 * Reason why the market is classified as TRENDING
 *
 * Used for debugging and understanding why range detection was rejected.
 * Each reason corresponds to a specific detection method:
 *
 * | Reason | Detection Method | Default Threshold |
 * |--------|-----------------|-------------------|
 * | `adx_high` | ADX value | ≥ 25 |
 * | `price_movement` | Price change over period | ≥ 5% in 20 bars |
 * | `di_diff` | +DI/-DI difference | ≥ 10 |
 * | `slope` | Linear regression slope | ≥ 0.15 × ATR |
 * | `hhll` | Consecutive HH or LL | ≥ 3 bars |
 * | `null` | Not trending | - |
 *
 * @example
 * ```typescript
 * const result = rangeBound(candles);
 * const trending = result.filter(r => r.value.state === 'TRENDING');
 *
 * // Analyze why each was marked as trending
 * for (const r of trending) {
 *   console.log(`${r.time}: TRENDING due to ${r.value.trendReason}`);
 * }
 * ```
 */
export type TrendReason =
  | "adx_high" // ADX >= adxTrendThreshold
  | "price_movement" // Price moved >= priceMovementThreshold in period
  | "di_diff" // +DI/-DI difference >= diDifferenceThreshold
  | "slope" // Linear regression slope >= slopeThreshold (ATR normalized)
  | "hhll" // Consecutive HH or LL >= consecutiveHHLLThreshold
  | null; // Not trending or no specific reason

/**
 * Range-bound detection result for each candle
 *
 * Contains the current state, scores, raw indicator values, and event flags.
 * Event flags (`rangeDetected`, `rangeConfirmed`, etc.) fire only once when
 * the condition first becomes true, making them ideal for triggering alerts.
 *
 * @example
 * ```typescript
 * const rb = rangeBound(candles);
 * const latest = rb[rb.length - 1].value;
 *
 * // Check state
 * console.log(`State: ${latest.state}`);
 * console.log(`Score: ${latest.rangeScore}/100`);
 * console.log(`Confidence: ${(latest.confidence * 100).toFixed(0)}%`);
 *
 * // Check range boundaries
 * if (latest.rangeHigh && latest.rangeLow) {
 *   console.log(`Range: ${latest.rangeLow} - ${latest.rangeHigh}`);
 *   console.log(`Position: ${(latest.pricePosition! * 100).toFixed(0)}%`);
 * }
 *
 * // React to events
 * if (latest.rangeConfirmed) {
 *   alert('New range confirmed!');
 * }
 * if (latest.rangeBroken) {
 *   alert('Range broken - trend starting!');
 * }
 * ```
 */
export type RangeBoundValue = {
  /** Current range-bound state */
  state: RangeBoundState;
  /** Composite range score (0-100, higher = more likely range-bound) */
  rangeScore: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Number of consecutive bars in current state */
  persistCount: number;
  /** True when persistCount >= persistBars */
  isConfirmed: boolean;

  // === Event flags (fire once) ===
  /** True when range conditions first detected */
  rangeDetected: boolean;
  /** True when range first confirmed */
  rangeConfirmed: boolean;
  /** True when breakout risk first detected */
  breakoutRiskDetected: boolean;
  /** True when transitioning from range to trending */
  rangeBroken: boolean;

  // === Individual indicator scores (0-100) ===
  /** ADX-based score (low ADX = high score) */
  adxScore: number;
  /** Bandwidth percentile score (narrow = high score) */
  bandwidthScore: number;
  /** Donchian width percentile score (narrow = high score) */
  donchianScore: number;
  /** ATR ratio percentile score (low = high score) */
  atrScore: number;

  // === Raw indicator values ===
  /** ADX value */
  adx: number | null;
  /** Bollinger Bands bandwidth */
  bandwidth: number | null;
  /** Donchian channel width as ratio of mid price */
  donchianWidth: number | null;
  /** ATR as ratio of close price */
  atrRatio: number | null;

  // === Range boundaries ===
  /** Upper range boundary (Donchian high) */
  rangeHigh: number | null;
  /** Lower range boundary (Donchian low) */
  rangeLow: number | null;
  /** Price position within range (0 = low, 1 = high) */
  pricePosition: number | null;

  // === Debug info ===
  /** Reason for TRENDING state (null if not trending) */
  trendReason: TrendReason;
};

/**
 * Options for range-bound detection
 *
 * All options have sensible defaults optimized for daily stock data.
 * Customize based on your instrument and timeframe.
 *
 * ## Tuning Guide
 *
 * ### For more sensitive detection (catch more ranges):
 * - Lower `rangeScoreThreshold` (e.g., 60)
 * - Lower `adxThreshold` (e.g., 15)
 * - Lower `persistBars` (e.g., 2)
 *
 * ### For stricter detection (fewer false positives):
 * - Higher `rangeScoreThreshold` (e.g., 80)
 * - Higher `adxTrendThreshold` (e.g., 30)
 * - Higher `persistBars` (e.g., 5)
 *
 * ### For crypto/forex (higher volatility):
 * - Higher `priceMovementThreshold` (e.g., 0.10)
 * - Higher `slopeThreshold` (e.g., 0.25)
 *
 * @example
 * ```typescript
 * // Stricter settings for swing trading
 * const rb = rangeBound(candles, {
 *   rangeScoreThreshold: 80,
 *   persistBars: 5,
 *   adxTrendThreshold: 30,
 * });
 *
 * // More sensitive for scalping
 * const rbSensitive = rangeBound(candles, {
 *   rangeScoreThreshold: 60,
 *   persistBars: 2,
 * });
 * ```
 */
export type RangeBoundOptions = {
  // === Indicator periods ===
  /** DMI/ADX period (default: 14) */
  dmiPeriod?: number;
  /** Bollinger Bands period (default: 20) */
  bbPeriod?: number;
  /** Donchian Channel period (default: 20) */
  donchianPeriod?: number;
  /** ATR period (default: 14) */
  atrPeriod?: number;

  // === Score weights (should sum to 1.0) ===
  /** ADX score weight (default: 0.50) */
  adxWeight?: number;
  /** Bandwidth score weight (default: 0.20) */
  bandwidthWeight?: number;
  /** Donchian score weight (default: 0.20) */
  donchianWeight?: number;
  /** ATR score weight (default: 0.10) */
  atrWeight?: number;

  // === Thresholds ===
  /** ADX below this = range (default: 20) */
  adxThreshold?: number;
  /** ADX above this = trending (default: 25) */
  adxTrendThreshold?: number;
  /** Composite score threshold for range detection (default: 70) */
  rangeScoreThreshold?: number;
  /** Composite score threshold for tight range (default: 85) */
  tightRangeThreshold?: number;
  /** Zone near range boundary for breakout risk (default: 0.1 = 10%) */
  breakoutRiskZone?: number;

  // === Confirmation ===
  /** Bars required for confirmation (default: 3) */
  persistBars?: number;

  // === Lookback ===
  /** Lookback period for percentile calculations (default: 100) */
  lookbackPeriod?: number;

  // === Price movement filter ===
  /** Period for calculating price movement (default: 20) */
  priceMovementPeriod?: number;
  /** Price movement threshold as ratio (default: 0.05 = 5%). If price moved more than this, not range-bound */
  priceMovementThreshold?: number;

  // === Trend directionality detection ===
  /** +DI/-DI difference threshold to detect directional trend (default: 10) */
  diDifferenceThreshold?: number;
  /** Linear regression slope threshold (ATR ratio, default: 0.15) */
  slopeThreshold?: number;
  /** Consecutive Higher Highs/Lower Lows count for trend detection (default: 3) */
  consecutiveHHLLThreshold?: number;
  /** Lookback period for HH/LL detection (default: 10) */
  hhllLookback?: number;
};

/** Default option values */
const DEFAULTS = {
  dmiPeriod: 14,
  bbPeriod: 20,
  donchianPeriod: 20,
  atrPeriod: 14,
  // ADX is the primary indicator for trend detection
  // Increased weight to prioritize ADX-based decisions
  adxWeight: 0.50,
  bandwidthWeight: 0.20,
  donchianWeight: 0.20,
  atrWeight: 0.10,
  // ADX < 20 = weak/no trend (range-bound likely)
  // Based on industry standard: ADX < 20-25 = sideways market
  adxThreshold: 20,
  // ADX > 25 = trend present (should not be considered range-bound)
  adxTrendThreshold: 25,
  // Higher threshold to reduce false positives
  rangeScoreThreshold: 70,
  tightRangeThreshold: 85,
  breakoutRiskZone: 0.1,
  persistBars: 3,
  lookbackPeriod: 100,
  // Price movement filter - if price moved more than 5% in 20 days, it's trending not ranging
  priceMovementPeriod: 20,
  priceMovementThreshold: 0.05,
  // Trend directionality detection
  diDifferenceThreshold: 10,
  slopeThreshold: 0.15,
  consecutiveHHLLThreshold: 3,
  hhllLookback: 10,
};

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
 * Calculate ADX-based score (0-100)
 * Low ADX = high score (more likely range-bound)
 */
function calculateAdxScore(
  adx: number | null,
  adxThreshold: number,
  adxTrendThreshold: number
): number {
  if (adx === null) return 50; // Neutral when no data

  if (adx <= adxThreshold) return 100;
  if (adx >= adxTrendThreshold) return 0;

  // Linear interpolation between thresholds
  return Math.round(100 * (adxTrendThreshold - adx) / (adxTrendThreshold - adxThreshold));
}

/**
 * Calculate percentile-based score (0-100)
 * Lower percentile = higher score (narrower = more likely range-bound)
 */
function calculatePercentileScore(
  currentValue: number | null,
  history: number[],
  lookback: number
): number {
  if (currentValue === null) return 50; // Neutral when no data

  // Get recent history
  const recentHistory = history.slice(-lookback);
  if (recentHistory.length < lookback * 0.3) return 50; // Need at least 30% of lookback

  // Calculate percentile rank (what % of values are below current)
  const sorted = [...recentHistory].sort((a, b) => a - b);
  const belowCount = sorted.filter((v) => v < currentValue).length;
  const percentile = (belowCount / sorted.length) * 100;

  // Invert: low percentile (narrow) = high score
  return Math.round(100 - percentile);
}

/**
 * Calculate composite range score
 */
function calculateRangeScore(
  adxScore: number,
  bandwidthScore: number,
  donchianScore: number,
  atrScore: number,
  opts: Required<RangeBoundOptions>
): number {
  const totalWeight = opts.adxWeight + opts.bandwidthWeight + opts.donchianWeight + opts.atrWeight;

  const score =
    (adxScore * opts.adxWeight +
      bandwidthScore * opts.bandwidthWeight +
      donchianScore * opts.donchianWeight +
      atrScore * opts.atrWeight) /
    totalWeight;

  return Math.round(score);
}

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
function determineState(
  rangeScore: number,
  adx: number | null,
  pricePosition: number | null,
  priceMovement: number | null,
  directionalTrendReason: TrendReason,
  prevState: RangeBoundState,
  opts: Required<RangeBoundOptions>
): { state: RangeBoundState; confidence: number; trendReason: TrendReason } {
  // 1. Check for insufficient data
  if (adx === null) {
    return { state: "NEUTRAL", confidence: 0.3, trendReason: null };
  }

  // 2. PRIMARY CHECK: ADX-based trend detection
  // If ADX is clearly above trend threshold, market is TRENDING - period.
  // This prevents false range detection during strong trends with temporarily low volatility.
  if (adx >= opts.adxTrendThreshold) {
    return { state: "TRENDING", confidence: Math.min(0.95, 0.7 + (adx - opts.adxTrendThreshold) * 0.01), trendReason: "adx_high" };
  }

  // 3. PRICE MOVEMENT CHECK: Detect "creeping" trends with low ADX
  // Even if ADX is low, significant price movement indicates a trend
  if (priceMovement !== null && priceMovement >= opts.priceMovementThreshold) {
    return { state: "TRENDING", confidence: 0.75, trendReason: "price_movement" };
  }

  // 4. DIRECTIONAL TREND CHECK: Detect trends via DI difference, slope, or HH/LL patterns
  // This catches gradual trends that have low ADX and low price movement but clear directionality
  if (directionalTrendReason !== null) {
    return { state: "TRENDING", confidence: 0.70, trendReason: directionalTrendReason };
  }

  // 5. SECONDARY CHECK: ADX in transition zone (between adxThreshold and adxTrendThreshold)
  // Be more cautious - require higher composite score
  const isAdxInTransitionZone = adx > opts.adxThreshold && adx < opts.adxTrendThreshold;
  const effectiveRangeThreshold = isAdxInTransitionZone
    ? opts.rangeScoreThreshold + 10  // Require higher score when ADX is borderline
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
    const isAlreadyConfirmed =
      prevState === "RANGE_CONFIRMED" || prevState === "RANGE_TIGHT";

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

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}

/**
 * Calculate linear regression slope of a series
 * Returns the slope (per bar)
 *
 * Uses least squares method: slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
 *
 * Optimization: Uses index-based access instead of slice() to avoid array allocation.
 * Pre-computes Σx and Σx² since they only depend on n:
 *   Σx = n*(n-1)/2
 *   Σx² = n*(n-1)*(2n-1)/6
 */
function calculateRegressionSlope(values: number[], period: number): number | null {
  const len = values.length;
  if (len < period) return null;

  const startIdx = len - period;
  const n = period;

  // Pre-computed sums for x = 0, 1, 2, ..., n-1
  const sumX = (n * (n - 1)) / 2;
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

  let sumY = 0;
  let sumXY = 0;

  for (let i = 0; i < n; i++) {
    const y = values[startIdx + i];
    sumY += y;
    sumXY += i * y;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  return slope;
}

/**
 * Count consecutive Higher Highs and Lower Lows
 *
 * HH (Higher High): Current high > previous high
 * LL (Lower Low): Current low < previous low
 *
 * Returns the count of consecutive HH or LL patterns
 */
function countConsecutiveHHLL(
  highs: number[],
  lows: number[],
  idx: number,
  lookback: number
): { consecutiveHH: number; consecutiveLL: number } {
  let consecutiveHH = 0;
  let consecutiveLL = 0;

  // Start from current bar and go backwards
  const startIdx = Math.max(1, idx - lookback + 1);

  // Count consecutive HH from current bar backwards
  for (let i = idx; i >= startIdx; i--) {
    if (highs[i] > highs[i - 1]) {
      consecutiveHH++;
    } else {
      break;
    }
  }

  // Count consecutive LL from current bar backwards
  for (let i = idx; i >= startIdx; i--) {
    if (lows[i] < lows[i - 1]) {
      consecutiveLL++;
    } else {
      break;
    }
  }

  return { consecutiveHH, consecutiveLL };
}

/**
 * Check if there's a directional trend even with low ADX
 *
 * Returns TrendReason if any of the following conditions are met:
 * 1. DI difference is significant (+DI >> -DI or vice versa) -> 'di_diff'
 * 2. Price has a consistent slope (linear regression) -> 'slope'
 * 3. Consecutive Higher Highs or Lower Lows pattern -> 'hhll'
 *
 * Returns null if no directional trend detected
 */
function hasDirectionalTrend(
  plusDI: number | null,
  minusDI: number | null,
  regressionSlope: number | null,
  atr: number | null,
  consecutiveHH: number,
  consecutiveLL: number,
  opts: {
    diDifferenceThreshold: number;
    slopeThreshold: number;
    consecutiveHHLLThreshold: number;
  }
): TrendReason {
  // Condition 1: DI difference is significant
  if (plusDI !== null && minusDI !== null) {
    const diDiff = Math.abs(plusDI - minusDI);
    if (diDiff >= opts.diDifferenceThreshold) {
      return "di_diff";
    }
  }

  // Condition 2: Regression slope is significant (relative to ATR)
  if (regressionSlope !== null && atr !== null && atr > 0) {
    const normalizedSlope = Math.abs(regressionSlope) / atr;
    if (normalizedSlope >= opts.slopeThreshold) {
      return "slope";
    }
  }

  // Condition 3: Consecutive HH or LL pattern
  if (consecutiveHH >= opts.consecutiveHHLLThreshold) {
    return "hhll";
  }
  if (consecutiveLL >= opts.consecutiveHHLLThreshold) {
    return "hhll";
  }

  return null;
}
