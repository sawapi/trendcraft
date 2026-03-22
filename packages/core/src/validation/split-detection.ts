/**
 * Stock split hint detection for candle data
 *
 * Identifies potential stock splits by looking for large overnight
 * price changes that are close to common split ratios.
 */

import type { NormalizedCandle } from "../types";
import type { ValidationFinding } from "./types";

/**
 * Common split ratios and their labels.
 * Includes both forward splits (e.g., 2:1) and reverse splits (e.g., 1:2).
 */
const SPLIT_RATIOS: { ratio: number; label: string }[] = [
  { ratio: 0.5, label: "2:1 split" },
  { ratio: 1 / 3, label: "3:1 split" },
  { ratio: 0.25, label: "4:1 split" },
  { ratio: 0.2, label: "5:1 split" },
  { ratio: 0.1, label: "10:1 split" },
  { ratio: 2, label: "1:2 reverse split" },
  { ratio: 3, label: "1:3 reverse split" },
  { ratio: 4, label: "1:4 reverse split" },
  { ratio: 5, label: "1:5 reverse split" },
  { ratio: 10, label: "1:10 reverse split" },
];

/** Tolerance for matching split ratios (5%) */
const RATIO_TOLERANCE = 0.05;

/**
 * Detect potential stock split hints
 *
 * Looks for large overnight price changes that match common split ratios
 * (1/2, 1/3, 1/4, 1/5, 1/10 and their inverses).
 *
 * @param candles - Array of normalized candles
 * @returns Array of validation findings for suspected splits
 *
 * @example
 * ```ts
 * const findings = detectSplitHints(candles);
 * // findings: [{ severity: "info", category: "split", message: "Possible 2:1 split ..." }]
 * ```
 */
export function detectSplitHints(candles: NormalizedCandle[]): ValidationFinding[] {
  if (candles.length < 2) return [];

  const findings: ValidationFinding[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    if (prevClose === 0) continue;

    // Ratio of current open (or close) to previous close
    const ratio = candles[i].close / prevClose;

    for (const sr of SPLIT_RATIOS) {
      const relativeError = Math.abs(ratio - sr.ratio) / sr.ratio;
      if (relativeError <= RATIO_TOLERANCE) {
        findings.push({
          severity: "info",
          category: "split",
          message: `Possible ${sr.label} at index ${i}: price ${prevClose} -> ${candles[i].close} (ratio ${ratio.toFixed(4)})`,
          index: i,
          time: candles[i].time,
        });
        break; // Only report the closest match
      }
    }
  }

  return findings;
}
