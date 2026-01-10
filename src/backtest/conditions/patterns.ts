/**
 * Price Pattern Backtest Conditions
 *
 * Conditions for detecting chart patterns in backtesting.
 * Supports Double Top/Bottom, Head & Shoulders, and Cup with Handle patterns.
 */

import {
  doubleTop as detectDoubleTop,
  doubleBottom as detectDoubleBottom,
  headAndShoulders as detectHeadShoulders,
  inverseHeadAndShoulders as detectInverseHeadShoulders,
  cupWithHandle as detectCupHandle,
} from "../../signals/patterns";
import type { PatternSignal, PatternType } from "../../signals/patterns";
import type { PresetCondition, NormalizedCandle } from "../../types";

const PATTERN_CACHE_PREFIX = "pattern_";

const BULLISH_PATTERNS: PatternType[] = ["double_bottom", "inverse_head_shoulders", "cup_handle"];
const BEARISH_PATTERNS: PatternType[] = ["double_top", "head_shoulders"];
const ALL_PATTERNS: PatternType[] = [...BULLISH_PATTERNS, ...BEARISH_PATTERNS];

type CandleArray = Parameters<typeof detectDoubleTop>[0];

const PATTERN_DETECTORS: Record<PatternType, (candles: CandleArray, opts: { swingLookback: number }) => PatternSignal[]> = {
  double_top: detectDoubleTop,
  double_bottom: detectDoubleBottom,
  head_shoulders: detectHeadShoulders,
  inverse_head_shoulders: detectInverseHeadShoulders,
  cup_handle: detectCupHandle,
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
  const patterns = detector ? detector(candles, { swingLookback }) : [];

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
 * Any bullish pattern detected (Double Bottom, Inverse H&S, Cup with Handle)
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
 * Any bearish pattern detected (Double Top, Head & Shoulders)
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
