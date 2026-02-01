/**
 * Hook for calculating signal data (Perfect Order, Range-Bound, Cross)
 */

import { useMemo } from "react";
import {
  perfectOrderEnhanced,
  rangeBound,
  validateCrossSignals,
  type NormalizedCandle,
  type PerfectOrderValueEnhanced,
  type RangeBoundValue,
  type CrossSignalQuality,
  type Series,
} from "trendcraft";
import type { SignalType } from "../types";

export interface SignalData {
  perfectOrder: Series<PerfectOrderValueEnhanced> | null;
  rangeBound: Series<RangeBoundValue> | null;
  crossSignals: CrossSignalQuality[] | null;
}

/**
 * Calculate signals for enabled signal types
 */
export function useSignals(
  candles: NormalizedCandle[],
  enabledSignals: SignalType[]
): SignalData {
  const perfectOrder = useMemo(() => {
    if (!enabledSignals.includes("perfectOrder") || candles.length === 0) {
      return null;
    }
    return perfectOrderEnhanced(candles, {
      enhanced: true,
      periods: [5, 25, 75],
      persistBars: 3,
      collapseEps: 0.015,
    });
  }, [candles, enabledSignals]);

  const rangeBoundData = useMemo(() => {
    if (!enabledSignals.includes("rangeBound") || candles.length === 0) {
      return null;
    }
    return rangeBound(candles, {
      lookbackPeriod: 100,
      atrPeriod: 14,
      rangeScoreThreshold: 70,
      tightRangeThreshold: 85,
      persistBars: 3,
    });
  }, [candles, enabledSignals]);

  const crossSignals = useMemo(() => {
    if (!enabledSignals.includes("cross") || candles.length === 0) {
      return null;
    }
    return validateCrossSignals(candles, {
      short: 5,
      long: 25,
      volumeMaPeriod: 20,
      trendPeriod: 5,
    });
  }, [candles, enabledSignals]);

  return {
    perfectOrder,
    rangeBound: rangeBoundData,
    crossSignals,
  };
}
