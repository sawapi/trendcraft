/**
 * Pattern Context Filter
 *
 * Applies contextual filters (ATR ratio, trend direction, volume confirmation)
 * to any detected pattern signals to improve quality and reduce false positives.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { linearRegression } from "../../indicators/trend/linear-regression";
import { atr as calcAtr } from "../../indicators/volatility/atr";
import type { Candle, NormalizedCandle } from "../../types";
import { validateBreakoutVolume } from "./double-pattern-utils";
import type { PatternSignal, PatternType } from "./types";

/**
 * Options for pattern filtering
 */
export interface PatternFilterOptions {
  /** Minimum pattern height as multiple of ATR (default: 1.5) */
  minATRRatio?: number;
  /** Require volume confirmation on breakout (default: true) */
  volumeConfirm?: boolean;
  /** Check trend direction alignment (default: true) */
  trendContext?: boolean;
  /** Minimum confidence after filtering (default: 50) */
  minConfidence?: number;
  /** ATR period (default: 14) */
  atrPeriod?: number;
  /** Linear regression period for trend context (default: 50) */
  trendPeriod?: number;
  /** Volume lookback for confirmation (default: 10) */
  volumeLookback?: number;
  /** Minimum volume increase ratio (default: 1.2) */
  minVolumeIncrease?: number;
}

/** Bearish reversal patterns (expect downside) */
const BEARISH_REVERSAL: PatternType[] = ["double_top", "head_shoulders", "rising_wedge"];

/** Bullish reversal patterns (expect upside) */
const BULLISH_REVERSAL: PatternType[] = [
  "double_bottom",
  "inverse_head_shoulders",
  "cup_handle",
  "falling_wedge",
];

/**
 * Filter pattern signals using contextual validation
 *
 * Applies ATR ratio, trend context, and volume filters to improve
 * pattern quality. Adjusts confidence scores based on filter results.
 *
 * @param patterns - Detected pattern signals
 * @param candles - Price data used for context analysis
 * @param options - Filter configuration
 * @returns Filtered patterns with adjusted confidence
 *
 * @example
 * ```ts
 * const raw = doubleTop(candles);
 * const filtered = filterPatterns(raw, candles, {
 *   minATRRatio: 2.0,
 *   trendContext: true,
 * });
 * ```
 */
export function filterPatterns(
  patterns: PatternSignal[],
  candles: Candle[] | NormalizedCandle[],
  options: PatternFilterOptions = {},
): PatternSignal[] {
  const {
    minATRRatio = 1.5,
    volumeConfirm = true,
    trendContext = true,
    minConfidence = 50,
    atrPeriod = 14,
    trendPeriod = 50,
    volumeLookback = 10,
    minVolumeIncrease = 1.2,
  } = options;

  if (patterns.length === 0) return [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const atrData = calcAtr(normalized, { period: atrPeriod });
  const lrData = trendContext ? linearRegression(normalized, { period: trendPeriod }) : null;

  const filtered: PatternSignal[] = [];

  for (const pattern of patterns) {
    let adjustedConfidence = pattern.confidence;

    // Find the candle index for this pattern's detection time
    const patternIndex = normalized.findIndex((c) => c.time === pattern.time);
    if (patternIndex < 0) continue;

    // 1. ATR ratio filter
    const atrEntry = atrData.find((a) => a.time === pattern.time);
    const currentAtr = atrEntry?.value;

    if (currentAtr != null && currentAtr > 0 && pattern.pattern.height != null) {
      const ratio = pattern.pattern.height / currentAtr;
      if (ratio < minATRRatio) continue; // Reject patterns too small relative to volatility

      // Bonus for large patterns
      if (ratio > minATRRatio * 2) adjustedConfidence += 5;
    }

    // 2. Trend context filter
    if (trendContext && lrData) {
      const lrEntry = lrData.find((l) => l.time === pattern.time);
      const slope = lrEntry?.value?.slope;

      if (slope != null) {
        const isBearishReversal = BEARISH_REVERSAL.includes(pattern.type);
        const isBullishReversal = BULLISH_REVERSAL.includes(pattern.type);

        // Bearish reversal patterns need prior uptrend
        if (isBearishReversal && slope > 0) {
          adjustedConfidence += 10; // Confirming context
        } else if (isBearishReversal && slope < 0) {
          adjustedConfidence -= 10; // Counter-trend, less reliable
        }

        // Bullish reversal patterns need prior downtrend
        if (isBullishReversal && slope < 0) {
          adjustedConfidence += 10;
        } else if (isBullishReversal && slope > 0) {
          adjustedConfidence -= 10;
        }
      }
    }

    // 3. Volume confirmation
    if (volumeConfirm && pattern.confirmed) {
      const valid = validateBreakoutVolume(
        normalized,
        patternIndex,
        volumeLookback,
        minVolumeIncrease,
      );
      if (!valid) {
        adjustedConfidence -= 10;
      } else {
        adjustedConfidence += 5;
      }
    }

    // Apply confidence floor
    adjustedConfidence = Math.max(0, Math.min(100, Math.round(adjustedConfidence)));
    if (adjustedConfidence < minConfidence) continue;

    filtered.push({
      ...pattern,
      confidence: adjustedConfidence,
    });
  }

  return filtered;
}
