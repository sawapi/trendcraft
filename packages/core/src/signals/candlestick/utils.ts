/**
 * Utility functions for candlestick pattern analysis
 */

import type { NormalizedCandle } from "../../types";

/**
 * Body size (absolute difference between open and close)
 */
export function bodySize(c: NormalizedCandle): number {
  return Math.abs(c.close - c.open);
}

/**
 * Full candle range (high - low)
 */
export function candleRange(c: NormalizedCandle): number {
  return c.high - c.low;
}

/**
 * Body ratio: body size / candle range (0-1)
 * Returns 0 if range is 0 (flat candle)
 */
export function bodyRatio(c: NormalizedCandle): number {
  const range = candleRange(c);
  return range === 0 ? 0 : bodySize(c) / range;
}

/**
 * Upper shadow size
 */
export function upperShadow(c: NormalizedCandle): number {
  return c.high - Math.max(c.open, c.close);
}

/**
 * Lower shadow size
 */
export function lowerShadow(c: NormalizedCandle): number {
  return Math.min(c.open, c.close) - c.low;
}

/**
 * Whether the candle is bullish (close >= open)
 */
export function isBullish(c: NormalizedCandle): boolean {
  return c.close >= c.open;
}

/**
 * Whether the candle is bearish (close < open)
 */
export function isBearish(c: NormalizedCandle): boolean {
  return c.close < c.open;
}

/**
 * Determine prior trend direction by comparing current close to lookback close
 * Returns 1 for uptrend, -1 for downtrend, 0 for flat
 */
export function priorTrend(
  candles: NormalizedCandle[],
  index: number,
  lookback: number,
): 1 | -1 | 0 {
  if (index < lookback) return 0;
  const current = candles[index].close;
  const past = candles[index - lookback].close;
  if (current > past) return 1;
  if (current < past) return -1;
  return 0;
}

/**
 * Candle midpoint of body
 */
export function bodyMidpoint(c: NormalizedCandle): number {
  return (c.open + c.close) / 2;
}

/**
 * Body top (higher of open and close)
 */
export function bodyTop(c: NormalizedCandle): number {
  return Math.max(c.open, c.close);
}

/**
 * Body bottom (lower of open and close)
 */
export function bodyBottom(c: NormalizedCandle): number {
  return Math.min(c.open, c.close);
}
