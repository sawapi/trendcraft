/**
 * Incremental Gap Analysis
 *
 * Detects price gaps between consecutive candles and tracks fill status.
 * A gap occurs when the current open differs from the previous close
 * by more than a configurable percentage threshold.
 *
 * Note: Unlike the batch version which does a retroactive final pass,
 * the incremental version detects gap fills as they occur in subsequent bars.
 * The `filled` field on the gap-creation bar stays false until a later bar fills it.
 *
 * State category: **Mixed** — the `activeGaps` list is shaped by
 * `minGapPercent`: it decides which gaps were ever recorded. Resuming
 * under a different threshold cannot recreate older gaps that were
 * never tracked (or drop ones a fresh run would skip), so a
 * `minGapPercent` change on resume is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type GapValue = {
  /** Gap direction, null if no gap */
  type: "up" | "down" | null;
  /** Gap size as percentage of previous close */
  gapPercent: number;
  /** Fill classification: 'full', 'partial', or 'unfilled' */
  classification: "full" | "partial" | "unfilled" | null;
  /** Whether the gap has been filled */
  filled: boolean;
};

type ActiveGap = {
  type: "up" | "down";
  gapTop: number;
  gapBottom: number;
  prevClose: number;
};

/**
 * Bare state shape for Gap Analysis. The param (`minGapPercent`)
 * lives in `meta.params` on the wire.
 */
export type GapAnalysisState = {
  prevCandle: { high: number; low: number; close: number } | null;
  activeGaps: ActiveGap[];
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const GAP_ANALYSIS_VERSION = 1;

type GapAnalysisParams = {
  minGapPercent: number;
};

const nullValue: GapValue = {
  type: null,
  gapPercent: 0,
  classification: null,
  filled: false,
};

/**
 * Create an incremental Gap Analysis indicator
 *
 * Detects gaps between consecutive candles and tracks fill status over time.
 *
 * @example
 * ```ts
 * const gaps = createGapAnalysis({ minGapPercent: 0.5 });
 * for (const candle of stream) {
 *   const { value } = gaps.next(candle);
 *   if (value.type) {
 *     console.log(`Gap ${value.type}: ${value.gapPercent.toFixed(2)}%`);
 *   }
 * }
 * ```
 */
export function createGapAnalysis(
  options: { minGapPercent?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<GapAnalysisState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<GapValue, IndicatorSnapshot<GapAnalysisState>> {
  const { params, state } = resolveResume<GapAnalysisParams, GapAnalysisState>({
    indicator: "gapAnalysis",
    version: GAP_ANALYSIS_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { minGapPercent: 0.5 },
  });

  const minGapPercent = params.minGapPercent;

  let prevCandle: { high: number; low: number; close: number } | null;
  let activeGaps: ActiveGap[];
  let count: number;

  if (state !== null) {
    prevCandle = state.prevCandle ? { ...state.prevCandle } : null;
    activeGaps = state.activeGaps.map((g) => ({ ...g }));
    count = state.count;
  } else {
    prevCandle = null;
    activeGaps = [];
    count = 0;
  }

  function processBar(
    candle: NormalizedCandle,
    prev: { high: number; low: number; close: number } | null,
    gaps: ActiveGap[],
  ): { value: GapValue; newGap: ActiveGap | null; filledIndices: number[] } {
    if (prev === null) {
      return { value: nullValue, newGap: null, filledIndices: [] };
    }

    // Check for new gap
    let gapType: "up" | "down" | null = null;
    let gapPercent = 0;

    if (prev.close > 0) {
      const diff = candle.open - prev.close;
      gapPercent = (diff / prev.close) * 100;

      if (gapPercent >= minGapPercent) {
        gapType = "up";
      } else if (gapPercent <= -minGapPercent) {
        gapType = "down";
      }
    }

    // Check fills on existing active gaps
    const filledIndices: number[] = [];
    for (let i = 0; i < gaps.length; i++) {
      const g = gaps[i];
      if (g.type === "up" && candle.low <= g.gapBottom) {
        filledIndices.push(i);
      } else if (g.type === "down" && candle.high >= g.gapTop) {
        filledIndices.push(i);
      }
    }

    // Determine classification for the current bar's gap
    let classification: "full" | "partial" | "unfilled" | null = null;
    let filled = false;
    let newGap: ActiveGap | null = null;

    if (gapType !== null) {
      const absPercent = Math.abs(gapPercent);
      if (gapType === "up") {
        // Classification based on open position (matching batch)
        classification = candle.open > prev.high ? "full" : "partial";
        // Check if same bar fills its own gap
        if (candle.low <= prev.close) {
          filled = true;
          classification = "unfilled"; // Same-bar fill reclassified (batch behavior)
        }
        newGap = { type: "up", gapTop: candle.open, gapBottom: prev.close, prevClose: prev.close };
      } else {
        classification = candle.open < prev.low ? "full" : "partial";
        if (candle.high >= prev.close) {
          filled = true;
          classification = "unfilled";
        }
        newGap = {
          type: "down",
          gapTop: prev.close,
          gapBottom: candle.open,
          prevClose: prev.close,
        };
      }

      return {
        value: { type: gapType, gapPercent: absPercent, classification, filled },
        newGap,
        filledIndices,
      };
    }

    return { value: nullValue, newGap: null, filledIndices };
  }

  const indicator: IncrementalIndicator<GapValue, IndicatorSnapshot<GapAnalysisState>> = {
    next(candle: NormalizedCandle) {
      count++;

      const { value, newGap, filledIndices } = processBar(candle, prevCandle, activeGaps);

      // Remove filled gaps (reverse order to keep indices valid)
      for (let i = filledIndices.length - 1; i >= 0; i--) {
        activeGaps.splice(filledIndices[i], 1);
      }

      // Add new unfilled gap
      if (newGap) {
        activeGaps.push(newGap);
      }

      prevCandle = { high: candle.high, low: candle.low, close: candle.close };
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const { value } = processBar(candle, prevCandle, activeGaps);
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<GapAnalysisState> {
      return makeSnapshot(
        "gapAnalysis",
        GAP_ANALYSIS_VERSION,
        { minGapPercent },
        {
          prevCandle: prevCandle ? { ...prevCandle } : null,
          activeGaps: activeGaps.map((g) => ({ ...g })),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 2;
    },
  };

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
