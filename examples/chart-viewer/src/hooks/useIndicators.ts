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
 * Calculate Simple Moving Average for a numeric array with nulls
 */
function calculateSma(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const val = values[j];
      if (val !== null) {
        sum += val;
        count++;
      }
    }

    if (count === period) {
      result.push(sum / count);
    } else {
      result.push(null);
    }
  }

  return result;
}

/**
 * Percentile level label (short form: L/M/H)
 */
export type PercentileLevel = "L" | "M" | "H";

/**
 * Percentile info with numeric value and level
 */
export interface PercentileInfo {
  value: number;  // 0-100
  level: PercentileLevel;
}

/**
 * Calculate percentile info of the current value within a lookback window
 * Returns numeric percentile (0-100) and level (Low/Mid/High)
 */
function calculatePercentileInfo(
  values: (number | null)[],
  index: number,
  lookback: number = 252
): PercentileInfo | null {
  const current = values[index];
  if (current === null) return null;

  const start = Math.max(0, index - lookback + 1);
  const window = values.slice(start, index + 1).filter((v): v is number => v !== null);

  if (window.length < 10) return null; // Insufficient data

  const below = window.filter((v) => v < current).length;
  const percentile = Math.round((below / window.length) * 100);

  let level: PercentileLevel;
  if (percentile < 33) level = "L";
  else if (percentile < 66) level = "M";
  else level = "H";

  return { value: percentile, level };
}

/**
 * Detect estimated earnings announcement dates by EPS/BPS change
 *
 * Logic:
 *   EPS = Close / PER
 *   BPS = Close / PBR
 *
 * Stock price movement -> PER/PBR changes but EPS/BPS stays constant
 * Earnings announcement -> EPS/BPS gets updated
 *
 * Therefore: EPS/BPS change = earnings announcement date
 *
 * Note: Different thresholds for EPS and BPS because:
 * - PER/PBR rounding causes small noise in calculated EPS/BPS
 * - EPS threshold is higher (2%) to filter out rounding noise
 * - BPS threshold is lower (1%) because BPS changes are often smaller
 */
function detectEarningsDates(
  per: (number | null)[],
  pbr: (number | null)[],
  closes: number[],
  epsThresholdPercent: number = 2.0,
  bpsThresholdPercent: number = 1.0,
  cooldownDays: number = 55
): number[] {
  const indices: number[] = [];
  let prevEps: number | null = null;
  let prevBps: number | null = null;
  let prevIndex: number | null = null;
  let lastDetectedIndex: number = -cooldownDays;

  for (let i = 0; i < per.length; i++) {
    const p = per[i];
    const b = pbr[i];
    const close = closes[i];

    if (p === null || b === null || p === 0 || b === 0) {
      prevEps = null;
      prevBps = null;
      prevIndex = null;
      continue;
    }

    const eps = close / p; // EPS = Price / PER
    const bps = close / b; // BPS = Price / PBR

    if (prevEps !== null && prevBps !== null && prevIndex !== null) {
      const epsChangePercent = Math.abs((eps - prevEps) / prevEps) * 100;
      const bpsChangePercent = Math.abs((bps - prevBps) / prevBps) * 100;

      const daysSince = i - lastDetectedIndex;

      // Detect if EPS >= 2% change OR BPS >= 1% change
      if (
        (epsChangePercent >= epsThresholdPercent || bpsChangePercent >= bpsThresholdPercent) &&
        daysSince >= cooldownDays
      ) {
        indices.push(prevIndex);
        lastDetectedIndex = i;
      }
    }

    prevEps = eps;
    prevBps = bps;
    prevIndex = i;
  }

  return indices;
}

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
  // PER/PBR SMA (20-period moving average)
  perSma?: (number | null)[];
  pbrSma?: (number | null)[];
  // PER/PBR Percentile Info (value + level)
  perPercentile?: PercentileInfo | null;
  pbrPercentile?: PercentileInfo | null;
  // ROE (Return on Equity)
  roe?: (number | null)[];
  roeSma?: (number | null)[];
  roePercentile?: PercentileInfo | null;
  // Estimated earnings announcement dates (detected by EPS/BPS change)
  earningsDateIndices?: number[];
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
      // Calculate SMA20 for PER
      data.perSma = calculateSma(fundamentals.per, 20);
      // Calculate percentile info for current PER
      const lastIndex = fundamentals.per.length - 1;
      data.perPercentile = calculatePercentileInfo(fundamentals.per, lastIndex, 252);
    }

    // PBR (from CSV fundamentals)
    if (enabledIndicators.includes("pbr") && fundamentals?.pbr) {
      data.pbr = fundamentals.pbr;
      // Calculate SMA20 for PBR
      data.pbrSma = calculateSma(fundamentals.pbr, 20);
      // Calculate percentile info for current PBR
      const lastIndex = fundamentals.pbr.length - 1;
      data.pbrPercentile = calculatePercentileInfo(fundamentals.pbr, lastIndex, 252);
    }

    // ROE (Return on Equity) = PBR / PER * 100
    if (enabledIndicators.includes("roe") && fundamentals?.per && fundamentals?.pbr) {
      data.roe = fundamentals.per.map((per, i) => {
        const pbr = fundamentals.pbr?.[i];
        if (per === null || pbr === null || per === 0) return null;
        return (pbr / per) * 100;
      });
      data.roeSma = calculateSma(data.roe, 20);
      const lastIndex = data.roe.length - 1;
      data.roePercentile = calculatePercentileInfo(data.roe, lastIndex, 252);
    }

    // Detect earnings announcement dates when PER/PBR/ROE subchart is enabled
    const fundamentalSubchartEnabled =
      enabledIndicators.includes("per") ||
      enabledIndicators.includes("pbr") ||
      enabledIndicators.includes("roe");
    if (fundamentalSubchartEnabled && fundamentals?.per && fundamentals?.pbr) {
      const closes = candles.map((c) => c.close);
      data.earningsDateIndices = detectEarningsDates(
        fundamentals.per,
        fundamentals.pbr,
        closes,
        2.0, // EPS threshold: 2% (higher to filter PER rounding noise)
        1.0, // BPS threshold: 1% (lower because BPS changes can be smaller)
        55   // 55 days cooldown (quarterly ~63 trading days)
      );
    }

    return data;
  }, [candles, enabledIndicators, indicatorParams, fundamentals]);
}
