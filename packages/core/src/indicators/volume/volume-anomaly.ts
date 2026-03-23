/**
 * Volume Anomaly Detection
 *
 * Detects abnormal volume spikes that may indicate institutional activity
 * or significant market events.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series, VolumeAnomalyValue } from "../../types";

/**
 * Volume anomaly detection options
 */
export type VolumeAnomalyOptions = {
  /** Moving average period for baseline (default: 20) */
  period?: number;
  /** Threshold multiplier for "high" volume (default: 2.0) */
  highThreshold?: number;
  /** Threshold multiplier for "extreme" volume (default: 3.0) */
  extremeThreshold?: number;
  /** Use Z-score for detection (default: true) */
  useZScore?: boolean;
  /** Z-score threshold for anomaly (default: 2.0 = 2 standard deviations) */
  zScoreThreshold?: number;
};

/**
 * Detect volume anomalies
 *
 * Detection methods:
 * 1. Ratio-based: volume / average volume > threshold
 * 2. Z-score based: (volume - mean) / stddev > threshold
 *
 * Interpretation:
 * - "high" level: Notable spike, worth attention
 * - "extreme" level: Significant event, likely institutional activity
 * - Combine with price action for context (breakout confirmation, capitulation, etc.)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options
 * @returns Series of volume anomaly values
 *
 * @example
 * ```ts
 * const anomalies = volumeAnomaly(candles, { period: 20, highThreshold: 2.0 });
 *
 * // Find days with abnormal volume
 * const highVolumeDays = anomalies.filter(a => a.value.isAnomaly);
 *
 * // Check latest candle
 * const latest = anomalies[anomalies.length - 1];
 * if (latest.value.level === "extreme") {
 *   console.log(`Extreme volume: ${latest.value.ratio.toFixed(2)}x average`);
 * }
 * ```
 */
export function volumeAnomaly(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeAnomalyOptions = {},
): Series<VolumeAnomalyValue> {
  const {
    period = 20,
    highThreshold = 2.0,
    extremeThreshold = 3.0,
    useZScore = true,
    zScoreThreshold = 2.0,
  } = options;

  if (period < 1) {
    throw new Error("Volume anomaly period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<VolumeAnomalyValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const currentVolume = normalized[i].volume;

    if (i < period - 1) {
      // Not enough data for calculation
      result.push({
        time: normalized[i].time,
        value: {
          volume: currentVolume,
          avgVolume: currentVolume,
          ratio: 1,
          isAnomaly: false,
          level: null,
          zScore: null,
        },
      });
      continue;
    }

    // Calculate average and standard deviation over the period
    let sum = 0;
    let sumSq = 0;

    for (let j = 0; j < period; j++) {
      const vol = normalized[i - j].volume;
      sum += vol;
      sumSq += vol * vol;
    }

    const avgVolume = sum / period;
    const variance = sumSq / period - avgVolume * avgVolume;
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Calculate ratio and z-score
    const ratio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const zScore = stdDev > 0 ? (currentVolume - avgVolume) / stdDev : null;

    // Determine anomaly status
    let isAnomaly = false;
    let level: "normal" | "high" | "extreme" | null = "normal";

    // Check ratio-based threshold
    if (ratio >= extremeThreshold) {
      isAnomaly = true;
      level = "extreme";
    } else if (ratio >= highThreshold) {
      isAnomaly = true;
      level = "high";
    }

    // Also check z-score if enabled
    if (useZScore && zScore !== null && zScore >= zScoreThreshold) {
      isAnomaly = true;
      // Upgrade level if z-score indicates extreme
      if (zScore >= zScoreThreshold * 1.5 && level !== "extreme") {
        level = "extreme";
      } else if (level === "normal") {
        level = "high";
      }
    }

    result.push({
      time: normalized[i].time,
      value: {
        volume: currentVolume,
        avgVolume,
        ratio,
        isAnomaly,
        level,
        zScore,
      },
    });
  }

  return tagSeries(result, { pane: "sub", label: "Vol Anomaly" });
}
