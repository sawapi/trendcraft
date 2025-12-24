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
export const DEFAULTS = {
  dmiPeriod: 14,
  bbPeriod: 20,
  donchianPeriod: 20,
  atrPeriod: 14,
  // ADX is the primary indicator for trend detection
  // Increased weight to prioritize ADX-based decisions
  adxWeight: 0.5,
  bandwidthWeight: 0.2,
  donchianWeight: 0.2,
  atrWeight: 0.1,
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
