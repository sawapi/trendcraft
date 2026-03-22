/**
 * Market Regime Detection
 *
 * Detects the current market regime by combining volatility analysis
 * (ATR percentile) with trend detection (EMA crossover and ADX).
 *
 * Unlike `volatilityRegime()` which only classifies volatility levels,
 * this function provides a unified view of both volatility and trend direction.
 *
 * @example
 * ```ts
 * import { detectMarketRegime } from "trendcraft";
 *
 * const regime = detectMarketRegime(candles);
 * // { volatility: "normal", trend: "bullish", trendStrength: 62 }
 *
 * const regime2 = detectMarketRegime(candles, { lookback: 100 });
 * ```
 */

import { normalizeCandles } from "../core/normalize";
import { dmi } from "../indicators/momentum/dmi";
import { ema } from "../indicators/moving-average/ema";
import { atr } from "../indicators/volatility/atr";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Market regime detection result
 */
export type MarketRegimeResult = {
  /** Current volatility classification */
  volatility: "low" | "normal" | "high";
  /** Current trend direction */
  trend: "bullish" | "bearish" | "sideways";
  /** Trend strength from 0 (no trend) to 100 (extreme trend) */
  trendStrength: number;
};

/**
 * Options for market regime detection
 */
export type MarketRegimeOptions = {
  /** Lookback period for ATR percentile calculation. Default: 60 */
  lookback?: number;
  /** ATR period. Default: 14 */
  atrPeriod?: number;
  /** Short EMA period for trend detection. Default: 20 */
  emaShort?: number;
  /** Long EMA period for trend detection. Default: 50 */
  emaLong?: number;
  /** ADX period for trend strength. Default: 14 */
  adxPeriod?: number;
  /** ATR percentile threshold for "low" volatility (0-100). Default: 25 */
  lowThreshold?: number;
  /** ATR percentile threshold for "high" volatility (0-100). Default: 75 */
  highThreshold?: number;
  /** ADX threshold below which trend is "sideways". Default: 20 */
  sidewaysThreshold?: number;
};

type ResolvedOptions = {
  lookback: number;
  atrPeriod: number;
  emaShort: number;
  emaLong: number;
  adxPeriod: number;
  lowThreshold: number;
  highThreshold: number;
  sidewaysThreshold: number;
};

const DEFAULTS: ResolvedOptions = {
  lookback: 60,
  atrPeriod: 14,
  emaShort: 20,
  emaLong: 50,
  adxPeriod: 14,
  lowThreshold: 25,
  highThreshold: 75,
  sidewaysThreshold: 20,
};

function resolveOptions(opts: MarketRegimeOptions = {}): ResolvedOptions {
  return {
    lookback: opts.lookback ?? DEFAULTS.lookback,
    atrPeriod: opts.atrPeriod ?? DEFAULTS.atrPeriod,
    emaShort: opts.emaShort ?? DEFAULTS.emaShort,
    emaLong: opts.emaLong ?? DEFAULTS.emaLong,
    adxPeriod: opts.adxPeriod ?? DEFAULTS.adxPeriod,
    lowThreshold: opts.lowThreshold ?? DEFAULTS.lowThreshold,
    highThreshold: opts.highThreshold ?? DEFAULTS.highThreshold,
    sidewaysThreshold: opts.sidewaysThreshold ?? DEFAULTS.sidewaysThreshold,
  };
}

/**
 * Detect the current market regime combining volatility and trend analysis.
 *
 * Uses ATR percentile for volatility classification and EMA crossover + ADX
 * for trend direction and strength.
 *
 * @param candles - Array of candles (minimum: lookback + emaLong candles recommended)
 * @param options - Configuration options
 * @returns Market regime result with volatility, trend, and trendStrength
 *
 * @example
 * ```ts
 * const regime = detectMarketRegime(candles);
 * if (regime.volatility === "high") {
 *   // Widen stops, reduce position size
 * }
 * if (regime.trend === "bullish" && regime.trendStrength > 50) {
 *   // Strong uptrend — favor trend-following strategies
 * }
 * ```
 */
export function detectMarketRegime(
  candles: Candle[] | NormalizedCandle[],
  options: MarketRegimeOptions = {},
): MarketRegimeResult {
  const opts = resolveOptions(options);

  const normalized: NormalizedCandle[] = isNormalized(candles)
    ? candles
    : normalizeCandles(candles);

  if (normalized.length === 0) {
    return { volatility: "normal", trend: "sideways", trendStrength: 0 };
  }

  // --- Volatility: ATR percentile ---
  const volatility = classifyVolatility(normalized, opts);

  // --- Trend: EMA cross + ADX ---
  const { trend, trendStrength } = classifyTrend(normalized, opts);

  return { volatility, trend, trendStrength };
}

function classifyVolatility(
  candles: NormalizedCandle[],
  opts: ResolvedOptions,
): "low" | "normal" | "high" {
  const atrSeries = atr(candles, { period: opts.atrPeriod });
  const lastIdx = atrSeries.length - 1;
  const currentAtr = atrSeries[lastIdx]?.value;

  if (currentAtr == null) return "normal";

  // Collect ATR values over lookback window
  const startIdx = Math.max(0, lastIdx - opts.lookback + 1);
  const values: number[] = [];
  for (let i = startIdx; i <= lastIdx; i++) {
    const v = atrSeries[i]?.value;
    if (v != null) values.push(v);
  }

  if (values.length < 10) return "normal";

  // Percentile rank of current ATR
  const countBelow = values.filter((v) => v < currentAtr).length;
  const countEqual = values.filter((v) => v === currentAtr).length;
  const percentile = ((countBelow + 0.5 * countEqual) / values.length) * 100;

  if (percentile <= opts.lowThreshold) return "low";
  if (percentile >= opts.highThreshold) return "high";
  return "normal";
}

function classifyTrend(
  candles: NormalizedCandle[],
  opts: ResolvedOptions,
): { trend: "bullish" | "bearish" | "sideways"; trendStrength: number } {
  // EMA cross for direction
  const emaShortSeries = ema(candles, { period: opts.emaShort });
  const emaLongSeries = ema(candles, { period: opts.emaLong });

  const lastIdx = candles.length - 1;
  const shortVal = emaShortSeries[lastIdx]?.value;
  const longVal = emaLongSeries[lastIdx]?.value;

  // ADX for strength
  const dmiSeries = dmi(candles, { period: opts.adxPeriod });
  const lastDmi = dmiSeries[lastIdx]?.value;
  const adxVal = lastDmi?.adx ?? 0;

  // Clamp ADX to 0-100 for trendStrength
  const trendStrength = Math.min(100, Math.max(0, Math.round(adxVal)));

  // If ADX is below sideways threshold, classify as sideways regardless of EMA
  if (adxVal < opts.sidewaysThreshold) {
    return { trend: "sideways", trendStrength };
  }

  // Determine direction from EMA relationship
  if (shortVal != null && longVal != null) {
    if (shortVal > longVal) {
      return { trend: "bullish", trendStrength };
    }
    return { trend: "bearish", trendStrength };
  }

  return { trend: "sideways", trendStrength };
}

function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
