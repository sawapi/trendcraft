/**
 * Volume Above Average Detection
 *
 * Detects when volume is above the N-day moving average for consecutive days.
 * This can identify sustained high trading activity.
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Volume above average signal
 */
export type VolumeAboveAverageSignal = {
  /** Timestamp of the detection */
  time: number;
  /** Signal type */
  type: "volume_above_average";
  /** Current volume */
  volume: number;
  /** Average volume over the period */
  averageVolume: number;
  /** Current volume as multiple of average (e.g., 1.5 = 150% of average) */
  ratio: number;
  /** Number of consecutive days volume has been above average */
  consecutiveDays: number;
};

/**
 * Options for volume above average detection
 */
export type VolumeAboveAverageOptions = {
  /** Lookback period for average calculation (default: 20) */
  period?: number;
  /** Minimum ratio of current volume to average (default: 1.0 = at or above average) */
  minRatio?: number;
  /** Minimum consecutive days above average (default: 3) */
  minConsecutiveDays?: number;
};

/**
 * Detect volume above average signals
 *
 * Identifies when volume is consistently above the moving average,
 * indicating sustained high trading activity.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options
 * @returns Array of volume above average signals
 *
 * @example
 * ```ts
 * const signals = volumeAboveAverage(candles, {
 *   period: 20,
 *   minRatio: 1.2,  // 20% above average
 *   minConsecutiveDays: 3
 * });
 *
 * signals.forEach(s => {
 *   console.log(`High volume at ${new Date(s.time)}: ${s.consecutiveDays} days, ${(s.ratio * 100).toFixed(0)}% of avg`);
 * });
 * ```
 */
export function volumeAboveAverage(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeAboveAverageOptions = {},
): VolumeAboveAverageSignal[] {
  const { period = 20, minRatio = 1.0, minConsecutiveDays = 3 } = options;

  if (period < 2) {
    throw new Error("Volume above average period must be at least 2");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length <= period) {
    return [];
  }

  const results: VolumeAboveAverageSignal[] = [];
  let consecutiveDays = 0;

  for (let i = period; i < normalized.length; i++) {
    // Calculate average volume over the lookback period (excluding current day)
    let sum = 0;
    for (let j = i - period; j < i; j++) {
      sum += normalized[j].volume;
    }
    const avgVolume = sum / period;

    const currentVolume = normalized[i].volume;
    const ratio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    // Check if current volume is above average with minimum ratio
    if (ratio >= minRatio) {
      consecutiveDays++;
    } else {
      consecutiveDays = 0;
    }

    // Check if all conditions are met
    if (ratio >= minRatio && consecutiveDays >= minConsecutiveDays) {
      results.push({
        time: normalized[i].time,
        type: "volume_above_average",
        volume: currentVolume,
        averageVolume: avgVolume,
        ratio,
        consecutiveDays,
      });
    }
  }

  return results;
}
