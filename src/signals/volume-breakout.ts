/**
 * Volume Breakout Detection
 *
 * Detects when current volume exceeds the highest volume over a lookback period,
 * indicating potential institutional activity or significant market events.
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Volume breakout signal
 */
export type VolumeBreakoutSignal = {
  /** Timestamp of the breakout detection */
  time: number;
  /** Signal type */
  type: "breakout";
  /** Current volume */
  volume: number;
  /** Previous highest volume in the lookback period */
  previousHigh: number;
  /** Ratio of current volume to previous high (volume / previousHigh) */
  ratio: number;
};

/**
 * Options for volume breakout detection
 */
export type VolumeBreakoutOptions = {
  /** Lookback period for highest volume (default: 20) */
  period?: number;
  /** Minimum breakout ratio to qualify as signal (default: 1.0, meaning any breakout) */
  minRatio?: number;
};

/**
 * Detect volume breakout signals
 *
 * A breakout occurs when the current candle's volume exceeds the highest
 * volume over the previous N periods. This often indicates:
 * - Institutional accumulation/distribution
 * - Significant news or events
 * - Potential trend reversals or continuations
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options
 * @returns Array of volume breakout signals
 *
 * @example
 * ```ts
 * const signals = volumeBreakout(candles, { period: 20 });
 *
 * // Signals only at breakout points
 * signals.forEach(s => {
 *   console.log(`Breakout at ${new Date(s.time)}: ${s.ratio.toFixed(2)}x previous high`);
 * });
 * ```
 */
export function volumeBreakout(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeBreakoutOptions = {},
): VolumeBreakoutSignal[] {
  const { period = 20, minRatio = 1.0 } = options;

  if (period < 1) {
    throw new Error("Volume breakout period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length <= period) {
    return [];
  }

  const results: VolumeBreakoutSignal[] = [];

  for (let i = period; i < normalized.length; i++) {
    const currentVolume = normalized[i].volume;

    // Find highest volume in the lookback period (excluding current candle)
    let highestVolume = 0;
    for (let j = i - period; j < i; j++) {
      if (normalized[j].volume > highestVolume) {
        highestVolume = normalized[j].volume;
      }
    }

    // Check if current volume breaks the previous high
    if (highestVolume > 0 && currentVolume > highestVolume) {
      const ratio = currentVolume / highestVolume;

      if (ratio >= minRatio) {
        results.push({
          time: normalized[i].time,
          type: "breakout",
          volume: currentVolume,
          previousHigh: highestVolume,
          ratio,
        });
      }
    }
  }

  return results;
}
