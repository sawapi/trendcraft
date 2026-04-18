/**
 * Gap Analysis indicator
 *
 * Detects and classifies price gaps (gap up / gap down) between consecutive candles.
 * Tracks whether gaps are filled during subsequent price action.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Gap Analysis options
 */
export type GapAnalysisOptions = {
  /** Minimum gap percentage to qualify as a gap (default: 0.5%) */
  minGapPercent?: number;
};

/**
 * Gap value
 */
export type GapValue = {
  /** Gap direction: 'up', 'down', or null if no gap */
  type: "up" | "down" | null;
  /** Gap size as a percentage of previous close */
  gapPercent: number;
  /** Gap classification based on fill status */
  classification: "full" | "partial" | "unfilled" | null;
  /** Whether the gap has been completely filled */
  filled: boolean;
};

/**
 * Calculate Gap Analysis
 *
 * Gap Up: Current Open > Previous High
 * Gap Down: Current Open < Previous Low
 *
 * Classification:
 * - Full gap: Open beyond previous High/Low (true gap)
 * - Partial gap: Open beyond previous Close but not beyond High/Low
 *
 * Fill tracking:
 * - A gap up is filled when price trades back down to the previous close
 * - A gap down is filled when price trades back up to the previous close
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Gap Analysis options
 * @returns Series of gap values
 *
 * @example
 * ```ts
 * const gaps = gapAnalysis(candles);
 * const gaps2 = gapAnalysis(candles, { minGapPercent: 1.0 }); // Only gaps >= 1%
 * ```
 */
export function gapAnalysis(
  candles: Candle[] | NormalizedCandle[],
  options: GapAnalysisOptions = {},
): Series<GapValue> {
  const { minGapPercent = 0.5 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<GapValue> = [];

  // Track active gaps for fill detection
  // Each gap stores: { type, prevClose, gapIndex }
  const activeGaps: Array<{
    type: "up" | "down";
    prevClose: number;
    gapIndex: number;
    filled: boolean;
  }> = [];

  // First candle — no gap possible
  result.push({
    time: normalized[0].time,
    value: { type: null, gapPercent: 0, classification: null, filled: false },
  });

  for (let i = 1; i < normalized.length; i++) {
    const current = normalized[i];
    const prev = normalized[i - 1];

    const gapPct = prev.close !== 0 ? ((current.open - prev.close) / prev.close) * 100 : 0;
    const absGapPct = Math.abs(gapPct);

    let type: "up" | "down" | null = null;
    let classification: "full" | "partial" | "unfilled" | null = null;

    if (absGapPct >= minGapPercent) {
      if (current.open > prev.close) {
        type = "up";
        classification = current.open > prev.high ? "full" : "partial";
        activeGaps.push({ type: "up", prevClose: prev.close, gapIndex: i, filled: false });
      } else if (current.open < prev.close) {
        type = "down";
        classification = current.open < prev.low ? "full" : "partial";
        activeGaps.push({ type: "down", prevClose: prev.close, gapIndex: i, filled: false });
      }
    }

    // Check for gap fills
    for (const gap of activeGaps) {
      if (gap.filled) continue;

      if (gap.type === "up" && current.low <= gap.prevClose) {
        gap.filled = true;
      } else if (gap.type === "down" && current.high >= gap.prevClose) {
        gap.filled = true;
      }
    }

    // Determine fill status for this bar's gap (if any)
    let filled = false;
    if (type !== null) {
      // Check if the current candle itself fills its own gap
      const thisGap = activeGaps[activeGaps.length - 1];
      filled = thisGap.filled;
      if (filled) {
        classification = "unfilled"; // Reclassify — if filled same bar, mark as unfilled since it was immediately reclaimed
      }
    }

    result.push({
      time: current.time,
      value: {
        type,
        gapPercent: type !== null ? absGapPct : 0,
        classification: type !== null ? classification : null,
        filled,
      },
    });
  }

  // Final pass: update fill status for all gap bars based on subsequent price action
  for (const gap of activeGaps) {
    if (gap.filled && gap.gapIndex < result.length) {
      result[gap.gapIndex].value.filled = true;
    }
  }

  return tagSeries(result, { kind: "gapAnalysis", overlay: true, label: "Gap" });
}
