/**
 * Bollinger Band Squeeze Detection
 * Detects periods of low volatility (squeeze) that often precede large price movements
 */

import { normalizeCandles } from "../core/normalize";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Squeeze signal type
 */
export type SqueezeSignal = {
  /** Timestamp of the squeeze detection */
  time: number;
  /** Signal type */
  type: "squeeze";
  /** Bandwidth at detection (upper - lower) / middle */
  bandwidth: number;
  /** Percentile rank of bandwidth in lookback period (0-100, lower = tighter squeeze) */
  percentile: number;
};

/**
 * Options for squeeze detection
 */
export type SqueezeOptions = {
  /** Bollinger Bands period (default: 20) */
  period?: number;
  /** Standard deviation multiplier (default: 2) */
  stdDev?: number;
  /** Lookback period for percentile calculation (default: 120) */
  lookback?: number;
  /** Percentile threshold for squeeze detection (default: 5, meaning bottom 5%) */
  threshold?: number;
};

/**
 * Detect Bollinger Band squeeze signals
 *
 * A squeeze occurs when bandwidth (volatility) contracts to historically low levels.
 * This often precedes a significant price breakout in either direction.
 *
 * @param candles - Array of candles
 * @param options - Detection options
 * @returns Array of squeeze signals
 *
 * @example
 * ```ts
 * const signals = bollingerSqueeze(candles);
 * // Signals indicate periods of low volatility
 * // Watch for breakout direction after squeeze
 * ```
 */
export function bollingerSqueeze(
  candles: Candle[] | NormalizedCandle[],
  options: SqueezeOptions = {}
): SqueezeSignal[] {
  const {
    period = 20,
    stdDev = 2,
    lookback = 120,
    threshold = 5,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Need enough data for Bollinger Bands + lookback
  if (normalized.length < period + lookback) return [];

  const bbData = bollingerBands(normalized, { period, stdDev });
  const results: SqueezeSignal[] = [];

  // Calculate bandwidth for each point
  const bandwidths: (number | null)[] = bbData.map((d) => {
    const { upper, lower, middle } = d.value;
    if (upper === null || lower === null || middle === null || middle === 0) {
      return null;
    }
    return (upper - lower) / middle;
  });

  // Detect squeeze at each point
  for (let i = lookback; i < bandwidths.length; i++) {
    const currentBw = bandwidths[i];
    if (currentBw === null) continue;

    // Get valid bandwidths in lookback period
    const lookbackBws: number[] = [];
    for (let j = i - lookback; j < i; j++) {
      const bw = bandwidths[j];
      if (bw !== null) {
        lookbackBws.push(bw);
      }
    }

    if (lookbackBws.length < lookback * 0.5) continue; // Need at least 50% valid data

    // Calculate percentile rank
    const sorted = [...lookbackBws].sort((a, b) => a - b);
    const rank = sorted.filter((bw) => bw < currentBw).length;
    const percentile = (rank / sorted.length) * 100;

    // Check if in squeeze (below threshold percentile)
    if (percentile <= threshold) {
      // Avoid consecutive signals - only signal on first detection
      const prevSignal = results[results.length - 1];
      const prevIdx = prevSignal
        ? normalized.findIndex((c) => c.time === prevSignal.time)
        : -10;

      // Only add if at least 5 bars since last squeeze signal
      if (i - prevIdx >= 5) {
        results.push({
          time: normalized[i].time,
          type: "squeeze",
          bandwidth: currentBw,
          percentile,
        });
      }
    }
  }

  return results;
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
