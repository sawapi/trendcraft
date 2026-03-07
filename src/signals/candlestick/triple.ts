/**
 * Triple candle patterns
 *
 * Morning/Evening Star, Three White Soldiers / Three Black Crows,
 * Three Inside Up / Three Inside Down
 */

import type { NormalizedCandle } from "../../types";
import type { CandlestickPattern, CandlestickPatternOptions } from "./types";
import {
  bodyBottom,
  bodyRatio,
  bodySize,
  bodyTop,
  isBearish,
  isBullish,
  priorTrend,
} from "./utils";

/**
 * Detect all triple-candle patterns ending at the given index
 *
 * Detects: Morning/Evening Star, Three White Soldiers / Three Black Crows,
 * Three Inside Up / Three Inside Down.
 *
 * @example
 * ```ts
 * import { candlestickPatterns, normalizeCandles } from "trendcraft";
 *
 * const candles = normalizeCandles(rawCandles);
 * const patterns = candlestickPatterns(candles, { patterns: ["morning_star", "evening_star"] });
 * const stars = patterns.filter(p => p.value.patterns.length > 0);
 * console.log(`Found ${stars.length} star patterns`);
 * ```
 */
export function detectTriplePatterns(
  candles: NormalizedCandle[],
  index: number,
  options: Required<
    Pick<CandlestickPatternOptions, "dojiThreshold" | "requireTrend" | "trendLookback">
  >,
  allowedPatterns: Set<string> | null,
): CandlestickPattern[] {
  if (index < 2) return [];

  const patterns: CandlestickPattern[] = [];
  const c0 = candles[index - 2];
  const c1 = candles[index - 1];
  const c2 = candles[index];
  const trend = options.requireTrend ? priorTrend(candles, index - 2, options.trendLookback) : 0;

  const allowed = (name: string) => allowedPatterns === null || allowedPatterns.has(name);

  const c0Body = bodySize(c0);
  const c1Body = bodySize(c1);
  const c2Body = bodySize(c2);
  const c1Ratio = bodyRatio(c1);

  // Morning Star: bearish c0, small body c1 (gap down), bullish c2 closing into c0 body
  if (
    allowed("morning_star") &&
    isBearish(c0) &&
    c1Ratio < 0.3 &&
    isBullish(c2) &&
    bodyTop(c1) < bodyBottom(c0) &&
    c2.close > (c0.open + c0.close) / 2 &&
    (!options.requireTrend || trend === -1)
  ) {
    patterns.push({ name: "morning_star", direction: "bullish", confidence: 80, candleCount: 3 });
  }

  // Evening Star: bullish c0, small body c1 (gap up), bearish c2 closing into c0 body
  if (
    allowed("evening_star") &&
    isBullish(c0) &&
    c1Ratio < 0.3 &&
    isBearish(c2) &&
    bodyBottom(c1) > bodyTop(c0) &&
    c2.close < (c0.open + c0.close) / 2 &&
    (!options.requireTrend || trend === 1)
  ) {
    patterns.push({ name: "evening_star", direction: "bearish", confidence: 80, candleCount: 3 });
  }

  // Three White Soldiers: 3 consecutive bullish candles with higher closes, each opening within previous body
  if (
    allowed("three_white_soldiers") &&
    isBullish(c0) &&
    isBullish(c1) &&
    isBullish(c2) &&
    c1.close > c0.close &&
    c2.close > c1.close &&
    c1.open >= c0.open &&
    c1.open <= c0.close &&
    c2.open >= c1.open &&
    c2.open <= c1.close &&
    c0Body > 0 &&
    c1Body > 0 &&
    c2Body > 0
  ) {
    patterns.push({
      name: "three_white_soldiers",
      direction: "bullish",
      confidence: 85,
      candleCount: 3,
    });
  }

  // Three Black Crows: 3 consecutive bearish candles with lower closes, each opening within previous body
  if (
    allowed("three_black_crows") &&
    isBearish(c0) &&
    isBearish(c1) &&
    isBearish(c2) &&
    c1.close < c0.close &&
    c2.close < c1.close &&
    c1.open <= c0.open &&
    c1.open >= c0.close &&
    c2.open <= c1.open &&
    c2.open >= c1.close &&
    c0Body > 0 &&
    c1Body > 0 &&
    c2Body > 0
  ) {
    patterns.push({
      name: "three_black_crows",
      direction: "bearish",
      confidence: 85,
      candleCount: 3,
    });
  }

  // Three Inside Up: bearish c0, bullish c1 inside c0 (harami), bullish c2 closing above c0 open
  if (
    allowed("three_inside_up") &&
    isBearish(c0) &&
    isBullish(c1) &&
    isBullish(c2) &&
    c1Body < c0Body &&
    bodyTop(c1) <= bodyTop(c0) &&
    bodyBottom(c1) >= bodyBottom(c0) &&
    c2.close > c0.open &&
    (!options.requireTrend || trend === -1)
  ) {
    patterns.push({
      name: "three_inside_up",
      direction: "bullish",
      confidence: 75,
      candleCount: 3,
    });
  }

  // Three Inside Down: bullish c0, bearish c1 inside c0 (harami), bearish c2 closing below c0 open
  if (
    allowed("three_inside_down") &&
    isBullish(c0) &&
    isBearish(c1) &&
    isBearish(c2) &&
    c1Body < c0Body &&
    bodyTop(c1) <= bodyTop(c0) &&
    bodyBottom(c1) >= bodyBottom(c0) &&
    c2.close < c0.open &&
    (!options.requireTrend || trend === 1)
  ) {
    patterns.push({
      name: "three_inside_down",
      direction: "bearish",
      confidence: 75,
      candleCount: 3,
    });
  }

  return patterns;
}
