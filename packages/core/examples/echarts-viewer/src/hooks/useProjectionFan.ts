/**
 * Hook to compute projection fan series for pattern replay
 */

import { useMemo } from "react";
import type { NormalizedCandle, PatternSignal } from "trendcraft";
import { projectFromPatterns } from "trendcraft";
import type { SeriesItem } from "../utils/chartColors";
import { createProjectionFanSeries } from "../utils/markers/projectionFanMarkers";

/** Bearish pattern types */
const BEARISH_PATTERNS = new Set(["double_top", "head_shoulders"]);

/**
 * Compute projection fan ECharts series for a replaying pattern
 */
export function useProjectionFan(
  pattern: PatternSignal | null,
  allPatterns: PatternSignal[] | null,
  candles: NormalizedCandle[],
  replayEndIndex: number | null,
): SeriesItem[] {
  return useMemo(() => {
    if (!pattern || !allPatterns || !candles.length || replayEndIndex === null) {
      return [];
    }

    // Find same-type patterns for projection
    const sameType = allPatterns.filter((p) => p.type === pattern.type);
    if (sameType.length === 0) return [];

    const projection = projectFromPatterns(candles, sameType, { horizon: 20 });
    if (projection.validCount === 0) return [];

    // Find pattern end index
    const timeToIndex = new Map<number, number>();
    candles.forEach((c, i) => timeToIndex.set(c.time, i));
    const patternEndIndex = timeToIndex.get(pattern.pattern.endTime);
    if (patternEndIndex === undefined) return [];

    const basePrice = candles[patternEndIndex].close;
    const bullish = !BEARISH_PATTERNS.has(pattern.type);

    const dates = candles.map((c) => {
      const d = new Date(c.time);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    });

    return createProjectionFanSeries(
      projection,
      basePrice,
      patternEndIndex + 1,
      dates,
      bullish,
      replayEndIndex,
      patternEndIndex,
    );
  }, [pattern, allPatterns, candles, replayEndIndex]);
}
