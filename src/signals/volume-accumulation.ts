/**
 * Volume Accumulation Detection
 *
 * Detects when volume is trending upward using linear regression slope.
 * This can identify accumulation phases before significant price moves.
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Volume accumulation signal
 */
export type VolumeAccumulationSignal = {
  /** Timestamp of the detection */
  time: number;
  /** Signal type */
  type: "volume_accumulation";
  /** Current volume */
  volume: number;
  /** Slope of the linear regression (positive = uptrend) */
  slope: number;
  /** Normalized slope (slope / average volume) for comparison */
  normalizedSlope: number;
  /** R-squared value (0-1) indicating trend strength */
  rSquared: number;
  /** Number of consecutive days the trend has been positive */
  consecutiveDays: number;
};

/**
 * Options for volume accumulation detection
 */
export type VolumeAccumulationOptions = {
  /** Lookback period for trend calculation (default: 10) */
  period?: number;
  /** Minimum normalized slope to qualify as signal (default: 0.05 = 5% increase per day) */
  minSlope?: number;
  /** Minimum R-squared for trend significance (default: 0.3) */
  minRSquared?: number;
  /** Minimum consecutive days of positive slope (default: 3) */
  minConsecutiveDays?: number;
};

/**
 * Calculate linear regression slope and R-squared
 */
function linearRegression(values: number[]): { slope: number; rSquared: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, rSquared: 0, intercept: 0 };

  // x = 0, 1, 2, ..., n-1
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
    sumY2 += values[i] * values[i];
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, rSquared: 0, intercept: 0 };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  let ssTotal = 0;
  let ssResidual = 0;

  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssTotal += (values[i] - meanY) ** 2;
    ssResidual += (values[i] - predicted) ** 2;
  }

  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return { slope, rSquared: Math.max(0, rSquared), intercept };
}

/**
 * Detect volume accumulation signals
 *
 * Uses linear regression to identify when volume is consistently increasing,
 * which often precedes significant price movements.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options
 * @returns Array of volume accumulation signals
 *
 * @example
 * ```ts
 * const signals = volumeAccumulation(candles, {
 *   period: 10,
 *   minSlope: 0.05,
 *   minConsecutiveDays: 3
 * });
 *
 * signals.forEach(s => {
 *   console.log(`Volume accumulation at ${new Date(s.time)}: ${s.consecutiveDays} days, R²=${s.rSquared.toFixed(2)}`);
 * });
 * ```
 */
export function volumeAccumulation(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeAccumulationOptions = {},
): VolumeAccumulationSignal[] {
  const {
    period = 10,
    minSlope = 0.05,
    minRSquared = 0.3,
    minConsecutiveDays = 3,
  } = options;

  if (period < 2) {
    throw new Error("Volume accumulation period must be at least 2");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length <= period) {
    return [];
  }

  const results: VolumeAccumulationSignal[] = [];
  let consecutiveDays = 0;

  for (let i = period; i < normalized.length; i++) {
    // Get volume values for the lookback period
    const volumes: number[] = [];
    for (let j = i - period; j <= i; j++) {
      volumes.push(normalized[j].volume);
    }

    const { slope, rSquared } = linearRegression(volumes);

    // Calculate average volume for normalization
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const normalizedSlope = avgVolume > 0 ? slope / avgVolume : 0;

    // Check if slope is positive (uptrend)
    if (normalizedSlope > 0) {
      consecutiveDays++;
    } else {
      consecutiveDays = 0;
    }

    // Check if all conditions are met
    if (
      normalizedSlope >= minSlope &&
      rSquared >= minRSquared &&
      consecutiveDays >= minConsecutiveDays
    ) {
      results.push({
        time: normalized[i].time,
        type: "volume_accumulation",
        volume: normalized[i].volume,
        slope,
        normalizedSlope,
        rSquared,
        consecutiveDays,
      });
    }
  }

  return results;
}
