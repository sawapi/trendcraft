/**
 * Hook for calculating signal data (Perfect Order, Range-Bound, Cross, Divergence, BB Squeeze)
 */

import { useMemo } from "react";
import {
  type CrossSignalQuality,
  type DivergenceSignal,
  type NormalizedCandle,
  type PatternSignal,
  type PerfectOrderValueEnhanced,
  type RangeBoundValue,
  type Series,
  type SqueezeSignal,
  type VolumeBreakoutSignal,
  type VolumeMaCrossSignal,
  bollingerSqueeze,
  cupWithHandle,
  doubleBottom,
  doubleTop,
  headAndShoulders,
  inverseHeadAndShoulders,
  macdDivergence,
  obvDivergence,
  perfectOrderEnhanced,
  rangeBound,
  rsiDivergence,
  validateCrossSignals,
  volumeBreakout,
  volumeMaCross,
} from "trendcraft";
import type { IndicatorParams, SignalType } from "../types";

export interface SignalData {
  perfectOrder: Series<PerfectOrderValueEnhanced> | null;
  rangeBound: Series<RangeBoundValue> | null;
  crossSignals: CrossSignalQuality[] | null;
  divergence: DivergenceSignal[] | null;
  bbSqueeze: SqueezeSignal[] | null;
  volumeBreakout: VolumeBreakoutSignal[] | null;
  volumeMaCross: VolumeMaCrossSignal[] | null;
  chartPatterns: PatternSignal[] | null;
}

/**
 * Calculate signals for enabled signal types
 */
export function useSignals(
  candles: NormalizedCandle[],
  enabledSignals: SignalType[],
  indicatorParams?: IndicatorParams,
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

  const divergence = useMemo(() => {
    if (!enabledSignals.includes("divergence") || candles.length === 0) {
      return null;
    }
    const options = {
      swingLookback: indicatorParams?.divergenceSwingLookback ?? 5,
      minSwingDistance: indicatorParams?.divergenceMinDistance ?? 5,
      maxSwingDistance: indicatorParams?.divergenceMaxDistance ?? 60,
    };
    const indicator = indicatorParams?.divergenceIndicator ?? "rsi";
    switch (indicator) {
      case "macd":
        return macdDivergence(candles, options);
      case "obv":
        return obvDivergence(candles, options);
      default:
        return rsiDivergence(candles, options);
    }
  }, [candles, enabledSignals, indicatorParams]);

  const bbSqueeze = useMemo(() => {
    if (!enabledSignals.includes("bbSqueeze") || candles.length === 0) {
      return null;
    }
    return bollingerSqueeze(candles, {
      period: indicatorParams?.bbSqueezePeriod ?? 20,
      stdDev: indicatorParams?.bbSqueezeStdDev ?? 2,
      lookback: indicatorParams?.bbSqueezeLookback ?? 120,
      threshold: indicatorParams?.bbSqueezeThreshold ?? 5,
    });
  }, [candles, enabledSignals, indicatorParams]);

  const volumeBreakoutSignals = useMemo(() => {
    if (!enabledSignals.includes("volumeBreakout") || candles.length === 0) {
      return null;
    }
    return volumeBreakout(candles, {
      period: indicatorParams?.volumeBreakoutPeriod ?? 20,
      minRatio: indicatorParams?.volumeBreakoutMinRatio ?? 1.5,
    });
  }, [candles, enabledSignals, indicatorParams]);

  const volumeMaCrossSignals = useMemo(() => {
    if (!enabledSignals.includes("volumeMaCross") || candles.length === 0) {
      return null;
    }
    return volumeMaCross(candles, {
      shortPeriod: indicatorParams?.volumeMaCrossShortPeriod ?? 5,
      longPeriod: indicatorParams?.volumeMaCrossLongPeriod ?? 20,
      bullishOnly: true,
    });
  }, [candles, enabledSignals, indicatorParams]);

  const chartPatterns = useMemo(() => {
    if (!enabledSignals.includes("chartPatterns") || candles.length === 0) {
      return null;
    }
    const swingLookback = indicatorParams?.chartPatternSwingLookback ?? 5;
    const tolerance = indicatorParams?.chartPatternTolerance ?? 0.02;
    const minDistance = indicatorParams?.chartPatternMinDistance ?? 10;
    const maxDistance = indicatorParams?.chartPatternMaxDistance ?? 40;

    const doubleOpts = { tolerance, minDistance, maxDistance, swingLookback };
    const hsOpts = { swingLookback };
    const cupOpts = { swingLookback };

    const patterns: PatternSignal[] = [
      ...doubleTop(candles, doubleOpts),
      ...doubleBottom(candles, doubleOpts),
      ...headAndShoulders(candles, hsOpts),
      ...inverseHeadAndShoulders(candles, hsOpts),
      ...cupWithHandle(candles, cupOpts),
    ];

    // Sort by time descending
    patterns.sort((a, b) => b.time - a.time);
    return patterns;
  }, [candles, enabledSignals, indicatorParams]);

  return {
    perfectOrder,
    rangeBound: rangeBoundData,
    crossSignals,
    divergence,
    bbSqueeze,
    volumeBreakout: volumeBreakoutSignals,
    volumeMaCross: volumeMaCrossSignals,
    chartPatterns,
  };
}
