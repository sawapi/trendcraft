/**
 * Mass Index indicator
 *
 * Identifies trend reversals by measuring the narrowing and widening
 * of the range between high and low prices.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Mass Index options
 */
export type MassIndexOptions = {
  /** EMA period for range smoothing (default: 9) */
  emaPeriod?: number;
  /** Summation period (default: 25) */
  sumPeriod?: number;
};

/**
 * Calculate Mass Index
 *
 * 1. Single EMA = EMA(High - Low, emaPeriod)
 * 2. Double EMA = EMA(Single EMA, emaPeriod)
 * 3. EMA Ratio = Single EMA / Double EMA
 * 4. Mass Index = SUM(EMA Ratio, sumPeriod)
 *
 * Interpretation:
 * - "Reversal Bulge" occurs when Mass Index rises above 27 and then drops below 26.5
 * - This signals a potential trend reversal
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Mass Index options
 * @returns Series of Mass Index values (null for insufficient data)
 *
 * @example
 * ```ts
 * const mi = massIndex(candles);
 * const reversalBulge = mi[i].value !== null && mi[i].value! > 27;
 * ```
 */
export function massIndex(
  candles: Candle[] | NormalizedCandle[],
  options: MassIndexOptions = {},
): Series<number | null> {
  const { emaPeriod = 9, sumPeriod = 25 } = options;

  if (emaPeriod < 1 || sumPeriod < 1) {
    throw new Error("Mass Index periods must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const multiplier = 2 / (emaPeriod + 1);

  function computeEma(values: (number | null)[]): (number | null)[] {
    const emaResult: (number | null)[] = [];
    let prev: number | null = null;
    let validCount = 0;
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
      if (values[i] === null) {
        emaResult.push(null);
        continue;
      }

      validCount++;
      const val = values[i] as number;

      if (validCount < emaPeriod) {
        sum += val;
        emaResult.push(null);
      } else if (validCount === emaPeriod) {
        sum += val;
        prev = sum / emaPeriod;
        emaResult.push(prev);
      } else {
        prev = val * multiplier + (prev ?? 0) * (1 - multiplier);
        emaResult.push(prev);
      }
    }

    return emaResult;
  }

  const ranges: (number | null)[] = normalized.map((c) => c.high - c.low);
  const singleEma = computeEma(ranges);
  const doubleEma = computeEma(singleEma);

  // Calculate EMA ratio
  const ratios: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (singleEma[i] === null || doubleEma[i] === null || doubleEma[i] === 0) {
      ratios.push(null);
    } else {
      ratios.push((singleEma[i] as number) / (doubleEma[i] as number));
    }
  }

  // Sum of ratios over sumPeriod
  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (ratios[i] === null) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let sum = 0;
    let valid = true;
    for (let j = i - sumPeriod + 1; j <= i; j++) {
      if (j < 0 || ratios[j] === null) {
        valid = false;
        break;
      }
      sum += ratios[j] as number;
    }

    result.push({ time: normalized[i].time, value: valid ? sum : null });
  }

  return tagSeries(result, { overlay: false, label: "Mass Index", referenceLines: [27, 26.5] });
}
