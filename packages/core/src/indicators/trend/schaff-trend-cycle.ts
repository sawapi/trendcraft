/**
 * Schaff Trend Cycle (STC) indicator
 *
 * Combines MACD with a Stochastic oscillator to create a faster,
 * more accurate trend cycle indicator.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * Schaff Trend Cycle options
 */
export type SchaffTrendCycleOptions = {
  /** MACD fast period (default: 23) */
  fastPeriod?: number;
  /** MACD slow period (default: 50) */
  slowPeriod?: number;
  /** Stochastic cycle period (default: 10) */
  cyclePeriod?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Schaff Trend Cycle
 *
 * 1. Calculate MACD line (fast EMA - slow EMA)
 * 2. Apply Stochastic on MACD (first stochastic pass)
 * 3. Apply Stochastic again on the result (second stochastic pass)
 * 4. Result is bounded between 0-100
 *
 * Interpretation:
 * - Above 75: Overbought / uptrend
 * - Below 25: Oversold / downtrend
 * - Crossings of 25 and 75 signal trend changes
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - STC options
 * @returns Series of STC values (0-100, null for insufficient data)
 *
 * @example
 * ```ts
 * const stc = schaffTrendCycle(candles);
 * const isBullish = stc[i].value !== null && stc[i].value! > 75;
 * ```
 */
export function schaffTrendCycle(
  candles: Candle[] | NormalizedCandle[],
  options: SchaffTrendCycleOptions = {},
): Series<number | null> {
  const { fastPeriod = 23, slowPeriod = 50, cyclePeriod = 10, source = "close" } = options;

  if (fastPeriod < 1 || slowPeriod < 1 || cyclePeriod < 1) {
    throw new Error("Schaff Trend Cycle periods must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const prices = normalized.map((c) => getPrice(c, source));

  // Calculate fast and slow EMA
  function calcEma(values: number[], period: number): (number | null)[] {
    const emaArr: (number | null)[] = [];
    const mult = 2 / (period + 1);
    let prev: number | null = null;

    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        emaArr.push(null);
      } else if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += values[j];
        prev = sum / period;
        emaArr.push(prev);
      } else {
        prev = values[i] * mult + (prev ?? 0) * (1 - mult);
        emaArr.push(prev);
      }
    }
    return emaArr;
  }

  const fastEma = calcEma(prices, fastPeriod);
  const slowEma = calcEma(prices, slowPeriod);

  // MACD line
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (fastEma[i] === null || slowEma[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push((fastEma[i] as number) - (slowEma[i] as number));
    }
  }

  // Apply exponentially smoothed stochastic to a nullable series
  function stochSmooth(input: (number | null)[]): (number | null)[] {
    const smoothFactor = 0.5;
    const output: (number | null)[] = new Array(input.length).fill(null);
    let prevSmoothed = 0;

    for (let i = 0; i < input.length; i++) {
      if (input[i] === null) continue;

      let highest = Number.NEGATIVE_INFINITY;
      let lowest = Number.POSITIVE_INFINITY;
      let valid = true;

      for (let j = i - cyclePeriod + 1; j <= i; j++) {
        if (j < 0 || input[j] === null) {
          valid = false;
          break;
        }
        highest = Math.max(highest, input[j] as number);
        lowest = Math.min(lowest, input[j] as number);
      }

      if (!valid) continue;

      const range = highest - lowest;
      const rawStoch = range > 0 ? (((input[i] as number) - lowest) / range) * 100 : prevSmoothed;
      prevSmoothed = prevSmoothed + smoothFactor * (rawStoch - prevSmoothed);
      output[i] = prevSmoothed;
    }

    return output;
  }

  const stoch1 = stochSmooth(macdLine);
  const stoch2 = stochSmooth(stoch1);

  const result: Series<number | null> = [];
  for (let i = 0; i < normalized.length; i++) {
    result.push({
      time: normalized[i].time,
      value: stoch2[i],
    });
  }

  return tagSeries(
    result,
    withLabelParams({ overlay: false, label: "STC", yRange: [0, 100], referenceLines: [25, 75] }, [
      fastPeriod,
      slowPeriod,
      cyclePeriod,
    ]),
  );
}
