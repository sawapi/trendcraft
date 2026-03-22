/**
 * Candlestick Pattern Recognition Types
 */

/**
 * All recognized candlestick pattern names
 */
export type CandlestickPatternName =
  // Single candle patterns
  | "hammer"
  | "inverted_hammer"
  | "shooting_star"
  | "hanging_man"
  | "doji"
  | "bullish_marubozu"
  | "bearish_marubozu"
  | "spinning_top"
  // Double candle patterns
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "bullish_harami"
  | "bearish_harami"
  | "tweezer_top"
  | "tweezer_bottom"
  | "piercing_line"
  | "dark_cloud_cover"
  // Triple candle patterns
  | "morning_star"
  | "evening_star"
  | "three_white_soldiers"
  | "three_black_crows"
  | "three_inside_up"
  | "three_inside_down";

/**
 * A single detected candlestick pattern
 */
export type CandlestickPattern = {
  /** Pattern identifier */
  name: CandlestickPatternName;
  /** Bullish or bearish signal */
  direction: "bullish" | "bearish";
  /** Confidence score (0-100) */
  confidence: number;
  /** Number of candles forming this pattern */
  candleCount: 1 | 2 | 3;
};

/**
 * Candlestick pattern detection result for a single bar
 */
export type CandlestickPatternValue = {
  /** All patterns detected at this bar */
  patterns: CandlestickPattern[];
  /** Whether any bullish pattern was detected */
  hasBullish: boolean;
  /** Whether any bearish pattern was detected */
  hasBearish: boolean;
};

/**
 * Options for candlestick pattern detection
 */
export type CandlestickPatternOptions = {
  /** Doji threshold: max body/range ratio to classify as doji (default: 0.05) */
  dojiThreshold?: number;
  /** Marubozu threshold: min body/range ratio for marubozu (default: 0.95) */
  marubozuThreshold?: number;
  /** Hammer shadow ratio: min lower shadow / body ratio (default: 2) */
  hammerShadowRatio?: number;
  /** Require prior trend for directional patterns (default: true) */
  requireTrend?: boolean;
  /** Number of bars to determine prior trend (default: 5) */
  trendLookback?: number;
  /** Specific patterns to detect (default: all) */
  patterns?: CandlestickPatternName[];
};
