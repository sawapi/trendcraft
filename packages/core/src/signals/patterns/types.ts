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
 * Directional bias a pattern implies for the move that follows it.
 *
 * `"neutral"` means the shape itself carries no direction: a symmetrical triangle
 * and the channel family resolve either way, and which way is only knowable from
 * the breakout — see {@link PatternSignal.breakoutDirection}.
 */
export type PatternBias = "bullish" | "bearish" | "neutral";

/**
 * Directional bias of every pattern type.
 *
 * Single owner: anything that needs to know whether a pattern points up or
 * down reads this map. Because it is a total `Record<PatternType, ...>`,
 * adding a member to {@link PatternType} without declaring its bias is a
 * compile error rather than a silent default.
 *
 * Bias is deliberately NOT the same axis as reversal-vs-continuation — a cup
 * and handle is bullish continuation, an inverse head and shoulders is bullish
 * reversal, and both are `"bullish"` here.
 *
 * @example
 * ```ts
 * import { PATTERN_BIAS, doubleBottom } from "trendcraft";
 *
 * const patterns = doubleBottom(candles);
 * const bullish = patterns.filter((p) => PATTERN_BIAS[p.type] === "bullish");
 * ```
 */
export const PATTERN_BIAS: Readonly<Record<PatternType, PatternBias>> = {
  // Reversals
  double_top: "bearish",
  double_bottom: "bullish",
  head_shoulders: "bearish",
  inverse_head_shoulders: "bullish",
  // Continuations
  cup_handle: "bullish",
  bull_flag: "bullish",
  bear_flag: "bearish",
  bull_pennant: "bullish",
  bear_pennant: "bearish",
  // Triangles — a symmetrical triangle breaks either way
  triangle_symmetrical: "neutral",
  triangle_ascending: "bullish",
  triangle_descending: "bearish",
  // Wedges — a rising wedge breaks down, a falling wedge breaks up
  rising_wedge: "bearish",
  falling_wedge: "bullish",
  // Channels — a channel is a range to trade both sides of, so its slope is not
  // a directional call; the breakout is (see `breakoutDirection`)
  channel_ascending: "neutral",
  channel_descending: "neutral",
  channel_horizontal: "neutral",
  // Harmonics — the detector names the direction
  gartley_bullish: "bullish",
  gartley_bearish: "bearish",
  butterfly_bullish: "bullish",
  butterfly_bearish: "bearish",
  bat_bullish: "bullish",
  bat_bearish: "bearish",
  crab_bullish: "bullish",
  crab_bearish: "bearish",
  shark_bullish: "bullish",
  shark_bearish: "bearish",
};

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
  /**
   * Earliest bar time at which the pattern formation is knowable in real time.
   * Swing pivots are only identifiable `swingLookback` bars after they occur,
   * so this is the time of the bar `swingLookback` bars after the final
   * structural pivot. Use this (not `time`) for causal/backtest entries.
   */
  detectableTime: number;
  /**
   * Earliest bar time at which the breakout confirmation is knowable in real
   * time: the later of the breakout bar and `detectableTime` (a breakout can
   * occur before the final pivot itself is identifiable). Only set when
   * `confirmed` is true.
   */
  confirmTime?: number;
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
  /**
   * Direction price actually broke out, for detectors that accept a breakout
   * either way — the triangle and channel families, whose `pattern.target` and
   * `pattern.stopLoss` are measured from this direction.
   *
   * A `channel_ascending` can break down and a `triangle_descending` can break
   * up, so this is what settles the trade direction; {@link PATTERN_BIAS} only
   * describes the shape. Set only when `confirmed` is true.
   *
   * Left `undefined` by detectors whose confirmation is a break in the shape's
   * own direction by construction (double top/bottom, head and shoulders,
   * flags, harmonics) — for those the bias already is the breakout direction.
   */
  breakoutDirection?: "up" | "down";
}

/**
 * Resolve the direction to trade a pattern in.
 *
 * Single owner for the "bias, unless the breakout says otherwise" rule:
 *
 * 1. A confirmed breakout direction wins — a `channel_ascending` that broke
 *    down is a short, whatever its shape suggests, and it is the direction its
 *    `target`/`stopLoss` were measured from. `breakoutDirection` is honoured
 *    only when `confirmed` is also true, the pairing every detector produces.
 * 2. Otherwise fall back to {@link PATTERN_BIAS}.
 * 3. `null` when neither settles it: a `"neutral"` shape with no breakout yet.
 *    There is nothing to trade, and guessing would put `takeProfit` on the
 *    wrong side of `stopLoss`.
 *
 * @param signal - Pattern signal to resolve
 * @returns `"bullish"`, `"bearish"`, or `null` when the direction is unknown
 *
 * @example
 * ```ts
 * import { resolvePatternDirection, detectChannel } from "trendcraft";
 *
 * for (const p of detectChannel(candles)) {
 *   const dir = resolvePatternDirection(p);
 *   if (dir === null) continue; // still forming, no side to take
 * }
 * ```
 */
export function resolvePatternDirection(signal: PatternSignal): "bullish" | "bearish" | null {
  // `breakoutDirection` is only meaningful on a confirmed pattern — the two are
  // set together by every detector. Requiring both keeps a hand-built or
  // deserialized signal that carries one without the other from being read as a
  // breakout that never happened.
  if (signal.confirmed && signal.breakoutDirection) {
    return signal.breakoutDirection === "up" ? "bullish" : "bearish";
  }
  const bias = PATTERN_BIAS[signal.type];
  return bias === "neutral" ? null : bias;
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
  /** Minimum swing points per trendline (default: 2 for detectTriangle/detectFlag, 3 for detectWedge/detectChannel) */
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
 *
 * Note: detectFlag overrides several inherited defaults:
 * swingLookback defaults to 2 (not 3), minRSquared defaults to 0.5 (not 0.6),
 * and maxBreakoutBars defaults to 10 (not 20).
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
