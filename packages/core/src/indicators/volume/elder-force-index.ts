/**
 * Elder's Force Index
 *
 * Measures the force behind price movements by combining
 * price change and volume, smoothed with EMA.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { ELDER_FORCE_INDEX_META } from "../indicator-meta";

/**
 * Elder's Force Index options
 */
export type ElderForceIndexOptions = {
  /** EMA smoothing period (default: 13) */
  period?: number;
};

/**
 * Calculate Elder's Force Index
 *
 * Force Index = (Close - Previous Close) × Volume
 * Then smoothed with an EMA of the specified period.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of smoothed Force Index values
 *
 * @example
 * ```ts
 * const efi = elderForceIndex(candles, { period: 13 });
 * ```
 */
export function elderForceIndex(
  candles: Candle[] | NormalizedCandle[],
  options: ElderForceIndexOptions = {},
): Series<number | null> {
  const { period = 13 } = options;

  if (period < 1) {
    throw new Error("Elder Force Index period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Step 1: Calculate raw Force Index
  const rawForce: number[] = new Array(normalized.length);
  rawForce[0] = 0;
  for (let i = 1; i < normalized.length; i++) {
    rawForce[i] = (normalized[i].close - normalized[i - 1].close) * normalized[i].volume;
  }

  // Step 2: Smooth with EMA
  const multiplier = 2 / (period + 1);
  const result: Series<number | null> = [];

  let sum = 0;
  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      sum += rawForce[i];
      result.push({ time: normalized[i].time, value: null });
    } else if (i === period - 1) {
      sum += rawForce[i];
      const seed = sum / period;
      result.push({ time: normalized[i].time, value: seed });
    } else {
      const prev = result[i - 1].value as number;
      const emaVal = rawForce[i] * multiplier + prev * (1 - multiplier);
      result.push({ time: normalized[i].time, value: emaVal });
    }
  }

  return tagSeries(result, withLabelParams(ELDER_FORCE_INDEX_META, [period]));
}
