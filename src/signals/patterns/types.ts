/**
 * Price Pattern Recognition Types
 */

/**
 * Pattern type identifiers
 */
export type PatternType =
  | "double_top"
  | "double_bottom"
  | "head_shoulders"
  | "inverse_head_shoulders"
  | "cup_handle"
  | "triangle_symmetrical"
  | "triangle_ascending"
  | "triangle_descending"
  | "rising_wedge"
  | "falling_wedge"
  | "channel_ascending"
  | "channel_descending"
  | "channel_horizontal"
  | "bull_flag"
  | "bear_flag"
  | "bull_pennant"
  | "bear_pennant"
  | "gartley_bullish"
  | "gartley_bearish"
  | "butterfly_bullish"
  | "butterfly_bearish"
  | "bat_bullish"
  | "bat_bearish"
  | "crab_bullish"
  | "crab_bearish"
  | "shark_bullish"
  | "shark_bearish";

/**
 * Harmonic pattern type identifiers
 */
export type HarmonicPatternType = "gartley" | "butterfly" | "bat" | "crab" | "shark";

/**
 * Harmonic pattern detection options
 */
export interface HarmonicPatternOptions {
  /** Swing point detection lookback (default: 5) */
  swingLookback?: number;
  /** Fibonacci ratio tolerance as fraction (default: 0.05 = 5%) */
  tolerance?: number;
  /** Minimum number of swing points to scan (default: 50) */
  minSwingPoints?: number;
  /** Which patterns to detect (default: all) */
  patterns?: HarmonicPatternType[];
}

/**
 * Key point in a pattern (peak, trough, neckline point, etc.)
 */
export interface PatternKeyPoint {
  /** Timestamp of the key point */
  time: number;
  /** Index in the candle array */
  index: number;
  /** Price at this point */
  price: number;
  /** Label describing this point */
  label: string;
}

/**
 * Neckline for patterns like H&S, Double Top/Bottom
 */
export interface PatternNeckline {
  /** Starting price of neckline */
  startPrice: number;
  /** Ending price of neckline */
  endPrice: number;
  /** Slope of neckline (price change per bar) */
  slope: number;
  /** Current neckline price (at pattern end) */
  currentPrice: number;
}

/**
 * Base pattern signal structure
 */
export interface PatternSignal {
  /** Timestamp when pattern was detected (usually at completion) */
  time: number;
  /** Pattern type */
  type: PatternType;
  /** Pattern details */
  pattern: {
    /** When the pattern started forming */
    startTime: number;
    /** When the pattern completed */
    endTime: number;
    /** Key points defining the pattern */
    keyPoints: PatternKeyPoint[];
    /** Neckline (if applicable) */
    neckline?: PatternNeckline;
    /** Measured move price target */
    target?: number;
    /** Suggested stop loss level */
    stopLoss?: number;
    /** Pattern height (for measured move calculation) */
    height?: number;
  };
  /** Confidence score (0-100) */
  confidence: number;
  /** Whether pattern has been confirmed (e.g., neckline break) */
  confirmed: boolean;
}

/**
 * Double Top/Bottom specific options
 */
export interface DoublePatternOptions {
  /** Price tolerance for matching peaks/troughs (default: 0.02 = 2%) */
  tolerance?: number;
  /** Minimum bars between peaks/troughs (default: 10) */
  minDistance?: number;
  /** Maximum bars between peaks/troughs (default: 40, about 2 months for daily data) */
  maxDistance?: number;
  /** Minimum depth of the middle trough/peak as % of pattern height (default: 0.1 = 10%) */
  minMiddleDepth?: number;
  /** Swing point detection lookback (default: 5) */
  swingLookback?: number;

  // Volume validation options
  /** Enable volume validation on breakout (default: true) */
  validateVolume?: boolean;
  /** Minimum volume increase ratio on breakout compared to average (default: 1.2 = 20% increase) */
  minVolumeIncrease?: number;
  /** Lookback period for average volume calculation (default: 10) */
  volumeLookback?: number;

  // Neckline quality options
  /** Enable neckline quality validation (default: true) */
  validateNeckline?: boolean;
  /** Maximum times price can cross neckline before confirmation (default: 3) */
  maxNecklineCrosses?: number;

  // Prominence validation options
  /** Enable prominence validation - checks if peaks/troughs stand out from surroundings (default: true) */
  validateProminence?: boolean;
  /** Minimum prominence as percentage of price (default: 0.02 = 2%) */
  minProminence?: number;

  // Breakout distance options
  /** Maximum bars to search for breakout point from second peak/trough (default: 20) */
  maxBreakoutDistance?: number;

  // Neckline violation options
  /** Enable neckline violation validation during pattern formation (default: true) */
  validateNecklineViolation?: boolean;
  /** Tolerance for neckline violation as percentage of price (default: 0 = no tolerance) */
  necklineViolationTolerance?: number;

  // Strict mode options
  /** Enable strict mode - requires pattern to start above neckline for double bottom,
   *  or below neckline for double top (default: false = loose mode) */
  strictMode?: boolean;
}

/**
 * Head and Shoulders specific options
 */
export interface HeadShouldersOptions {
  /** Tolerance for shoulder height similarity (default: 0.05 = 5%) */
  shoulderTolerance?: number;
  /** Maximum neckline slope (default: 0.1 = 10% over pattern length) */
  maxNecklineSlope?: number;
  /** Minimum head height above shoulders as % (default: 0.03 = 3%) */
  minHeadHeight?: number;
  /** Swing point detection lookback (default: 5) */
  swingLookback?: number;
}

/**
 * Cup with Handle specific options
 */
export interface CupHandleOptions {
  /** Minimum cup depth as % from rim (default: 0.12 = 12%) */
  minCupDepth?: number;
  /** Maximum cup depth as % from rim (default: 0.35 = 35%) */
  maxCupDepth?: number;
  /** Minimum bars for cup formation (default: 30) */
  minCupLength?: number;
  /** Maximum handle depth as % from cup rim (default: 0.12 = 12%) */
  maxHandleDepth?: number;
  /** Minimum handle length in bars (default: 5) */
  minHandleLength?: number;
  /** Swing point detection lookback (default: 5) */
  swingLookback?: number;
}

/**
 * Common trendline-based pattern options
 */
interface TrendlinePatternBaseOptions {
  /** Swing point detection lookback (default: 3) */
  swingLookback?: number;
  /** Minimum swing points per trendline (default: 2) */
  minPoints?: number;
  /** Minimum R² for trendline fit (default: 0.6) */
  minRSquared?: number;
  /** Maximum bars to search for breakout (default: 20) */
  maxBreakoutBars?: number;
  /** Enable volume validation on breakout (default: true) */
  validateVolume?: boolean;
  /** Minimum volume increase ratio on breakout (default: 1.2) */
  minVolumeIncrease?: number;
  /** Lookback period for average volume calculation (default: 10) */
  volumeLookback?: number;
}

/**
 * Triangle pattern options (symmetrical, ascending, descending)
 */
export interface TriangleOptions extends TrendlinePatternBaseOptions {
  /** Threshold for flat slope detection (default: 0.0003) */
  flatTolerance?: number;
  /** Minimum bars for pattern formation (default: 15) */
  minBars?: number;
}

/**
 * Wedge pattern options (rising, falling)
 */
export interface WedgeOptions extends TrendlinePatternBaseOptions {
  /** Minimum bars for pattern formation (default: 15) */
  minBars?: number;
}

/**
 * Channel pattern options (ascending, descending, horizontal)
 */
export interface ChannelOptions extends TrendlinePatternBaseOptions {
  /** Threshold for flat slope detection (default: 0.0003) */
  flatTolerance?: number;
  /** Max slope difference for parallel detection (default: 0.0003) */
  parallelTolerance?: number;
  /** Minimum bars for pattern formation (default: 20) */
  minBars?: number;
}

/**
 * Flag and Pennant pattern options
 */
export interface FlagOptions extends TrendlinePatternBaseOptions {
  /** Threshold for flat slope detection (default: 0.0003) */
  flatTolerance?: number;
  /** Minimum flagpole size as ATR multiple (default: 2.0) */
  minAtrMultiple?: number;
  /** Maximum bars for flagpole (default: 8) */
  maxPoleBars?: number;
  /** Minimum consolidation bars (default: 5) */
  minConsolidationBars?: number;
  /** Maximum consolidation bars (default: 20) */
  maxConsolidationBars?: number;
}
