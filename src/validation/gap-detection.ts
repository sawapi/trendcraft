/**
 * Gap detection for candle time series
 *
 * Identifies unexpected time gaps in candle data by comparing
 * intervals against the median expected interval.
 */

import type { NormalizedCandle } from "../types";
import type { GapDetectionOptions, ValidationFinding } from "./types";

/**
 * Detect time gaps in candle data
 *
 * Estimates the expected interval from the median of time differences,
 * then flags any gap that exceeds `expectedInterval * maxGapMultiplier`.
 *
 * @param candles - Sorted array of normalized candles
 * @param options - Gap detection options
 * @returns Array of validation findings for detected gaps
 *
 * @example
 * ```ts
 * const findings = detectGaps(candles, { maxGapMultiplier: 3, skipWeekends: true });
 * // findings: [{ severity: "warning", category: "gap", message: "..." }]
 * ```
 */
export function detectGaps(
  candles: NormalizedCandle[],
  options?: GapDetectionOptions,
): ValidationFinding[] {
  if (candles.length < 2) return [];

  const maxGapMultiplier = options?.maxGapMultiplier ?? 3;
  const skipWeekends = options?.skipWeekends ?? true;

  // Calculate all time differences
  const diffs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    diffs.push(candles[i].time - candles[i - 1].time);
  }

  // Estimate expected interval from median
  const sorted = [...diffs].sort((a, b) => a - b);
  const expectedInterval = sorted[Math.floor(sorted.length / 2)];

  if (expectedInterval <= 0) return [];

  const threshold = expectedInterval * maxGapMultiplier;
  const findings: ValidationFinding[] = [];

  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].time - candles[i - 1].time;

    if (diff <= threshold) continue;

    // Skip weekend gaps if enabled
    if (skipWeekends && isWeekendGap(candles[i - 1].time, candles[i].time)) {
      continue;
    }

    findings.push({
      severity: "warning",
      category: "gap",
      message: `Time gap of ${formatDuration(diff)} between index ${i - 1} and ${i} (expected ~${formatDuration(expectedInterval)})`,
      index: i,
      time: candles[i].time,
    });
  }

  return findings;
}

/**
 * Check if a gap spans only weekend days (Friday close to Monday open).
 * Returns true if the gap starts on Friday/Saturday and ends on Sunday/Monday.
 */
function isWeekendGap(startTime: number, endTime: number): boolean {
  const startDay = new Date(startTime).getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
  const endDay = new Date(endTime).getUTCDay();

  // Friday -> Monday (or any combination spanning the weekend)
  return (startDay === 5 || startDay === 6) && (endDay === 0 || endDay === 1);
}

/** Format milliseconds as a human-readable duration */
function formatDuration(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}
