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
  | "cup_handle";

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
  /** Maximum bars between peaks/troughs (default: 60) */
  maxDistance?: number;
  /** Minimum depth of the middle trough/peak as % of pattern height (default: 0.1 = 10%) */
  minMiddleDepth?: number;
  /** Swing point detection lookback (default: 5) */
  swingLookback?: number;
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
