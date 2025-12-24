/**
 * Volatility Regime Detection
 *
 * Classifies market volatility into regimes (low, normal, high, extreme)
 * using ATR percentile, Bollinger Bandwidth percentile, and historical volatility.
 */

import { normalizeCandles } from "../../core/normalize";
import type {
  Candle,
  NormalizedCandle,
  Series,
  VolatilityRegime,
  VolatilityRegimeOptions,
  VolatilityRegimeValue,
} from "../../types";
import { atr } from "./atr";
import { bollingerBands } from "./bollinger-bands";

/**
 * Fully resolved options type (all properties required)
 */
type ResolvedOptions = {
  atrPeriod: number;
  bbPeriod: number;
  lookbackPeriod: number;
  thresholds: {
    low: number;
    high: number;
    extreme: number;
  };
};

/**
 * Default options for volatility regime calculation
 */
const DEFAULT_OPTIONS: ResolvedOptions = {
  atrPeriod: 14,
  bbPeriod: 20,
  lookbackPeriod: 100,
  thresholds: {
    low: 25,
    high: 75,
    extreme: 95,
  },
};

/**
 * Calculate volatility regime for each candle
 *
 * Combines multiple volatility measures to classify the current market regime:
 * - ATR percentile: Position of current ATR within historical range
 * - Bollinger Bandwidth percentile: Position of current bandwidth within historical range
 * - Historical volatility: Annualized standard deviation of returns
 *
 * Regime classification based on average percentile:
 * - "low": <= low threshold (default 25)
 * - "normal": between low and high thresholds
 * - "high": >= high threshold (default 75) and < extreme threshold
 * - "extreme": >= extreme threshold (default 95)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Configuration options
 * @returns Series of volatility regime values
 *
 * @example
 * ```ts
 * const regimes = volatilityRegime(candles);
 * const currentRegime = regimes[regimes.length - 1].value.regime;
 *
 * if (currentRegime === 'low') {
 *   // Consider range-bound strategies
 * } else if (currentRegime === 'high' || currentRegime === 'extreme') {
 *   // Consider wider stops, smaller position sizes
 * }
 * ```
 */
export function volatilityRegime(
  candles: Candle[] | NormalizedCandle[],
  options: VolatilityRegimeOptions = {},
): Series<VolatilityRegimeValue> {
  const opts = mergeOptions(options);

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Calculate ATR series
  const atrSeries = atr(normalized, { period: opts.atrPeriod });

  // Calculate Bollinger Bands series (for bandwidth)
  const bbSeries = bollingerBands(normalized, { period: opts.bbPeriod });

  // Calculate historical volatility (rolling standard deviation of log returns)
  const hvSeries = calculateHistoricalVolatility(normalized, opts.lookbackPeriod);

  const result: Series<VolatilityRegimeValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const currentAtr = atrSeries[i]?.value ?? null;
    const currentBandwidth = bbSeries[i]?.value?.bandwidth ?? null;
    const currentHv = hvSeries[i];

    // Calculate percentiles (need enough lookback data)
    const atrPercentile = calculatePercentile(atrSeries, i, opts.lookbackPeriod);
    const bandwidthPercentile = calculateBandwidthPercentile(bbSeries, i, opts.lookbackPeriod);

    // Determine regime based on combined percentile
    const { regime, confidence } = classifyRegime(
      atrPercentile,
      bandwidthPercentile,
      opts.thresholds,
    );

    result.push({
      time: normalized[i].time,
      value: {
        regime,
        atrPercentile,
        bandwidthPercentile,
        historicalVol: currentHv,
        atr: currentAtr,
        bandwidth: currentBandwidth,
        confidence,
      },
    });
  }

  return result;
}

/**
 * Calculate percentile of current ATR value within lookback period
 */
function calculatePercentile(
  series: Series<number | null>,
  index: number,
  lookbackPeriod: number,
): number | null {
  const currentValue = series[index]?.value;
  if (currentValue === null || currentValue === undefined) {
    return null;
  }

  // Collect valid values within lookback period
  const startIndex = Math.max(0, index - lookbackPeriod + 1);
  const values: number[] = [];

  for (let i = startIndex; i <= index; i++) {
    const val = series[i]?.value;
    if (val !== null && val !== undefined) {
      values.push(val);
    }
  }

  if (values.length < 10) {
    // Need minimum data for meaningful percentile
    return null;
  }

  // Calculate percentile rank
  const countBelow = values.filter((v) => v < currentValue).length;
  const countEqual = values.filter((v) => v === currentValue).length;
  const percentile = ((countBelow + 0.5 * countEqual) / values.length) * 100;

  return Math.round(percentile * 100) / 100;
}

/**
 * Calculate percentile of current Bollinger Bandwidth within lookback period
 */
function calculateBandwidthPercentile(
  series: Series<{
    upper: number | null;
    middle: number | null;
    lower: number | null;
    percentB: number | null;
    bandwidth: number | null;
  }>,
  index: number,
  lookbackPeriod: number,
): number | null {
  const currentBandwidth = series[index]?.value?.bandwidth;
  if (currentBandwidth === null || currentBandwidth === undefined) {
    return null;
  }

  // Collect valid bandwidth values within lookback period
  const startIndex = Math.max(0, index - lookbackPeriod + 1);
  const values: number[] = [];

  for (let i = startIndex; i <= index; i++) {
    const bw = series[i]?.value?.bandwidth;
    if (bw !== null && bw !== undefined) {
      values.push(bw);
    }
  }

  if (values.length < 10) {
    return null;
  }

  // Calculate percentile rank
  const countBelow = values.filter((v) => v < currentBandwidth).length;
  const countEqual = values.filter((v) => v === currentBandwidth).length;
  const percentile = ((countBelow + 0.5 * countEqual) / values.length) * 100;

  return Math.round(percentile * 100) / 100;
}

/**
 * Calculate historical volatility (annualized standard deviation of log returns)
 */
function calculateHistoricalVolatility(
  candles: NormalizedCandle[],
  lookbackPeriod: number,
): (number | null)[] {
  const result: (number | null)[] = [];
  const tradingDaysPerYear = 252;

  for (let i = 0; i < candles.length; i++) {
    if (i < lookbackPeriod) {
      result.push(null);
      continue;
    }

    // Calculate log returns for the lookback period
    const returns: number[] = [];
    for (let j = i - lookbackPeriod + 1; j <= i; j++) {
      if (candles[j - 1].close > 0) {
        const logReturn = Math.log(candles[j].close / candles[j - 1].close);
        returns.push(logReturn);
      }
    }

    if (returns.length < lookbackPeriod - 1) {
      result.push(null);
      continue;
    }

    // Calculate standard deviation
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize
    const annualizedVol = stdDev * Math.sqrt(tradingDaysPerYear) * 100;

    result.push(Math.round(annualizedVol * 100) / 100);
  }

  return result;
}

/**
 * Classify regime based on percentiles
 */
function classifyRegime(
  atrPercentile: number | null,
  bandwidthPercentile: number | null,
  thresholds: { low: number; high: number; extreme: number },
): { regime: VolatilityRegime; confidence: number } {
  // If we don't have enough data, return normal with low confidence
  if (atrPercentile === null && bandwidthPercentile === null) {
    return { regime: "normal", confidence: 0 };
  }

  // Calculate average percentile from available indicators
  const percentiles: number[] = [];
  if (atrPercentile !== null) percentiles.push(atrPercentile);
  if (bandwidthPercentile !== null) percentiles.push(bandwidthPercentile);

  const avgPercentile = percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length;

  // Classify based on thresholds
  let regime: VolatilityRegime;
  if (avgPercentile >= thresholds.extreme) {
    regime = "extreme";
  } else if (avgPercentile >= thresholds.high) {
    regime = "high";
  } else if (avgPercentile <= thresholds.low) {
    regime = "low";
  } else {
    regime = "normal";
  }

  // Calculate confidence based on indicator agreement
  let confidence: number;
  if (percentiles.length === 1) {
    confidence = 0.5; // Only one indicator available
  } else {
    // Higher confidence when indicators agree
    const spread = Math.abs(atrPercentile! - bandwidthPercentile!);
    // Max spread is 100, so normalize to 0-1 (lower spread = higher confidence)
    confidence = 1 - spread / 100;
    confidence = Math.round(confidence * 100) / 100;
  }

  return { regime, confidence };
}

/**
 * Merge user options with defaults
 */
function mergeOptions(options: VolatilityRegimeOptions): ResolvedOptions {
  return {
    atrPeriod: options.atrPeriod ?? DEFAULT_OPTIONS.atrPeriod,
    bbPeriod: options.bbPeriod ?? DEFAULT_OPTIONS.bbPeriod,
    lookbackPeriod: options.lookbackPeriod ?? DEFAULT_OPTIONS.lookbackPeriod,
    thresholds: {
      low: options.thresholds?.low ?? DEFAULT_OPTIONS.thresholds.low,
      high: options.thresholds?.high ?? DEFAULT_OPTIONS.thresholds.high,
      extreme: options.thresholds?.extreme ?? DEFAULT_OPTIONS.thresholds.extreme,
    },
  };
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
