/**
 * Volatility Regime Conditions for Backtest
 *
 * Conditions based on volatility regime detection.
 * Use these to filter trades by market volatility environment.
 */

import { volatilityRegime } from "../../indicators/volatility/regime";
import {
  atrPercentSeries,
  DEFAULT_ATR_THRESHOLD,
  type AtrFilterOptions,
} from "../../indicators/volatility/atr-filter";
import type {
  PresetCondition,
  VolatilityRegime,
  VolatilityRegimeOptions,
} from "../../types";

// Cache for volatility regime series
const regimeCache = new WeakMap<
  object,
  ReturnType<typeof volatilityRegime>
>();

/**
 * Get or calculate volatility regime series (cached)
 */
function getRegimeSeries(
  candles: Parameters<typeof volatilityRegime>[0],
  options?: VolatilityRegimeOptions,
) {
  // Use candles array as cache key
  const cacheKey = candles as object;

  // For simplicity, we don't cache with options differentiation
  // In production, you might want a more sophisticated cache key
  let cached = regimeCache.get(cacheKey);
  if (!cached) {
    cached = volatilityRegime(candles, options);
    regimeCache.set(cacheKey, cached);
  }
  return cached;
}

/**
 * Create a condition that triggers when volatility regime matches the specified regime
 *
 * @param regime - Target volatility regime
 * @param options - Volatility regime calculation options
 *
 * @example
 * ```ts
 * // Only enter trades in low volatility environment
 * const entry = and(
 *   regimeIs('low'),
 *   rsiBelow(30)
 * );
 *
 * // Avoid high volatility
 * const entry = and(
 *   regimeNot('high'),
 *   regimeNot('extreme'),
 *   goldenCross()
 * );
 * ```
 */
export function regimeIs(
  regime: VolatilityRegime,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `regimeIs:${regime}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current) return false;
      return current.regime === regime;
    },
  };
}

/**
 * Create a condition that triggers when volatility regime does NOT match the specified regime
 *
 * @param regime - Target volatility regime to avoid
 * @param options - Volatility regime calculation options
 */
export function regimeNot(
  regime: VolatilityRegime,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `regimeNot:${regime}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current) return false;
      return current.regime !== regime;
    },
  };
}

/**
 * Create a condition that triggers when volatility percentile is above threshold
 *
 * Uses the average of ATR percentile and bandwidth percentile.
 *
 * @param percentile - Minimum percentile threshold (0-100)
 * @param options - Volatility regime calculation options
 *
 * @example
 * ```ts
 * // Enter when volatility is above 70th percentile
 * const entry = and(
 *   volatilityAbove(70),
 *   macdCrossUp()
 * );
 * ```
 */
export function volatilityAbove(
  percentile: number,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `volatilityAbove:${percentile}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current) return false;

      // Calculate average percentile
      const percentiles: number[] = [];
      if (current.atrPercentile !== null) percentiles.push(current.atrPercentile);
      if (current.bandwidthPercentile !== null) percentiles.push(current.bandwidthPercentile);

      if (percentiles.length === 0) return false;

      const avgPercentile = percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length;
      return avgPercentile >= percentile;
    },
  };
}

/**
 * Create a condition that triggers when volatility percentile is below threshold
 *
 * Uses the average of ATR percentile and bandwidth percentile.
 *
 * @param percentile - Maximum percentile threshold (0-100)
 * @param options - Volatility regime calculation options
 *
 * @example
 * ```ts
 * // Enter range-bound strategies in low volatility
 * const entry = and(
 *   volatilityBelow(30),
 *   bollingerTouch('lower')
 * );
 * ```
 */
export function volatilityBelow(
  percentile: number,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `volatilityBelow:${percentile}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current) return false;

      // Calculate average percentile
      const percentiles: number[] = [];
      if (current.atrPercentile !== null) percentiles.push(current.atrPercentile);
      if (current.bandwidthPercentile !== null) percentiles.push(current.bandwidthPercentile);

      if (percentiles.length === 0) return false;

      const avgPercentile = percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length;
      return avgPercentile <= percentile;
    },
  };
}

/**
 * Create a condition that triggers when ATR percentile is above threshold
 *
 * @param percentile - Minimum ATR percentile threshold (0-100)
 * @param options - Volatility regime calculation options
 */
export function atrPercentileAbove(
  percentile: number,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `atrPercentileAbove:${percentile}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current || current.atrPercentile === null) return false;
      return current.atrPercentile >= percentile;
    },
  };
}

/**
 * Create a condition that triggers when ATR percentile is below threshold
 *
 * @param percentile - Maximum ATR percentile threshold (0-100)
 * @param options - Volatility regime calculation options
 */
export function atrPercentileBelow(
  percentile: number,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `atrPercentileBelow:${percentile}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current || current.atrPercentile === null) return false;
      return current.atrPercentile <= percentile;
    },
  };
}

/**
 * Create a condition that triggers when regime confidence is above threshold
 *
 * @param confidence - Minimum confidence threshold (0-1)
 * @param options - Volatility regime calculation options
 *
 * @example
 * ```ts
 * // Only act on high-confidence regime classifications
 * const entry = and(
 *   regimeIs('low'),
 *   regimeConfidenceAbove(0.7),
 *   rsiBelow(30)
 * );
 * ```
 */
export function regimeConfidenceAbove(
  confidence: number,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `regimeConfidenceAbove:${confidence}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current) return false;
      return current.confidence >= confidence;
    },
  };
}

/**
 * Create a condition that triggers during volatility expansion
 * (current volatility significantly higher than recent past)
 *
 * @param threshold - Minimum percentile increase from lookback average (default: 20)
 * @param lookback - Number of bars to look back for average (default: 5)
 * @param options - Volatility regime calculation options
 */
export function volatilityExpanding(
  threshold: number = 20,
  lookback: number = 5,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `volatilityExpanding:${threshold}`,
    evaluate: (_indicators, _candle, index, candles) => {
      if (index < lookback) return false;

      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current || current.atrPercentile === null) return false;

      // Calculate average ATR percentile over lookback period
      let sum = 0;
      let count = 0;
      for (let i = index - lookback; i < index; i++) {
        const val = series[i]?.value?.atrPercentile;
        if (val !== null && val !== undefined) {
          sum += val;
          count++;
        }
      }

      if (count === 0) return false;

      const avgPercentile = sum / count;
      return current.atrPercentile - avgPercentile >= threshold;
    },
  };
}

/**
 * Create a condition that triggers during volatility contraction
 * (current volatility significantly lower than recent past)
 *
 * @param threshold - Minimum percentile decrease from lookback average (default: 20)
 * @param lookback - Number of bars to look back for average (default: 5)
 * @param options - Volatility regime calculation options
 */
export function volatilityContracting(
  threshold: number = 20,
  lookback: number = 5,
  options?: VolatilityRegimeOptions,
): PresetCondition {
  return {
    type: "preset",
    name: `volatilityContracting:${threshold}`,
    evaluate: (_indicators, _candle, index, candles) => {
      if (index < lookback) return false;

      const series = getRegimeSeries(candles, options);
      const current = series[index]?.value;
      if (!current || current.atrPercentile === null) return false;

      // Calculate average ATR percentile over lookback period
      let sum = 0;
      let count = 0;
      for (let i = index - lookback; i < index; i++) {
        const val = series[i]?.value?.atrPercentile;
        if (val !== null && val !== undefined) {
          sum += val;
          count++;
        }
      }

      if (count === 0) return false;

      const avgPercentile = sum / count;
      return avgPercentile - current.atrPercentile >= threshold;
    },
  };
}

// Cache for ATR% series
const atrPercentCache = new WeakMap<
  object,
  ReturnType<typeof atrPercentSeries>
>();

/**
 * Get or calculate ATR% series (cached)
 */
function getAtrPercentSeries(
  candles: Parameters<typeof atrPercentSeries>[0],
  atrPeriod?: number,
) {
  const cacheKey = candles as object;
  let cached = atrPercentCache.get(cacheKey);
  if (!cached) {
    cached = atrPercentSeries(candles, atrPeriod);
    atrPercentCache.set(cacheKey, cached);
  }
  return cached;
}

/**
 * Create a condition that triggers when ATR% is above threshold
 *
 * ATR% measures volatility as a percentage of price.
 * Higher values indicate more volatile stocks suitable for trend-following.
 *
 * @param threshold - Minimum ATR% threshold (default: 2.3)
 * @param options - ATR filter options
 *
 * @example
 * ```ts
 * // Only trade stocks with ATR% >= 2.3% (default threshold)
 * const entry = and(
 *   atrPercentAbove(),
 *   goldenCrossCondition(5, 25)
 * );
 *
 * // More volatile stocks only (ATR% >= 3%)
 * const entry = and(
 *   atrPercentAbove(3.0),
 *   macdCrossUp()
 * );
 * ```
 */
export function atrPercentAbove(
  threshold: number = DEFAULT_ATR_THRESHOLD,
  options?: Pick<AtrFilterOptions, "atrPeriod">,
): PresetCondition {
  return {
    type: "preset",
    name: `atrPercentAbove:${threshold}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getAtrPercentSeries(candles, options?.atrPeriod);
      const current = series[index]?.value;
      if (current === null || current === undefined) return false;
      return current >= threshold;
    },
  };
}

/**
 * Create a condition that triggers when ATR% is below threshold
 *
 * Lower values indicate less volatile stocks, which may be suitable for
 * mean-reversion strategies but poor for trend-following.
 *
 * @param threshold - Maximum ATR% threshold
 * @param options - ATR filter options
 *
 * @example
 * ```ts
 * // Low volatility stocks for mean-reversion
 * const entry = and(
 *   atrPercentBelow(1.5),
 *   bollingerTouch('lower')
 * );
 * ```
 */
export function atrPercentBelow(
  threshold: number,
  options?: Pick<AtrFilterOptions, "atrPeriod">,
): PresetCondition {
  return {
    type: "preset",
    name: `atrPercentBelow:${threshold}`,
    evaluate: (_indicators, _candle, index, candles) => {
      const series = getAtrPercentSeries(candles, options?.atrPeriod);
      const current = series[index]?.value;
      if (current === null || current === undefined) return false;
      return current <= threshold;
    },
  };
}
