/**
 * Hook for calculating technical indicators
 */

import { useMemo } from "react";
import type {
  NormalizedCandle,
  MacdValue,
  StochasticsValue,
  DmiValue,
  StochRsiValue,
} from "trendcraft";
import {
  rsi,
  macd,
  stochastics,
  dmi,
  stochRsi,
  mfi,
  obv,
  cci,
  williamsR,
  roc,
  cmf,
  volumeAnomaly,
  volumeProfileSeries,
  volumeTrend,
  atr,
} from "trendcraft";
import {
  rangeBound,
  type RangeBoundValue,
} from "trendcraft";
import type { VolumeAnomalyValue, VolumeProfileValue, VolumeTrendValue } from "trendcraft";
import type { FundamentalData, SubChartType } from "../types";
import { useChartStore } from "../store/chartStore";

/**
 * Indicator data structure
 */
export interface IndicatorData {
  // RSI
  rsi?: (number | null)[];
  // MACD
  macdLine?: (number | null)[];
  macdSignal?: (number | null)[];
  macdHist?: (number | null)[];
  // Stochastics
  stochK?: (number | null)[];
  stochD?: (number | null)[];
  // DMI/ADX
  dmiPlusDi?: (number | null)[];
  dmiMinusDi?: (number | null)[];
  dmiAdx?: (number | null)[];
  // Stoch RSI
  stochRsiK?: (number | null)[];
  stochRsiD?: (number | null)[];
  // MFI
  mfi?: (number | null)[];
  // OBV
  obv?: number[];
  // CCI
  cci?: (number | null)[];
  // Williams %R
  williams?: (number | null)[];
  // ROC
  roc?: (number | null)[];
  // Range-Bound
  rangeBound?: RangeBoundValue[];
  // CMF
  cmf?: (number | null)[];
  // Volume Anomaly
  volumeAnomaly?: VolumeAnomalyValue[];
  // Volume Profile
  volumeProfile?: (VolumeProfileValue | null)[];
  // Volume Trend
  volumeTrend?: VolumeTrendValue[];
  // ATR
  atr?: (number | null)[];
  // Fundamentals (PER/PBR)
  per?: (number | null)[];
  pbr?: (number | null)[];
}

/**
 * Calculate indicators based on candles and enabled indicators
 */
export function useIndicators(
  candles: NormalizedCandle[],
  enabledIndicators: SubChartType[],
  fundamentals?: FundamentalData | null
): IndicatorData {
  const indicatorParams = useChartStore((s) => s.indicatorParams);

  return useMemo(() => {
    if (candles.length === 0) {
      return {};
    }

    const data: IndicatorData = {};
    const p = indicatorParams;

    // RSI
    if (enabledIndicators.includes("rsi")) {
      const rsiSeries = rsi(candles, { period: p.rsiPeriod });
      data.rsi = rsiSeries.map((s) => s.value);
    }

    // MACD
    if (enabledIndicators.includes("macd")) {
      const macdSeries = macd(candles, {
        fastPeriod: p.macdFastPeriod,
        slowPeriod: p.macdSlowPeriod,
        signalPeriod: p.macdSignalPeriod,
      });
      data.macdLine = macdSeries.map((s) => (s.value as MacdValue)?.macd ?? null);
      data.macdSignal = macdSeries.map((s) => (s.value as MacdValue)?.signal ?? null);
      data.macdHist = macdSeries.map((s) => (s.value as MacdValue)?.histogram ?? null);
    }

    // Stochastics
    if (enabledIndicators.includes("stochastics")) {
      const stochSeries = stochastics(candles, {
        kPeriod: p.stochKPeriod,
        dPeriod: p.stochDPeriod,
      });
      data.stochK = stochSeries.map((s) => (s.value as StochasticsValue)?.k ?? null);
      data.stochD = stochSeries.map((s) => (s.value as StochasticsValue)?.d ?? null);
    }

    // DMI/ADX
    if (enabledIndicators.includes("dmi")) {
      const dmiSeries = dmi(candles, { period: p.dmiPeriod });
      data.dmiPlusDi = dmiSeries.map((s) => (s.value as DmiValue)?.plusDi ?? null);
      data.dmiMinusDi = dmiSeries.map((s) => (s.value as DmiValue)?.minusDi ?? null);
      data.dmiAdx = dmiSeries.map((s) => (s.value as DmiValue)?.adx ?? null);
    }

    // Stoch RSI
    if (enabledIndicators.includes("stochrsi")) {
      const stochRsiSeries = stochRsi(candles, {
        rsiPeriod: p.stochRsiRsiPeriod,
        stochPeriod: p.stochRsiStochPeriod,
        kPeriod: p.stochRsiKPeriod,
        dPeriod: p.stochRsiDPeriod,
      });
      data.stochRsiK = stochRsiSeries.map((s) => {
        const val = s.value as StochRsiValue | null;
        return val?.k ?? null;
      });
      data.stochRsiD = stochRsiSeries.map((s) => {
        const val = s.value as StochRsiValue | null;
        return val?.d ?? null;
      });
    }

    // MFI
    if (enabledIndicators.includes("mfi")) {
      const mfiSeries = mfi(candles, { period: p.mfiPeriod });
      data.mfi = mfiSeries.map((s) => s.value);
    }

    // OBV
    if (enabledIndicators.includes("obv")) {
      const obvSeries = obv(candles);
      data.obv = obvSeries.map((s) => s.value);
    }

    // CCI
    if (enabledIndicators.includes("cci")) {
      const cciSeries = cci(candles, { period: p.cciPeriod });
      data.cci = cciSeries.map((s) => s.value);
    }

    // Williams %R
    if (enabledIndicators.includes("williams")) {
      const williamsSeries = williamsR(candles, { period: p.williamsPeriod });
      data.williams = williamsSeries.map((s) => s.value);
    }

    // ROC
    if (enabledIndicators.includes("roc")) {
      const rocSeries = roc(candles, { period: p.rocPeriod });
      data.roc = rocSeries.map((s) => s.value);
    }

    // Range-Bound
    if (enabledIndicators.includes("rangebound")) {
      const rangeBoundSeries = rangeBound(candles);
      data.rangeBound = rangeBoundSeries.map((s) => s.value);
    }

    // CMF
    if (enabledIndicators.includes("cmf")) {
      const cmfSeries = cmf(candles, { period: p.cmfPeriod });
      data.cmf = cmfSeries.map((s) => s.value);
    }

    // Volume Anomaly
    if (enabledIndicators.includes("volumeAnomaly")) {
      const volumeAnomalySeries = volumeAnomaly(candles, {
        period: p.volumeAnomalyPeriod,
        zScoreThreshold: p.volumeAnomalyZScore,
      });
      data.volumeAnomaly = volumeAnomalySeries.map((s) => s.value);
    }

    // Volume Profile
    if (enabledIndicators.includes("volumeProfile")) {
      const profileSeries = volumeProfileSeries(candles, {
        period: p.volumeProfilePeriod,
        levels: p.volumeProfileLevels,
      });
      data.volumeProfile = profileSeries.map((s) => s.value);
    }

    // Volume Trend
    if (enabledIndicators.includes("volumeTrend")) {
      const volumeTrendSeries = volumeTrend(candles, {
        pricePeriod: p.volumeTrendPricePeriod,
        volumePeriod: p.volumeTrendVolumePeriod,
      });
      data.volumeTrend = volumeTrendSeries.map((s) => s.value);
    }

    // ATR
    if (enabledIndicators.includes("atr")) {
      const atrSeries = atr(candles, { period: p.atrPeriod });
      data.atr = atrSeries.map((s) => s.value);
    }

    // PER (from CSV fundamentals)
    if (enabledIndicators.includes("per") && fundamentals?.per) {
      data.per = fundamentals.per;
    }

    // PBR (from CSV fundamentals)
    if (enabledIndicators.includes("pbr") && fundamentals?.pbr) {
      data.pbr = fundamentals.pbr;
    }

    return data;
  }, [candles, enabledIndicators, indicatorParams, fundamentals]);
}
