/**
 * Benchmark test data generators
 */

import type { NormalizedCandle } from "../types";

/**
 * Generate synthetic candle data for benchmarks
 * @param count - Number of candles to generate
 * @param startPrice - Starting price (default: 100)
 * @param volatility - Daily volatility percentage (default: 2)
 * @returns Array of normalized candles
 */
export function generateCandles(
  count: number,
  startPrice = 100,
  volatility = 2,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS_PER_DAY = 86400000;
  let baseTime = new Date("2020-01-01").getTime();
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2 * (volatility / 100);
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * (volatility / 200));
    const low = Math.min(open, close) * (1 - Math.random() * (volatility / 200));
    const volume = Math.floor(100000 + Math.random() * 900000);

    candles.push({
      time: baseTime,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });

    price = close;
    baseTime += MS_PER_DAY;
  }

  return candles;
}
