/**
 * Stale data detection for candle data
 *
 * Identifies sequences of consecutive bars with identical close prices,
 * which may indicate frozen or stale data feeds.
 */

import type { NormalizedCandle } from "../types";
import type { StaleDetectionOptions, ValidationFinding } from "./types";

/**
 * Detect stale/frozen data (same close price for multiple consecutive bars)
 *
 * @param candles - Array of normalized candles
 * @param options - Stale detection options
 * @returns Array of validation findings for stale data
 *
 * @example
 * ```ts
 * const findings = detectStaleData(candles, { minConsecutive: 5 });
 * // findings: [{ severity: "warning", category: "stale", ... }]
 * ```
 */
export function detectStaleData(
  candles: NormalizedCandle[],
  options?: StaleDetectionOptions,
): ValidationFinding[] {
  if (candles.length < 2) return [];

  const minConsecutive = options?.minConsecutive ?? 5;
  const findings: ValidationFinding[] = [];

  let streakStart = 0;
  let streakCount = 1;

  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close === candles[i - 1].close) {
      streakCount++;
    } else {
      if (streakCount >= minConsecutive) {
        findings.push({
          severity: "warning",
          category: "stale",
          message: `Stale data: ${streakCount} consecutive bars with close=${candles[streakStart].close} from index ${streakStart} to ${i - 1}`,
          index: streakStart,
          time: candles[streakStart].time,
        });
      }
      streakStart = i;
      streakCount = 1;
    }
  }

  // Check final streak
  if (streakCount >= minConsecutive) {
    findings.push({
      severity: "warning",
      category: "stale",
      message: `Stale data: ${streakCount} consecutive bars with close=${candles[streakStart].close} from index ${streakStart} to ${candles.length - 1}`,
      index: streakStart,
      time: candles[streakStart].time,
    });
  }

  return findings;
}
