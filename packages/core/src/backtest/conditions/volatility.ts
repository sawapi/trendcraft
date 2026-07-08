/**
 * Volatility Regime Conditions for Backtest
 *
 * Conditions based on volatility regime detection.
 * Use these to filter trades by market volatility environment.
 */

import {
  type AtrFilterOptions,
  atrPercentSeries,
  DEFAULT_ATR_THRESHOLD,
} from "../../indicators/volatility/atr-filter";
import { volatilityRegime } from "../../indicators/volatility/regime";
import type { PresetCondition, VolatilityRegime, VolatilityRegimeOptions } from "../../types";

// Cache for volatility regime series, keyed by candles array + options.
// A single-level candles key would let the first condition's options poison
// every other regime condition evaluated on the same array.
const regimeCache = new WeakMap<object, Map<string, ReturnType<typeof volatilityRegime>>>();

/**
 * Canonical cache key for the options that influence volatilityRegime output.
 * Raw (pre-default) values are used positionally so no defaults are restated
 * here; semantically-equal spellings (e.g. `{}` vs `{ atrPeriod: 14 }`) may
 * compute twice, which is correct — only merging distinct options is a bug.
 * The calendar contributes only its annualization identity (volatilityRegime
 * does not consult `isTradingDay`).
 */
function regimeOptionsKey(options?: VolatilityRegimeOptions): string {
  if (!options) return "default";
  const t = options.thresholds;
  const cal = options.calendar;
  return [
    options.atrPeriod,
    options.bbPeriod,
    options.lookbackPeriod,
    t?.low,
    t?.high,
    t?.extreme,
    cal ? `${cal.name}:${cal.tradingDaysPerYear}` : undefined,
  ].join("|");
}

/**
 * Get or calculate volatility regime series (cached per candles + options)
 */
function getRegimeSeries(
  candles: Parameters<typeof volatilityRegime>[0],
  options?: VolatilityRegimeOptions,
) {
  let byOptions = regimeCache.get(candles as object);
  if (!byOptions) {
    byOptions = new Map();
    regimeCache.set(candles as object, byOptions);
  }
  const optionsKey = regimeOptionsKey(options);
  let cached = byOptions.get(optionsKey);
  if (!cached) {
    cached = volatilityRegime(candles, options);
    byOptions.set(optionsKey, cached);
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
 *   goldenCrossCondition()
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
  threshold = 20,
  lookback = 5,
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
  threshold = 20,
  lookback = 5,
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

// Cache for ATR% series, keyed by candles array + period. A single-level
// candles key would serve the first period's series to every other period.
const atrPercentCache = new WeakMap<object, Map<string, ReturnType<typeof atrPercentSeries>>>();

/**
 * Get or calculate ATR% series (cached per candles + period)
 */
function getAtrPercentSeries(candles: Parameters<typeof atrPercentSeries>[0], atrPeriod?: number) {
  let byPeriod = atrPercentCache.get(candles as object);
  if (!byPeriod) {
    byPeriod = new Map();
    atrPercentCache.set(candles as object, byPeriod);
  }
  const periodKey = atrPeriod === undefined ? "default" : String(atrPeriod);
  let cached = byPeriod.get(periodKey);
  if (!cached) {
    cached = atrPercentSeries(candles, atrPeriod);
    byPeriod.set(periodKey, cached);
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
  threshold = 1.0,
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
