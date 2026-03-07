/**
 * Outlier detection for candle data
 *
 * Detects OHLC consistency errors, price spikes, and volume anomalies.
 */

import type { NormalizedCandle } from "../types";
import type {
  SpikeDetectionOptions,
  ValidationFinding,
  VolumeAnomalyOptions,
} from "./types";

/**
 * Detect OHLC consistency errors
 *
 * Flags candles where:
 * - high < max(open, close)
 * - low > min(open, close)
 * - high < low
 *
 * @param candles - Array of normalized candles
 * @returns Array of validation findings for OHLC errors
 *
 * @example
 * ```ts
 * const findings = detectOhlcErrors(candles);
 * ```
 */
export function detectOhlcErrors(
  candles: NormalizedCandle[],
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    if (c.high < c.low) {
      findings.push({
        severity: "error",
        category: "ohlc",
        message: `High (${c.high}) < Low (${c.low}) at index ${i}`,
        index: i,
        time: c.time,
      });
    }

    const maxOC = Math.max(c.open, c.close);
    if (c.high < maxOC) {
      findings.push({
        severity: "error",
        category: "ohlc",
        message: `High (${c.high}) < max(Open, Close) (${maxOC}) at index ${i}`,
        index: i,
        time: c.time,
      });
    }

    const minOC = Math.min(c.open, c.close);
    if (c.low > minOC) {
      findings.push({
        severity: "error",
        category: "ohlc",
        message: `Low (${c.low}) > min(Open, Close) (${minOC}) at index ${i}`,
        index: i,
        time: c.time,
      });
    }
  }

  return findings;
}

/**
 * Detect price spikes (abnormally large single-bar price changes)
 *
 * @param candles - Array of normalized candles
 * @param options - Spike detection options
 * @returns Array of validation findings for price spikes
 *
 * @example
 * ```ts
 * const findings = detectPriceSpikes(candles, { maxPriceChangePercent: 20 });
 * ```
 */
export function detectPriceSpikes(
  candles: NormalizedCandle[],
  options?: SpikeDetectionOptions,
): ValidationFinding[] {
  if (candles.length < 2) return [];

  const maxChange = options?.maxPriceChangePercent ?? 20;
  const findings: ValidationFinding[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    if (prev === 0) continue;

    const change = Math.abs(candles[i].close - prev) / Math.abs(prev) * 100;

    if (change > maxChange) {
      findings.push({
        severity: "warning",
        category: "spike",
        message: `Price change of ${change.toFixed(1)}% at index ${i} (${prev} -> ${candles[i].close})`,
        index: i,
        time: candles[i].time,
      });
    }
  }

  return findings;
}

/**
 * Detect volume anomalies using rolling z-score
 *
 * @param candles - Array of normalized candles
 * @param options - Volume anomaly detection options
 * @returns Array of validation findings for volume anomalies
 *
 * @example
 * ```ts
 * const findings = detectVolumeAnomalies(candles, { zScoreThreshold: 4, lookback: 20 });
 * ```
 */
export function detectVolumeAnomalies(
  candles: NormalizedCandle[],
  options?: VolumeAnomalyOptions,
): ValidationFinding[] {
  const threshold = options?.zScoreThreshold ?? 4;
  const lookback = options?.lookback ?? 20;
  const findings: ValidationFinding[] = [];

  for (let i = lookback; i < candles.length; i++) {
    // Calculate mean and std over lookback window
    let sum = 0;
    for (let j = i - lookback; j < i; j++) {
      sum += candles[j].volume;
    }
    const mean = sum / lookback;

    let sumSqDiff = 0;
    for (let j = i - lookback; j < i; j++) {
      const diff = candles[j].volume - mean;
      sumSqDiff += diff * diff;
    }
    const std = Math.sqrt(sumSqDiff / lookback);

    if (std === 0) continue;

    const zScore = (candles[i].volume - mean) / std;

    if (Math.abs(zScore) > threshold) {
      findings.push({
        severity: "warning",
        category: "volume",
        message: `Volume anomaly at index ${i}: volume=${candles[i].volume}, z-score=${zScore.toFixed(2)} (mean=${mean.toFixed(0)})`,
        index: i,
        time: candles[i].time,
      });
    }
  }

  return findings;
}
