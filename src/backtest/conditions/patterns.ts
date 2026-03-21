/**
 * Price Pattern Backtest Conditions
 *
 * Conditions for detecting chart patterns in backtesting.
 * Supports Double Top/Bottom, Head & Shoulders, Cup with Handle,
 * Triangle, Wedge, Channel, and Flag/Pennant patterns.
 */

import {
  detectChannel,
  cupWithHandle as detectCupHandle,
  doubleBottom as detectDoubleBottom,
  doubleTop as detectDoubleTop,
  detectFlag,
  detectHarmonicPatterns,
  headAndShoulders as detectHeadShoulders,
  inverseHeadAndShoulders as detectInverseHeadShoulders,
  detectTriangle,
  detectWedge,
} from "../../signals/patterns";
import type { PatternSignal, PatternType } from "../../signals/patterns";
import type { NormalizedCandle, PresetCondition } from "../../types";

const PATTERN_CACHE_PREFIX = "pattern_";

const BULLISH_PATTERNS: PatternType[] = [
  "double_bottom",
  "inverse_head_shoulders",
  "cup_handle",
  "falling_wedge",
  "triangle_ascending",
  "bull_flag",
  "bull_pennant",
  "gartley_bullish",
  "butterfly_bullish",
  "bat_bullish",
  "crab_bullish",
  "shark_bullish",
];
const BEARISH_PATTERNS: PatternType[] = [
  "double_top",
  "head_shoulders",
  "rising_wedge",
  "triangle_descending",
  "bear_flag",
  "bear_pennant",
  "gartley_bearish",
  "butterfly_bearish",
  "bat_bearish",
  "crab_bearish",
  "shark_bearish",
];
const ALL_PATTERNS: PatternType[] = [...BULLISH_PATTERNS, ...BEARISH_PATTERNS];

type CandleArray = Parameters<typeof detectDoubleTop>[0];

const PATTERN_DETECTORS: Record<
  PatternType,
  (candles: CandleArray, opts: { swingLookback: number }) => PatternSignal[]
> = {
  double_top: detectDoubleTop,
  double_bottom: detectDoubleBottom,
  head_shoulders: detectHeadShoulders,
  inverse_head_shoulders: detectInverseHeadShoulders,
  cup_handle: detectCupHandle,
  triangle_symmetrical: (c, o) => detectTriangle(c, { swingLookback: o.swingLookback }),
  triangle_ascending: (c, o) => detectTriangle(c, { swingLookback: o.swingLookback }),
  triangle_descending: (c, o) => detectTriangle(c, { swingLookback: o.swingLookback }),
  rising_wedge: (c, o) => detectWedge(c, { swingLookback: o.swingLookback }),
  falling_wedge: (c, o) => detectWedge(c, { swingLookback: o.swingLookback }),
  channel_ascending: (c, o) => detectChannel(c, { swingLookback: o.swingLookback }),
  channel_descending: (c, o) => detectChannel(c, { swingLookback: o.swingLookback }),
  channel_horizontal: (c, o) => detectChannel(c, { swingLookback: o.swingLookback }),
  bull_flag: (c, o) => detectFlag(c, { swingLookback: o.swingLookback }),
  bear_flag: (c, o) => detectFlag(c, { swingLookback: o.swingLookback }),
  bull_pennant: (c, o) => detectFlag(c, { swingLookback: o.swingLookback }),
  bear_pennant: (c, o) => detectFlag(c, { swingLookback: o.swingLookback }),
  gartley_bullish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["gartley"] }),
  gartley_bearish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["gartley"] }),
  butterfly_bullish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["butterfly"] }),
  butterfly_bearish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["butterfly"] }),
  bat_bullish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["bat"] }),
  bat_bearish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["bat"] }),
  crab_bullish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["crab"] }),
  crab_bearish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["crab"] }),
  shark_bullish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["shark"] }),
  shark_bearish: (c, o) =>
    detectHarmonicPatterns(c, { swingLookback: o.swingLookback, patterns: ["shark"] }),
};

/**
 * Options for pattern conditions
 */
export interface PatternConditionOptions {
  /** Swing point lookback (default: 5) */
  swingLookback?: number;
  /** Only consider confirmed patterns (default: false) */
  confirmedOnly?: boolean;
}

/**
 * Get cached pattern data for a specific type
 */
function getPatternData(
  indicators: Record<string, unknown>,
  candles: CandleArray,
  patternType: PatternType,
  options: PatternConditionOptions = {},
): PatternSignal[] {
  const { swingLookback = 5 } = options;
  const cacheKey = `${PATTERN_CACHE_PREFIX}${patternType}_${swingLookback}`;

  const cached = indicators[cacheKey] as PatternSignal[] | undefined;
  if (cached) return cached;

  const detector = PATTERN_DETECTORS[patternType];
  // Detectors like detectTriangle return all subtypes; filter to requested type
  const allPatterns = detector ? detector(candles, { swingLookback }) : [];
  const patterns = allPatterns.filter((p) => p.type === patternType);

  indicators[cacheKey] = patterns;
  return patterns;
}

/**
 * Find a matching pattern at the given candle time
 */
function findPatternAtTime(
  patterns: PatternSignal[],
  time: number | string,
  confirmedOnly: boolean,
): PatternSignal | undefined {
  return patterns.find((p) => p.time === time && (!confirmedOnly || p.confirmed));
}

/**
 * Check if any pattern from the given types matches at the current candle
 */
function hasMatchingPattern(
  indicators: Record<string, unknown>,
  candles: CandleArray,
  candle: NormalizedCandle,
  patternTypes: PatternType[],
  options: PatternConditionOptions,
): boolean {
  const { confirmedOnly = false } = options;

  for (const type of patternTypes) {
    const patterns = getPatternData(indicators, candles, type, options);
    if (findPatternAtTime(patterns, candle.time, confirmedOnly)) {
      return true;
    }
  }

  return false;
}

// ============================================
// Pattern Detection Conditions
// ============================================

/**
 * Pattern of specific type detected at current bar
 *
 * @param type - Pattern type to detect
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * // Exit on double top detection
 * const exit = patternDetected('double_top');
 *
 * // Enter on confirmed double bottom
 * const entry = patternDetected('double_bottom', { confirmedOnly: true });
 * ```
 */
export function patternDetected(
  type: PatternType,
  options: PatternConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `patternDetected(${type})`,
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, [type], options),
  };
}

/**
 * Pattern of specific type is confirmed (breakout occurred)
 *
 * @param type - Pattern type to check
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * // Exit on confirmed head and shoulders
 * const exit = patternConfirmed('head_shoulders');
 * ```
 */
export function patternConfirmed(
  type: PatternType,
  options: PatternConditionOptions = {},
): PresetCondition {
  return patternDetected(type, { ...options, confirmedOnly: true });
}

// ============================================
// Bullish/Bearish Pattern Conditions
// ============================================

/**
 * Any bullish pattern detected
 *
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * // Enter on any bullish reversal pattern
 * const entry = anyBullishPattern({ confirmedOnly: true });
 * ```
 */
export function anyBullishPattern(options: PatternConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "anyBullishPattern()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, BULLISH_PATTERNS, options),
  };
}

/**
 * Any bearish pattern detected
 *
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * // Exit on any bearish reversal pattern
 * const exit = anyBearishPattern();
 * ```
 */
export function anyBearishPattern(options: PatternConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "anyBearishPattern()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, BEARISH_PATTERNS, options),
  };
}

// ============================================
// Pattern Confidence Conditions
// ============================================

/**
 * Find a pattern at the given time with confidence above threshold
 */
function findHighConfidencePattern(
  patterns: PatternSignal[],
  time: number | string,
  minConfidence: number,
): boolean {
  return patterns.some((p) => p.time === time && p.confidence >= minConfidence);
}

/**
 * Pattern confidence above threshold
 *
 * @param type - Pattern type to check
 * @param minConfidence - Minimum confidence (0-100, default: 70)
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * // Only trade high-confidence patterns
 * const entry = patternConfidenceAbove('cup_handle', 80);
 * ```
 */
export function patternConfidenceAbove(
  type: PatternType,
  minConfidence = 70,
  options: PatternConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `patternConfidenceAbove(${type}, ${minConfidence})`,
    evaluate: (indicators, candle, _index, candles) => {
      const patterns = getPatternData(indicators, candles, type, options);
      return findHighConfidencePattern(patterns, candle.time, minConfidence);
    },
  };
}

/**
 * Any pattern with confidence above threshold
 *
 * @param minConfidence - Minimum confidence (0-100, default: 70)
 * @param options - Pattern detection options
 */
export function anyPatternConfidenceAbove(
  minConfidence = 70,
  options: PatternConditionOptions = {},
): PresetCondition {
  return {
    type: "preset",
    name: `anyPatternConfidenceAbove(${minConfidence})`,
    evaluate: (indicators, candle, _index, candles) => {
      for (const type of ALL_PATTERNS) {
        const patterns = getPatternData(indicators, candles, type, options);
        if (findHighConfidencePattern(patterns, candle.time, minConfidence)) {
          return true;
        }
      }
      return false;
    },
  };
}

// ============================================
// Pattern Within Range Conditions
// ============================================

/**
 * Pattern detected within last N bars
 *
 * Useful for detecting patterns that were recently formed but not exactly at current bar.
 *
 * @param type - Pattern type to detect
 * @param lookback - Number of bars to look back (default: 5)
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * // Enter if double bottom formed recently
 * const entry = patternWithinBars('double_bottom', 3);
 * ```
 */
export function patternWithinBars(
  type: PatternType,
  lookback = 5,
  options: PatternConditionOptions = {},
): PresetCondition {
  const { confirmedOnly = false } = options;

  return {
    type: "preset",
    name: `patternWithinBars(${type}, ${lookback})`,
    evaluate: (indicators, _candle, index, candles) => {
      const patterns = getPatternData(indicators, candles, type, options);

      // Build a set of times in the lookback window for O(1) lookup
      const startIndex = Math.max(0, index - lookback);
      const lookbackTimes = new Set<number | string>();
      for (let i = startIndex; i <= index; i++) {
        lookbackTimes.add(candles[i].time);
      }

      // Check if any pattern falls within the lookback window
      for (const pattern of patterns) {
        if (lookbackTimes.has(pattern.time)) {
          if (!confirmedOnly || pattern.confirmed) {
            return true;
          }
        }
      }

      return false;
    },
  };
}

// ============================================
// Convenience Conditions
// ============================================

/**
 * Double Top pattern detected
 */
export function doubleTopDetected(options: PatternConditionOptions = {}): PresetCondition {
  return patternDetected("double_top", options);
}

/**
 * Double Bottom pattern detected
 */
export function doubleBottomDetected(options: PatternConditionOptions = {}): PresetCondition {
  return patternDetected("double_bottom", options);
}

/**
 * Head and Shoulders pattern detected
 */
export function headShouldersDetected(options: PatternConditionOptions = {}): PresetCondition {
  return patternDetected("head_shoulders", options);
}

/**
 * Inverse Head and Shoulders pattern detected
 */
export function inverseHeadShouldersDetected(
  options: PatternConditionOptions = {},
): PresetCondition {
  return patternDetected("inverse_head_shoulders", options);
}

/**
 * Cup with Handle pattern detected
 */
export function cupHandleDetected(options: PatternConditionOptions = {}): PresetCondition {
  return patternDetected("cup_handle", options);
}

/**
 * Triangle pattern detected (any subtype)
 */
export function triangleDetected(
  subtype?: "triangle_symmetrical" | "triangle_ascending" | "triangle_descending",
  options: PatternConditionOptions = {},
): PresetCondition {
  if (subtype) return patternDetected(subtype, options);
  const types: PatternType[] = [
    "triangle_symmetrical",
    "triangle_ascending",
    "triangle_descending",
  ];
  return {
    type: "preset",
    name: "triangleDetected()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, types, options),
  };
}

/**
 * Wedge pattern detected (any subtype)
 */
export function wedgeDetected(
  subtype?: "rising_wedge" | "falling_wedge",
  options: PatternConditionOptions = {},
): PresetCondition {
  if (subtype) return patternDetected(subtype, options);
  const types: PatternType[] = ["rising_wedge", "falling_wedge"];
  return {
    type: "preset",
    name: "wedgeDetected()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, types, options),
  };
}

/**
 * Channel pattern detected (any subtype)
 */
export function channelDetected(
  subtype?: "channel_ascending" | "channel_descending" | "channel_horizontal",
  options: PatternConditionOptions = {},
): PresetCondition {
  if (subtype) return patternDetected(subtype, options);
  const types: PatternType[] = ["channel_ascending", "channel_descending", "channel_horizontal"];
  return {
    type: "preset",
    name: "channelDetected()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, types, options),
  };
}

/**
 * Flag or Pennant pattern detected (any subtype)
 */
export function flagDetected(
  subtype?: "bull_flag" | "bear_flag" | "bull_pennant" | "bear_pennant",
  options: PatternConditionOptions = {},
): PresetCondition {
  if (subtype) return patternDetected(subtype, options);
  const types: PatternType[] = ["bull_flag", "bear_flag", "bull_pennant", "bear_pennant"];
  return {
    type: "preset",
    name: "flagDetected()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, types, options),
  };
}

/**
 * Bull Flag detected
 */
export function bullFlagDetected(options: PatternConditionOptions = {}): PresetCondition {
  return patternDetected("bull_flag", options);
}

/**
 * Bear Flag detected
 */
export function bearFlagDetected(options: PatternConditionOptions = {}): PresetCondition {
  return patternDetected("bear_flag", options);
}

// ============================================
// Harmonic Pattern Conditions
// ============================================

/**
 * Any harmonic pattern detected (optionally filtered by subtype)
 *
 * @param subtype - Specific harmonic pattern type (optional)
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * // Detect any harmonic pattern
 * const entry = harmonicPatternDetected();
 *
 * // Detect specific harmonic pattern
 * const gartley = harmonicPatternDetected("gartley_bullish");
 * ```
 */
export function harmonicPatternDetected(
  subtype?: PatternType,
  options: PatternConditionOptions = {},
): PresetCondition {
  if (subtype) return patternDetected(subtype, options);
  const types: PatternType[] = [
    "gartley_bullish",
    "gartley_bearish",
    "butterfly_bullish",
    "butterfly_bearish",
    "bat_bullish",
    "bat_bearish",
    "crab_bullish",
    "crab_bearish",
    "shark_bullish",
    "shark_bearish",
  ];
  return {
    type: "preset",
    name: "harmonicPatternDetected()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, types, options),
  };
}

/**
 * Any bullish harmonic pattern detected
 *
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * const entry = bullishHarmonicDetected();
 * ```
 */
export function bullishHarmonicDetected(options: PatternConditionOptions = {}): PresetCondition {
  const types: PatternType[] = [
    "gartley_bullish",
    "butterfly_bullish",
    "bat_bullish",
    "crab_bullish",
    "shark_bullish",
  ];
  return {
    type: "preset",
    name: "bullishHarmonicDetected()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, types, options),
  };
}

/**
 * Any bearish harmonic pattern detected
 *
 * @param options - Pattern detection options
 *
 * @example
 * ```ts
 * const exit = bearishHarmonicDetected();
 * ```
 */
export function bearishHarmonicDetected(options: PatternConditionOptions = {}): PresetCondition {
  const types: PatternType[] = [
    "gartley_bearish",
    "butterfly_bearish",
    "bat_bearish",
    "crab_bearish",
    "shark_bearish",
  ];
  return {
    type: "preset",
    name: "bearishHarmonicDetected()",
    evaluate: (indicators, candle, _index, candles) =>
      hasMatchingPattern(indicators, candles, candle, types, options),
  };
}
