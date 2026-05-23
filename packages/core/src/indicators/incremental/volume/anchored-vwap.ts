/**
 * Incremental Anchored VWAP
 *
 * State category: **Recursive** (cumulative TPV / volume accumulators
 * from a fixed anchor time; no raw-price window to carry forward).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<AnchoredVwapState>` and `fromState` accepts the same.
 *
 * VWAP = Sum(TP * Volume) / Sum(Volume) starting from an anchor time.
 * Optionally includes standard deviation bands.
 *
 * Reconfig policy: any `anchorTime` or `bands` change throws via the
 * resolveResume recursive branch. anchorTime change means a different
 * aggregation window; bands change means a different output shape
 * (upper1/lower1/upper2/lower2 keys appear or disappear). Both are
 * unsafe to silently carry forward.
 *
 * Known limitation (out of scope for this migration): when `bands > 0`,
 * `tpvHistory` grows unboundedly from the anchor onward — it retains
 * per-candle (tp, volume) pairs to compute the volume-weighted variance.
 * Long-running sessions accumulate proportionally to candle count.
 * A future running-variance refactor (Welford / similar) would let us
 * drop the history.
 */

import type { NormalizedCandle } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type AnchoredVwapValue = {
  vwap: number | null;
  upper1?: number | null;
  lower1?: number | null;
  upper2?: number | null;
  lower2?: number | null;
};

/**
 * Bare state shape for Anchored VWAP. Params (`anchorTime`, `bands`)
 * live in `meta.params` on the wire — they are not part of the bare state.
 */
export type AnchoredVwapState = {
  cumTPV: number;
  cumVol: number;
  tpvHistory: { tp: number; volume: number }[];
  isAnchored: boolean;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const ANCHORED_VWAP_VERSION = 1;

type AnchoredVwapParams = {
  anchorTime: number;
  bands: number;
};

/**
 * Create an incremental Anchored VWAP indicator
 *
 * @param options - Configuration options
 * @param options.anchorTime - Timestamp from which to start VWAP calculation (required)
 * @param options.bands - Number of standard deviation bands (0, 1, or 2; default: 0)
 *
 * @example
 * ```ts
 * const avwap = createAnchoredVwap({ anchorTime: 1700000000000, bands: 2 });
 * for (const candle of stream) {
 *   const { value } = avwap.next(candle);
 *   if (value.vwap !== null) console.log(value.vwap, value.upper1, value.lower1);
 * }
 * ```
 */
export function createAnchoredVwap(
  options: { anchorTime?: number; bands?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AnchoredVwapState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<AnchoredVwapValue, IndicatorSnapshot<AnchoredVwapState>> {
  const { params, state } = resolveResume<AnchoredVwapParams, AnchoredVwapState>({
    indicator: "anchoredVwap",
    version: ANCHORED_VWAP_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { bands: 0 }, // `anchorTime` is intentionally absent — no canonical default.
  });

  const anchorTime = requireParam(
    "anchoredVwap",
    params,
    "anchorTime",
    (v): v is number => Number.isFinite(v) && v >= 0,
    "must be a non-negative finite timestamp",
  );
  const bands = requireParam(
    "anchoredVwap",
    params,
    "bands",
    (v): v is number => Number.isInteger(v) && v >= 0 && v <= 2,
    "must be 0, 1, or 2",
  );

  let cumTPV: number;
  let cumVol: number;
  let tpvHistory: { tp: number; volume: number }[];
  let isAnchored: boolean;
  let count: number;

  if (state !== null) {
    cumTPV = state.cumTPV;
    cumVol = state.cumVol;
    // Defensive copy so subsequent next() mutations don't reach back
    // into a snapshot the caller may still hold.
    tpvHistory = state.tpvHistory.map((h) => ({ ...h }));
    isAnchored = state.isAnchored;
    count = state.count;
  } else {
    cumTPV = 0;
    cumVol = 0;
    tpvHistory = [];
    isAnchored = false;
    count = 0;
  }

  function computeValue(): AnchoredVwapValue {
    if (!isAnchored || cumVol === 0) {
      const result: AnchoredVwapValue = { vwap: null };
      if (bands >= 1) {
        result.upper1 = null;
        result.lower1 = null;
      }
      if (bands >= 2) {
        result.upper2 = null;
        result.lower2 = null;
      }
      return result;
    }

    const vwap = cumTPV / cumVol;
    const result: AnchoredVwapValue = { vwap };

    if (bands > 0 && tpvHistory.length > 0) {
      // Calculate volume-weighted standard deviation
      let sumSqDiff = 0;
      for (const entry of tpvHistory) {
        const diff = entry.tp - vwap;
        sumSqDiff += diff * diff * entry.volume;
      }
      const stdDev = Math.sqrt(sumSqDiff / cumVol);

      if (bands >= 1) {
        result.upper1 = vwap + stdDev;
        result.lower1 = vwap - stdDev;
      }
      if (bands >= 2) {
        result.upper2 = vwap + 2 * stdDev;
        result.lower2 = vwap - 2 * stdDev;
      }
    } else if (bands >= 1) {
      result.upper1 = null;
      result.lower1 = null;
      if (bands >= 2) {
        result.upper2 = null;
        result.lower2 = null;
      }
    }

    return result;
  }

  const indicator: IncrementalIndicator<AnchoredVwapValue, IndicatorSnapshot<AnchoredVwapState>> = {
    next(candle: NormalizedCandle) {
      count++;

      if (candle.time >= anchorTime) {
        isAnchored = true;
        const tp = (candle.high + candle.low + candle.close) / 3;
        cumTPV += tp * candle.volume;
        cumVol += candle.volume;
        if (bands > 0) {
          tpvHistory.push({ tp, volume: candle.volume });
        }
      }

      return { time: candle.time, value: computeValue() };
    },

    peek(candle: NormalizedCandle) {
      if (candle.time < anchorTime && !isAnchored) {
        const result: AnchoredVwapValue = { vwap: null };
        if (bands >= 1) {
          result.upper1 = null;
          result.lower1 = null;
        }
        if (bands >= 2) {
          result.upper2 = null;
          result.lower2 = null;
        }
        return { time: candle.time, value: result };
      }

      const tp = (candle.high + candle.low + candle.close) / 3;
      const peekTPV = cumTPV + (candle.time >= anchorTime || isAnchored ? tp * candle.volume : 0);
      const peekVol = cumVol + (candle.time >= anchorTime || isAnchored ? candle.volume : 0);

      if (peekVol === 0) {
        const result: AnchoredVwapValue = { vwap: null };
        if (bands >= 1) {
          result.upper1 = null;
          result.lower1 = null;
        }
        if (bands >= 2) {
          result.upper2 = null;
          result.lower2 = null;
        }
        return { time: candle.time, value: result };
      }

      const vwap = peekTPV / peekVol;
      const result: AnchoredVwapValue = { vwap };

      if (bands > 0) {
        let sumSqDiff = 0;
        for (const entry of tpvHistory) {
          const diff = entry.tp - vwap;
          sumSqDiff += diff * diff * entry.volume;
        }
        if (candle.time >= anchorTime || isAnchored) {
          const diff = tp - vwap;
          sumSqDiff += diff * diff * candle.volume;
        }
        const stdDev = Math.sqrt(sumSqDiff / peekVol);

        if (bands >= 1) {
          result.upper1 = vwap + stdDev;
          result.lower1 = vwap - stdDev;
        }
        if (bands >= 2) {
          result.upper2 = vwap + 2 * stdDev;
          result.lower2 = vwap - 2 * stdDev;
        }
      } else if (bands >= 1) {
        result.upper1 = null;
        result.lower1 = null;
        if (bands >= 2) {
          result.upper2 = null;
          result.lower2 = null;
        }
      }

      return { time: candle.time, value: result };
    },

    getState(): IndicatorSnapshot<AnchoredVwapState> {
      return makeSnapshot(
        "anchoredVwap",
        ANCHORED_VWAP_VERSION,
        { anchorTime, bands },
        {
          cumTPV,
          cumVol,
          // Defensive copy so the caller's snapshot isn't mutated by
          // later next() calls (tpvHistory is pushed in place).
          tpvHistory: tpvHistory.map((h) => ({ ...h })),
          isAnchored,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return isAnchored && cumVol > 0;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
