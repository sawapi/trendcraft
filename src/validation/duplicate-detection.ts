/**
 * Duplicate timestamp detection for candle data
 *
 * Identifies candles sharing the same timestamp and provides
 * a utility to deduplicate by keeping the last occurrence.
 */

import type { NormalizedCandle } from "../types";
import type { ValidationFinding } from "./types";

/**
 * Detect duplicate timestamps in candle data
 *
 * @param candles - Array of normalized candles
 * @returns Array of validation findings for duplicate timestamps
 *
 * @example
 * ```ts
 * const findings = detectDuplicates(candles);
 * // findings: [{ severity: "error", category: "duplicate", ... }]
 * ```
 */
export function detectDuplicates(
  candles: NormalizedCandle[],
): ValidationFinding[] {
  const seen = new Map<number, number>(); // time -> first index
  const findings: ValidationFinding[] = [];

  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;
    const firstIndex = seen.get(t);

    if (firstIndex !== undefined) {
      findings.push({
        severity: "error",
        category: "duplicate",
        message: `Duplicate timestamp at index ${i} (same as index ${firstIndex})`,
        index: i,
        time: t,
      });
    } else {
      seen.set(t, i);
    }
  }

  return findings;
}

/**
 * Remove duplicate timestamps, keeping the last occurrence
 *
 * @param candles - Array of normalized candles (may contain duplicates)
 * @returns Deduplicated array sorted by time
 *
 * @example
 * ```ts
 * const cleaned = removeDuplicates(candles);
 * // Duplicates removed, last value for each timestamp kept
 * ```
 */
export function removeDuplicates(
  candles: NormalizedCandle[],
): NormalizedCandle[] {
  const map = new Map<number, NormalizedCandle>();

  for (const candle of candles) {
    map.set(candle.time, candle);
  }

  return [...map.values()].sort((a, b) => a.time - b.time);
}
