/**
 * Single candle patterns
 *
 * Hammer, Inverted Hammer, Shooting Star, Hanging Man,
 * Doji, Bullish/Bearish Marubozu, Spinning Top
 */

import type { NormalizedCandle } from "../../types";
import type { CandlestickPattern, CandlestickPatternOptions } from "./types";
import {
  bodyRatio,
  bodySize,
  candleRange,
  isBullish,
  lowerShadow,
  priorTrend,
  upperShadow,
} from "./utils";

/**
 * Detect all single-candle patterns at the given index
 *
 * Detects: Hammer, Inverted Hammer, Shooting Star, Hanging Man,
 * Doji, Bullish/Bearish Marubozu, Spinning Top.
 *
 * @example
 * ```ts
 * import { candlestickPatterns, normalizeCandles } from "trendcraft";
 *
 * const candles = normalizeCandles(rawCandles);
 * const patterns = candlestickPatterns(candles);
 * // Filter single-candle patterns
 * const singles = patterns.filter(p => p.value.patterns.some(pp => pp.candleCount === 1));
 * ```
 */
export function detectSinglePatterns(
  candles: NormalizedCandle[],
  index: number,
  options: Required<
    Pick<
      CandlestickPatternOptions,
      "dojiThreshold" | "marubozuThreshold" | "hammerShadowRatio" | "requireTrend" | "trendLookback"
    >
  >,
  allowedPatterns: Set<string> | null,
): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];
  const c = candles[index];
  const range = candleRange(c);

  if (range === 0) return patterns;

  const br = bodyRatio(c);
  const body = bodySize(c);
  const upper = upperShadow(c);
  const lower = lowerShadow(c);
  const trend = options.requireTrend ? priorTrend(candles, index, options.trendLookback) : 0;

  const allowed = (name: string) => allowedPatterns === null || allowedPatterns.has(name);

  // Doji: very small body relative to range
  // Direction depends on prior trend (reversal signal)
  if (allowed("doji") && br <= options.dojiThreshold) {
    if (!options.requireTrend || trend !== 0) {
      const direction = trend === 1 ? "bearish" : "bullish";
      patterns.push({ name: "doji", direction, confidence: 50, candleCount: 1 });
    }
  }

  // Marubozu: body covers almost entire range
  if (br >= options.marubozuThreshold) {
    if (allowed("bullish_marubozu") && isBullish(c)) {
      patterns.push({
        name: "bullish_marubozu",
        direction: "bullish",
        confidence: 75,
        candleCount: 1,
      });
    }
    if (allowed("bearish_marubozu") && !isBullish(c)) {
      patterns.push({
        name: "bearish_marubozu",
        direction: "bearish",
        confidence: 75,
        candleCount: 1,
      });
    }
  }

  // Spinning Top: small body with both shadows longer than body
  // Direction depends on prior trend (indecision/reversal signal)
  if (
    allowed("spinning_top") &&
    br > options.dojiThreshold &&
    br < 0.4 &&
    upper > body &&
    lower > body
  ) {
    if (!options.requireTrend || trend !== 0) {
      const direction = trend === 1 ? "bearish" : "bullish";
      patterns.push({ name: "spinning_top", direction, confidence: 30, candleCount: 1 });
    }
  }

  // Hammer / Hanging Man: small body at top, long lower shadow, small upper shadow
  if (body > 0 && lower >= body * options.hammerShadowRatio && upper <= body * 0.5) {
    if (allowed("hammer") && (!options.requireTrend || trend === -1)) {
      patterns.push({ name: "hammer", direction: "bullish", confidence: 70, candleCount: 1 });
    }
    if (allowed("hanging_man") && (!options.requireTrend || trend === 1)) {
      patterns.push({ name: "hanging_man", direction: "bearish", confidence: 65, candleCount: 1 });
    }
  }

  // Inverted Hammer / Shooting Star: small body at bottom, long upper shadow, small lower shadow
  if (body > 0 && upper >= body * options.hammerShadowRatio && lower <= body * 0.5) {
    if (allowed("inverted_hammer") && (!options.requireTrend || trend === -1)) {
      patterns.push({
        name: "inverted_hammer",
        direction: "bullish",
        confidence: 60,
        candleCount: 1,
      });
    }
    if (allowed("shooting_star") && (!options.requireTrend || trend === 1)) {
      patterns.push({
        name: "shooting_star",
        direction: "bearish",
        confidence: 70,
        candleCount: 1,
      });
    }
  }

  return patterns;
}
