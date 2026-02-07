/**
 * Double candle patterns
 *
 * Bullish/Bearish Engulfing, Bullish/Bearish Harami,
 * Tweezer Top/Bottom, Piercing Line, Dark Cloud Cover
 */

import type { NormalizedCandle } from "../../types";
import type { CandlestickPattern, CandlestickPatternOptions } from "./types";
import {
  bodyBottom,
  bodyMidpoint,
  bodySize,
  bodyTop,
  isBearish,
  isBullish,
  priorTrend,
} from "./utils";

/**
 * Detect all double-candle patterns ending at the given index
 */
export function detectDoublePatterns(
  candles: NormalizedCandle[],
  index: number,
  options: Required<Pick<CandlestickPatternOptions, "requireTrend" | "trendLookback">>,
  allowedPatterns: Set<string> | null,
): CandlestickPattern[] {
  if (index < 1) return [];

  const patterns: CandlestickPattern[] = [];
  const prev = candles[index - 1];
  const curr = candles[index];
  const trend = options.requireTrend ? priorTrend(candles, index - 1, options.trendLookback) : 0;

  const allowed = (name: string) => allowedPatterns === null || allowedPatterns.has(name);

  const prevBody = bodySize(prev);
  const currBody = bodySize(curr);
  const prevTop = bodyTop(prev);
  const prevBottom = bodyBottom(prev);
  const currTop = bodyTop(curr);
  const currBottom = bodyBottom(curr);

  // Bullish Engulfing: bearish prev, bullish curr that fully engulfs prev body
  if (
    allowed("bullish_engulfing") &&
    isBearish(prev) &&
    isBullish(curr) &&
    currTop > prevTop &&
    currBottom < prevBottom &&
    (!options.requireTrend || trend === -1)
  ) {
    patterns.push({
      name: "bullish_engulfing",
      direction: "bullish",
      confidence: 80,
      candleCount: 2,
    });
  }

  // Bearish Engulfing: bullish prev, bearish curr that fully engulfs prev body
  if (
    allowed("bearish_engulfing") &&
    isBullish(prev) &&
    isBearish(curr) &&
    currTop > prevTop &&
    currBottom < prevBottom &&
    (!options.requireTrend || trend === 1)
  ) {
    patterns.push({
      name: "bearish_engulfing",
      direction: "bearish",
      confidence: 80,
      candleCount: 2,
    });
  }

  // Bullish Harami: bearish prev with large body, small bullish curr inside prev body
  if (
    allowed("bullish_harami") &&
    isBearish(prev) &&
    isBullish(curr) &&
    currBody < prevBody &&
    currTop <= prevTop &&
    currBottom >= prevBottom &&
    (!options.requireTrend || trend === -1)
  ) {
    patterns.push({ name: "bullish_harami", direction: "bullish", confidence: 60, candleCount: 2 });
  }

  // Bearish Harami: bullish prev with large body, small bearish curr inside prev body
  if (
    allowed("bearish_harami") &&
    isBullish(prev) &&
    isBearish(curr) &&
    currBody < prevBody &&
    currTop <= prevTop &&
    currBottom >= prevBottom &&
    (!options.requireTrend || trend === 1)
  ) {
    patterns.push({ name: "bearish_harami", direction: "bearish", confidence: 60, candleCount: 2 });
  }

  // Tweezer Top: both candles have similar highs, first bullish, second bearish, in uptrend
  const highTol = prev.high * 0.001;
  if (
    allowed("tweezer_top") &&
    Math.abs(prev.high - curr.high) <= highTol &&
    isBullish(prev) &&
    isBearish(curr) &&
    (!options.requireTrend || trend === 1)
  ) {
    patterns.push({ name: "tweezer_top", direction: "bearish", confidence: 65, candleCount: 2 });
  }

  // Tweezer Bottom: both candles have similar lows, first bearish, second bullish, in downtrend
  const lowTol = prev.low * 0.001;
  if (
    allowed("tweezer_bottom") &&
    Math.abs(prev.low - curr.low) <= lowTol &&
    isBearish(prev) &&
    isBullish(curr) &&
    (!options.requireTrend || trend === -1)
  ) {
    patterns.push({ name: "tweezer_bottom", direction: "bullish", confidence: 65, candleCount: 2 });
  }

  // Piercing Line: bearish prev, bullish curr opens below prev low, closes above prev midpoint
  if (
    allowed("piercing_line") &&
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.low &&
    curr.close > bodyMidpoint(prev) &&
    curr.close < prevTop &&
    (!options.requireTrend || trend === -1)
  ) {
    patterns.push({ name: "piercing_line", direction: "bullish", confidence: 70, candleCount: 2 });
  }

  // Dark Cloud Cover: bullish prev, bearish curr opens above prev high, closes below prev midpoint
  if (
    allowed("dark_cloud_cover") &&
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.high &&
    curr.close < bodyMidpoint(prev) &&
    curr.close > prevBottom &&
    (!options.requireTrend || trend === 1)
  ) {
    patterns.push({
      name: "dark_cloud_cover",
      direction: "bearish",
      confidence: 70,
      candleCount: 2,
    });
  }

  return patterns;
}
