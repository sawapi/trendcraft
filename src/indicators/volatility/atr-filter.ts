/**
 * ATR-based Stock Screening Filter
 *
 * Filters stocks based on ATR% (ATR as percentage of price).
 * Trend-following strategies work better on stocks with sufficient volatility.
 *
 * Research findings (2025-12-25):
 * - Success stocks: ATR% >= 2.31% (avg 3.07%)
 * - Failed stocks: ATR% avg 2.12%
 * - Threshold 2.3% achieves 100% precision in filtering out low-volatility failures
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { atr } from "./atr";

/**
 * ATR filter options
 */
export type AtrFilterOptions = {
  /** ATR calculation period (default: 14) */
  atrPeriod?: number;
  /** Lookback period for averaging ATR% (default: 252, ~1 year) */
  lookbackPeriod?: number;
  /** Minimum ATR% threshold (default: 2.3) */
  threshold?: number;
};

/**
 * ATR filter result
 */
export type AtrFilterResult = {
  /** Whether the stock passes the ATR filter */
  passes: boolean;
  /** Calculated ATR% value */
  atrPercent: number;
  /** Threshold used for comparison */
  threshold: number;
};

/** Default ATR% threshold based on research */
export const DEFAULT_ATR_THRESHOLD = 2.3;

/**
 * Calculate ATR% (ATR as percentage of price)
 *
 * ATR% = (ATR / Close) * 100
 *
 * This measures volatility relative to price, making it comparable across
 * stocks with different price levels.
 *
 * @param candles - Array of candles
 * @param options - Calculation options
 * @returns Average ATR% over the lookback period
 *
 * @example
 * ```ts
 * const atrPct = calculateAtrPercent(candles);
 * console.log(`ATR%: ${atrPct.toFixed(2)}%`);
 * ```
 */
export function calculateAtrPercent(
  candles: Candle[] | NormalizedCandle[],
  options: Omit<AtrFilterOptions, "threshold"> = {},
): number {
  const { atrPeriod = 14, lookbackPeriod = 252 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < atrPeriod) {
    return 0;
  }

  // Calculate ATR series
  const atrValues = atr(normalized, { period: atrPeriod });

  // Create time-based lookup map for ATR values
  const atrMap = new Map<number, number | null>();
  for (const v of atrValues) {
    atrMap.set(v.time, v.value);
  }

  // Calculate ATR% for each candle in lookback period
  const startIdx = Math.max(0, normalized.length - lookbackPeriod);
  let sum = 0;
  let count = 0;

  for (let i = startIdx; i < normalized.length; i++) {
    const candle = normalized[i];
    const atrValue = atrMap.get(candle.time);

    if (atrValue !== null && atrValue !== undefined && candle.close > 0) {
      const atrPct = (atrValue / candle.close) * 100;
      sum += atrPct;
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Calculate ATR% series (ATR% for each candle)
 *
 * @param candles - Array of candles
 * @param atrPeriod - ATR calculation period (default: 14)
 * @returns Series of ATR% values
 *
 * @example
 * ```ts
 * const atrPctSeries = atrPercentSeries(candles);
 * ```
 */
export function atrPercentSeries(
  candles: Candle[] | NormalizedCandle[],
  atrPeriod = 14,
): Series<number | null> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const atrValues = atr(normalized, { period: atrPeriod });

  return atrValues.map((atrVal, i) => {
    const close = normalized[i].close;
    if (atrVal.value === null || close <= 0) {
      return { time: atrVal.time, value: null };
    }
    return {
      time: atrVal.time,
      value: (atrVal.value / close) * 100,
    };
  });
}

/**
 * Check if a stock passes the ATR filter
 *
 * Stocks with low ATR% (low relative volatility) are filtered out because
 * trend-following strategies like GC + Volume signals don't work well
 * when price movements are too small.
 *
 * @param candles - Array of candles
 * @param options - Filter options
 * @returns Filter result with pass/fail and ATR% value
 *
 * @example
 * ```ts
 * const result = passesAtrFilter(candles);
 * if (result.passes) {
 *   console.log(`Stock suitable for trend-following (ATR%: ${result.atrPercent.toFixed(2)}%)`);
 * } else {
 *   console.log(`Stock too low volatility (ATR%: ${result.atrPercent.toFixed(2)}%)`);
 * }
 * ```
 */
export function passesAtrFilter(
  candles: Candle[] | NormalizedCandle[],
  options: AtrFilterOptions = {},
): AtrFilterResult {
  const { threshold = DEFAULT_ATR_THRESHOLD, ...calcOptions } = options;

  const atrPercent = calculateAtrPercent(candles, calcOptions);

  return {
    passes: atrPercent >= threshold,
    atrPercent,
    threshold,
  };
}

/**
 * Filter multiple stocks based on ATR%
 *
 * @param stocksData - Map of ticker to candles
 * @param options - Filter options
 * @returns Object with passing and failing stocks
 *
 * @example
 * ```ts
 * const stocks = {
 *   '6758.T': sonyCandles,
 *   '7203.T': toyotaCandles,
 * };
 *
 * const { passing, failing } = filterStocksByAtr(stocks);
 * console.log('Suitable stocks:', passing.map(s => s.ticker));
 * ```
 */
export function filterStocksByAtr(
  stocksData: Record<string, Candle[] | NormalizedCandle[]>,
  options: AtrFilterOptions = {},
): {
  passing: Array<{ ticker: string; atrPercent: number }>;
  failing: Array<{ ticker: string; atrPercent: number }>;
} {
  const passing: Array<{ ticker: string; atrPercent: number }> = [];
  const failing: Array<{ ticker: string; atrPercent: number }> = [];

  for (const [ticker, candles] of Object.entries(stocksData)) {
    const result = passesAtrFilter(candles, options);

    if (result.passes) {
      passing.push({ ticker, atrPercent: result.atrPercent });
    } else {
      failing.push({ ticker, atrPercent: result.atrPercent });
    }
  }

  // Sort by ATR% descending
  passing.sort((a, b) => b.atrPercent - a.atrPercent);
  failing.sort((a, b) => b.atrPercent - a.atrPercent);

  return { passing, failing };
}
