/**
 * Candlestick Tokenizer v2 — Shape-Category Based
 *
 * Converts candles into discrete tokens using 17 traditional candlestick shape
 * categories × 4 volume bins = 68 tokens + 1 PAD = 69 total.
 *
 * Shape categories:
 * - Bullish (0-5): marubozu, close_shaven, open_shaven, normal, small, long_upper
 * - Bearish (6-11): marubozu, close_shaven, open_shaven, normal, small, long_lower
 * - Doji (12-16): four_price, dragonfly, gravestone, long_legged, standard
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import { candlestickPatterns } from "../signals/candlestick";
import type { CandlestickPatternName } from "../signals/candlestick/types";
import {
  bodyRatio,
  bodySize,
  candleRange,
  isBullish,
  lowerShadow,
  upperShadow,
} from "../signals/candlestick/utils";
import type { Candle, NormalizedCandle } from "../types";
import type { CandleToken, PredictionDirection } from "./types";
import { PAD_TOKEN, PATTERN_NONE } from "./types";

// ============================================
// Shape category IDs
// ============================================

// Bullish shapes (close >= open, bodyRatio >= 0.05)
export const SHAPE_BULL_MARUBOZU = 0;
export const SHAPE_BULL_CLOSE_SHAVEN = 1;
export const SHAPE_BULL_OPEN_SHAVEN = 2;
export const SHAPE_BULL_NORMAL = 3;
export const SHAPE_BULL_SMALL = 4;
export const SHAPE_BULL_LONG_UPPER = 5;

// Bearish shapes (close < open, bodyRatio >= 0.05)
export const SHAPE_BEAR_MARUBOZU = 6;
export const SHAPE_BEAR_CLOSE_SHAVEN = 7;
export const SHAPE_BEAR_OPEN_SHAVEN = 8;
export const SHAPE_BEAR_NORMAL = 9;
export const SHAPE_BEAR_SMALL = 10;
export const SHAPE_BEAR_LONG_LOWER = 11;

// Doji shapes (bodyRatio < 0.05)
export const SHAPE_FOUR_PRICE_DOJI = 12;
export const SHAPE_DRAGONFLY_DOJI = 13;
export const SHAPE_GRAVESTONE_DOJI = 14;
export const SHAPE_LONG_LEGGED_DOJI = 15;
export const SHAPE_STANDARD_DOJI = 16;

/**
 * Human-readable shape names indexed by shape ID
 */
export const SHAPE_NAMES: readonly string[] = [
  "bull_marubozu",
  "bull_close_shaven",
  "bull_open_shaven",
  "bull_normal",
  "bull_small",
  "bull_long_upper",
  "bear_marubozu",
  "bear_close_shaven",
  "bear_open_shaven",
  "bear_normal",
  "bear_small",
  "bear_long_lower",
  "four_price_doji",
  "dragonfly_doji",
  "gravestone_doji",
  "long_legged_doji",
  "standard_doji",
];

// ============================================
// Classification thresholds
// ============================================

const DOJI_THRESHOLD = 0.05;
const SMALL_BODY_THRESHOLD = 0.35;
const MARUBOZU_THRESHOLD = 0.85;
const TINY_SHADOW_THRESHOLD = 0.05;
const DOMINANT_SHADOW_RATIO = 3.0;
const LONG_LEGGED_THRESHOLD = 0.3;
const FOUR_PRICE_THRESHOLD = 1e-10;

// Volume ratio thresholds
const VOLUME_LOW = 0.5;
const VOLUME_HIGH = 1.5;
const VOLUME_SPIKE = 2.5;

// Default period for volume SMA
const DEFAULT_VOLUME_SMA_PERIOD = 20;

// ============================================
// Shape classification
// ============================================

/**
 * Classify a candle into one of 17 shape categories.
 *
 * Decision tree (priority order):
 * 1. Four-price doji (range ≈ 0)
 * 2. Doji group (bodyRatio < 0.05)
 * 3. Bullish shapes (close >= open)
 * 4. Bearish shapes (close < open, mirror of bullish)
 *
 * @param candle - Normalized candle
 * @returns Shape category ID (0-16)
 *
 * @example
 * ```ts
 * const shape = classifyShape({ time: 0, open: 90, close: 110, high: 111, low: 89, volume: 1000 });
 * // shape = 0 (bull_marubozu)
 * ```
 */
export function classifyShape(candle: NormalizedCandle): number {
  const range = candleRange(candle);

  // 1. Four-price doji: all OHLC nearly equal
  if (range < FOUR_PRICE_THRESHOLD) {
    return SHAPE_FOUR_PRICE_DOJI;
  }

  const ratio = bodyRatio(candle);

  // 2. Doji group: very small body
  if (ratio < DOJI_THRESHOLD) {
    const upper = upperShadow(candle);
    const lower = lowerShadow(candle);

    // Avoid division by zero for tiny shadows
    if (lower > FOUR_PRICE_THRESHOLD && upper / lower > DOMINANT_SHADOW_RATIO) {
      return SHAPE_GRAVESTONE_DOJI;
    }
    if (upper > FOUR_PRICE_THRESHOLD && lower / upper > DOMINANT_SHADOW_RATIO) {
      return SHAPE_DRAGONFLY_DOJI;
    }
    if (upper > range * LONG_LEGGED_THRESHOLD && lower > range * LONG_LEGGED_THRESHOLD) {
      return SHAPE_LONG_LEGGED_DOJI;
    }
    return SHAPE_STANDARD_DOJI;
  }

  const body = bodySize(candle);
  const upper = upperShadow(candle);
  const lower = lowerShadow(candle);

  // 3. Bullish shapes
  if (isBullish(candle)) {
    // a. Marubozu: large body, tiny shadows
    if (
      ratio > MARUBOZU_THRESHOLD &&
      upper / range < TINY_SHADOW_THRESHOLD &&
      lower / range < TINY_SHADOW_THRESHOLD
    ) {
      return SHAPE_BULL_MARUBOZU;
    }
    // b. Long upper shadow: upper > body (reversal hint)
    if (upper > body) {
      return SHAPE_BULL_LONG_UPPER;
    }
    // c. Close shaven (大引坊主): tiny upper shadow, lower shadow present
    if (upper / range < TINY_SHADOW_THRESHOLD) {
      return SHAPE_BULL_CLOSE_SHAVEN;
    }
    // d. Open shaven (寄付坊主): tiny lower shadow, upper shadow present
    if (lower / range < TINY_SHADOW_THRESHOLD) {
      return SHAPE_BULL_OPEN_SHAVEN;
    }
    // e. Small body
    if (ratio < SMALL_BODY_THRESHOLD) {
      return SHAPE_BULL_SMALL;
    }
    // f. Normal bullish
    return SHAPE_BULL_NORMAL;
  }

  // 4. Bearish shapes (mirror of bullish)
  // a. Marubozu
  if (
    ratio > MARUBOZU_THRESHOLD &&
    upper / range < TINY_SHADOW_THRESHOLD &&
    lower / range < TINY_SHADOW_THRESHOLD
  ) {
    return SHAPE_BEAR_MARUBOZU;
  }
  // b. Long lower shadow: lower > body (reversal hint)
  if (lower > body) {
    return SHAPE_BEAR_LONG_LOWER;
  }
  // c. Close shaven (大引坊主): tiny lower shadow, upper shadow present
  if (lower / range < TINY_SHADOW_THRESHOLD) {
    return SHAPE_BEAR_CLOSE_SHAVEN;
  }
  // d. Open shaven (寄付坊主): tiny upper shadow, lower shadow present
  if (upper / range < TINY_SHADOW_THRESHOLD) {
    return SHAPE_BEAR_OPEN_SHAVEN;
  }
  // e. Small body
  if (ratio < SMALL_BODY_THRESHOLD) {
    return SHAPE_BEAR_SMALL;
  }
  // f. Normal bearish
  return SHAPE_BEAR_NORMAL;
}

// ============================================
// Public API
// ============================================

/**
 * Quantize volume ratio (volume / SMA) into 4 bins
 *
 * @param ratio - Volume divided by its SMA (1.0 = average)
 * @returns 0 (low), 1 (normal), 2 (high), 3 (spike)
 */
export function quantizeVolume(ratio: number): number {
  if (ratio < VOLUME_LOW) return 0; // low
  if (ratio < VOLUME_HIGH) return 1; // normal
  if (ratio < VOLUME_SPIKE) return 2; // high
  return 3; // spike
}

/**
 * Quantize a single candle into a CandleToken using shape-category classification.
 *
 * @param candle - Normalized candle to quantize
 * @param volumeRatio - Volume relative to SMA (default: 1.0 = normal)
 * @returns Token with shape, volume bin, and computed ID
 *
 * @example
 * ```ts
 * const token = quantizeCandle({ time: 0, open: 90, high: 111, low: 89, close: 110, volume: 1000 });
 * // token.shape = 0 (bull_marubozu), token.volumeBin = 1 (normal)
 * ```
 */
export function quantizeCandle(candle: NormalizedCandle, volumeRatio = 1.0): CandleToken {
  const shape = classifyShape(candle);
  const volumeBin = quantizeVolume(volumeRatio);

  return {
    shape,
    volumeBin,
    id: shape * 4 + volumeBin,
  };
}

/**
 * Compute volume ratios (volume / SMA) for each candle
 *
 * @param candles - Normalized candles
 * @param period - SMA lookback period (default: 20)
 * @returns Array of volume ratios (1.0 = average)
 */
export function computeVolumeRatios(
  candles: NormalizedCandle[],
  period = DEFAULT_VOLUME_SMA_PERIOD,
): number[] {
  const ratios: number[] = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].volume;

    if (i < period) {
      // Not enough data yet — use running average
      const avg = sum / (i + 1);
      ratios.push(avg > 0 ? candles[i].volume / avg : 1.0);
    } else {
      // Subtract the element leaving the window
      sum -= candles[i - period].volume;
      const avg = sum / period;
      ratios.push(avg > 0 ? candles[i].volume / avg : 1.0);
    }
  }

  return ratios;
}

/**
 * Tokenize an array of candles into token IDs
 *
 * Computes volume SMA(20) first, then quantizes each candle with its volume ratio.
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Array of token IDs
 *
 * @example
 * ```ts
 * const tokens = tokenizeCandles(candles);
 * // tokens = [4, 24, 52, 16, ...]
 * ```
 */
export function tokenizeCandles(candles: Candle[] | NormalizedCandle[]): number[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const volumeRatios = computeVolumeRatios(normalized);
  return normalized.map((c, i) => quantizeCandle(c, volumeRatios[i]).id);
}

/**
 * Classify next candle's direction for training targets
 *
 * @param current - Current candle
 * @param next - Next candle
 * @param threshold - Neutral zone threshold as ratio (default: 0.001 = 0.1%)
 * @returns 0 = bullish, 1 = bearish, 2 = neutral
 */
export function classifyDirection(
  current: NormalizedCandle,
  next: NormalizedCandle,
  threshold = 0.001,
): number {
  const change = (next.close - current.close) / current.close;
  if (change > threshold) return 0; // bullish
  if (change < -threshold) return 1; // bearish
  return 2; // neutral
}

/**
 * Convert class index to direction label
 */
export function classToDirection(classIdx: number): PredictionDirection {
  if (classIdx === 0) return "bullish";
  if (classIdx === 1) return "bearish";
  return "neutral";
}

/**
 * Pad or truncate token sequence to fixed length
 *
 * @param tokens - Input token IDs
 * @param seqLen - Target sequence length
 * @returns Padded/truncated array of token IDs
 */
export function padTokens(tokens: number[], seqLen: number): number[] {
  if (tokens.length >= seqLen) {
    return tokens.slice(tokens.length - seqLen);
  }
  const padded = new Array<number>(seqLen - tokens.length).fill(PAD_TOKEN);
  return [...padded, ...tokens];
}

/**
 * Pad or truncate pattern token sequence to fixed length
 *
 * @param tokens - Input pattern token IDs
 * @param seqLen - Target sequence length
 * @returns Padded/truncated array of pattern token IDs (padded with PATTERN_NONE)
 */
export function padPatternTokens(tokens: number[], seqLen: number): number[] {
  if (tokens.length >= seqLen) {
    return tokens.slice(tokens.length - seqLen);
  }
  const padded = new Array<number>(seqLen - tokens.length).fill(PATTERN_NONE);
  return [...padded, ...tokens];
}

// ============================================
// Pattern tokenization (Dual Embedding)
// ============================================

/**
 * Mapping from multi-candle pattern names to pattern token IDs (1-14).
 * Single-candle patterns are excluded (already captured by shape tokens).
 * ID 0 = no pattern detected.
 */
const MULTI_CANDLE_PATTERN_IDS: Record<string, number> = {
  bullish_engulfing: 1,
  bearish_engulfing: 2,
  bullish_harami: 3,
  bearish_harami: 4,
  tweezer_top: 5,
  tweezer_bottom: 6,
  piercing_line: 7,
  dark_cloud_cover: 8,
  morning_star: 9,
  evening_star: 10,
  three_white_soldiers: 11,
  three_black_crows: 12,
  three_inside_up: 13,
  three_inside_down: 14,
};

/**
 * Human-readable pattern names indexed by pattern token ID
 */
export const PATTERN_NAMES: readonly string[] = [
  "none",
  "bullish_engulfing",
  "bearish_engulfing",
  "bullish_harami",
  "bearish_harami",
  "tweezer_top",
  "tweezer_bottom",
  "piercing_line",
  "dark_cloud_cover",
  "morning_star",
  "evening_star",
  "three_white_soldiers",
  "three_black_crows",
  "three_inside_up",
  "three_inside_down",
];

/** Multi-candle pattern names used for detection filtering */
const MULTI_CANDLE_PATTERNS: CandlestickPatternName[] = [
  "bullish_engulfing",
  "bearish_engulfing",
  "bullish_harami",
  "bearish_harami",
  "tweezer_top",
  "tweezer_bottom",
  "piercing_line",
  "dark_cloud_cover",
  "morning_star",
  "evening_star",
  "three_white_soldiers",
  "three_black_crows",
  "three_inside_up",
  "three_inside_down",
];

/**
 * Tokenize candles into pattern token IDs for dual embedding.
 *
 * Detects multi-candle candlestick patterns (2-candle and 3-candle) and assigns
 * each bar a pattern token ID. When multiple patterns are detected at the same bar,
 * the one with the highest confidence is selected (ties broken by higher candleCount).
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Array of pattern token IDs (0 = no pattern, 1-14 = specific multi-candle pattern)
 *
 * @example
 * ```ts
 * const patternTokens = tokenizePatterns(candles);
 * // patternTokens = [0, 0, 1, 0, 9, 0, ...]
 * //                       ^ engulfing  ^ morning_star
 * ```
 */
export function tokenizePatterns(candles: Candle[] | NormalizedCandle[]): number[] {
  const patterns = candlestickPatterns(candles, {
    patterns: MULTI_CANDLE_PATTERNS,
    requireTrend: false, // Don't filter by trend — let the model learn
  });

  return patterns.map((bar) => {
    const multiPatterns = bar.value.patterns.filter(
      (p) => p.candleCount >= 2 && MULTI_CANDLE_PATTERN_IDS[p.name] !== undefined,
    );

    if (multiPatterns.length === 0) return PATTERN_NONE;

    // Pick highest confidence; break ties by candleCount (prefer 3-candle)
    multiPatterns.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.candleCount - a.candleCount;
    });

    return MULTI_CANDLE_PATTERN_IDS[multiPatterns[0].name];
  });
}
