/**
 * Relative Strength Index (RSI) indicator
 * Uses Wilder's smoothing method
 */

import { normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, RsiOptions, Series } from "../../types";

/**
 * Calculate Relative Strength Index using Wilder's method
 *
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 *
 * Wilder's smoothing:
 * - First average: Simple average of first `period` gains/losses
 * - Subsequent: ((Previous Avg * (period - 1)) + Current Value) / period
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - RSI options (period, default 14)
 * @returns Series of RSI values (0-100, null for insufficient data)
 *
 * @example
 * ```ts
 * const rsi14 = rsi(candles); // Default period 14
 * const rsi7 = rsi(candles, { period: 7 });
 * ```
 */
export function rsi(
  candles: Candle[] | NormalizedCandle[],
  options: RsiOptions = {}
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 1) {
    throw new Error("RSI period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<number | null> = [];

  // Need at least period + 1 candles to calculate first RSI
  if (normalized.length < period + 1) {
    return normalized.map((c) => ({ time: c.time, value: null }));
  }

  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < normalized.length; i++) {
    changes.push(normalized[i].close - normalized[i - 1].close);
  }

  // First candle has no RSI (no previous price)
  result.push({ time: normalized[0].time, value: null });

  // Calculate gains and losses
  const gains: number[] = changes.map((c) => (c > 0 ? c : 0));
  const losses: number[] = changes.map((c) => (c < 0 ? -c : 0));

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < changes.length; i++) {
    if (i < period - 1) {
      // Not enough data yet
      result.push({ time: normalized[i + 1].time, value: null });
    } else if (i === period - 1) {
      // First RSI: simple average of first `period` values
      let sumGain = 0;
      let sumLoss = 0;
      for (let j = 0; j < period; j++) {
        sumGain += gains[j];
        sumLoss += losses[j];
      }
      avgGain = sumGain / period;
      avgLoss = sumLoss / period;

      const rsiValue = calculateRsi(avgGain, avgLoss);
      result.push({ time: normalized[i + 1].time, value: rsiValue });
    } else {
      // Wilder's smoothing
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      const rsiValue = calculateRsi(avgGain, avgLoss);
      result.push({ time: normalized[i + 1].time, value: rsiValue });
    }
  }

  return result;
}

/**
 * Calculate RSI from average gain and loss
 */
function calculateRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100; // No movement = 50, only gains = 100
  }
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
