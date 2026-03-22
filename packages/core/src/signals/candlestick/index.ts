/**
 * Candlestick Pattern Recognition
 *
 * Detects 20 common candlestick patterns in a single O(n) pass:
 * - 8 single-candle patterns
 * - 6 double-candle patterns
 * - 6 triple-candle patterns
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { detectDoublePatterns } from "./double";
import { detectSinglePatterns } from "./single";
import { detectTriplePatterns } from "./triple";
import type {
  CandlestickPatternName,
  CandlestickPatternOptions,
  CandlestickPatternValue,
} from "./types";

export type {
  CandlestickPattern,
  CandlestickPatternName,
  CandlestickPatternOptions,
  CandlestickPatternValue,
} from "./types";

/**
 * Detect candlestick patterns across all candles
 *
 * Scans each bar for single, double, and triple candle patterns in one pass.
 * Multiple patterns can be detected at the same bar.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options (thresholds, trend requirements, pattern filter)
 * @returns Series of pattern detection results
 *
 * @example
 * ```ts
 * const patterns = candlestickPatterns(candles);
 * const bullishBars = patterns.filter(p => p.value.hasBullish);
 *
 * // Detect only hammer and engulfing patterns
 * const filtered = candlestickPatterns(candles, {
 *   patterns: ["hammer", "bullish_engulfing", "bearish_engulfing"],
 * });
 * ```
 */
export function candlestickPatterns(
  candles: Candle[] | NormalizedCandle[],
  options: CandlestickPatternOptions = {},
): Series<CandlestickPatternValue> {
  const {
    dojiThreshold = 0.05,
    marubozuThreshold = 0.95,
    hammerShadowRatio = 2,
    requireTrend = true,
    trendLookback = 5,
    patterns: patternFilter,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<CandlestickPatternValue> = [];
  const allowedPatterns = patternFilter ? new Set<string>(patternFilter) : null;

  const singleOpts = {
    dojiThreshold,
    marubozuThreshold,
    hammerShadowRatio,
    requireTrend,
    trendLookback,
  };
  const doubleOpts = { requireTrend, trendLookback };
  const tripleOpts = { dojiThreshold, requireTrend, trendLookback };

  for (let i = 0; i < normalized.length; i++) {
    const detected = [
      ...detectSinglePatterns(normalized, i, singleOpts, allowedPatterns),
      ...detectDoublePatterns(normalized, i, doubleOpts, allowedPatterns),
      ...detectTriplePatterns(normalized, i, tripleOpts, allowedPatterns),
    ];

    result.push({
      time: normalized[i].time,
      value: {
        patterns: detected,
        hasBullish: detected.some((p) => p.direction === "bullish"),
        hasBearish: detected.some((p) => p.direction === "bearish"),
      },
    });
  }

  return result;
}
