/**
 * Incremental Anchored VWAP
 *
 * VWAP = Sum(TP * Volume) / Sum(Volume) starting from an anchor time.
 * Optionally includes standard deviation bands.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type AnchoredVwapValue = {
  vwap: number | null;
  upper1?: number | null;
  lower1?: number | null;
  upper2?: number | null;
  lower2?: number | null;
};

export type AnchoredVwapState = {
  anchorTime: number;
  bands: number;
  cumTPV: number;
  cumVol: number;
  tpvHistory: { tp: number; volume: number }[];
  isAnchored: boolean;
  count: number;
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
  options: { anchorTime: number; bands?: number },
  warmUpOptions?: WarmUpOptions<AnchoredVwapState>,
): IncrementalIndicator<AnchoredVwapValue, AnchoredVwapState> {
  const anchorTime = options.anchorTime;
  const bands = options.bands ?? 0;

  let cumTPV: number;
  let cumVol: number;
  let tpvHistory: { tp: number; volume: number }[];
  let isAnchored: boolean;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    cumTPV = s.cumTPV;
    cumVol = s.cumVol;
    tpvHistory = s.tpvHistory.map((h) => ({ ...h }));
    isAnchored = s.isAnchored;
    count = s.count;
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

  const indicator: IncrementalIndicator<AnchoredVwapValue, AnchoredVwapState> = {
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

    getState(): AnchoredVwapState {
      return {
        anchorTime,
        bands,
        cumTPV,
        cumVol,
        tpvHistory: tpvHistory.map((h) => ({ ...h })),
        isAnchored,
        count,
      };
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
