/**
 * Elder's Force Index
 *
 * Measures the force behind price movements by combining
 * price change and volume, smoothed with two EMAs (short for entry
 * timing, long for trend bias) — the canonical pairing recommended
 * by Alexander Elder in *Trading for a Living* and *The New Sell &
 * Sellshort*.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { ELDER_FORCE_INDEX_META } from "../indicator-meta";

/**
 * Elder's Force Index options
 */
export type ElderForceIndexOptions = {
  /**
   * Short EMA period for entry timing (default: 2). Elder uses the
   * 2-period FI to find pullback entries — crossing below zero in an
   * uptrend = buy, crossing above zero in a downtrend = short.
   */
  shortPeriod?: number;
  /**
   * Long EMA period for trend confirmation (default: 13). Elder uses
   * the 13-period FI to read intermediate-trend bias — persistent
   * positive readings = bullish, persistent negative = bearish.
   */
  longPeriod?: number;
};

/**
 * Elder's Force Index value: both periods of the canonical pair.
 */
export type ElderForceIndexValue = {
  /** Short-period EMA of `(Δclose * volume)`, or `null` until warm-up. */
  short: number | null;
  /** Long-period EMA of `(Δclose * volume)`, or `null` until warm-up. */
  long: number | null;
};

/**
 * Calculate Elder's Force Index
 *
 * Force Index(1) = (Close − Previous Close) × Volume.
 * Each emitted bar carries the `short`-period and `long`-period EMA
 * of FI(1). Default periods are Elder's canonical pair: short=2,
 * long=13.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Short / long EMA periods
 * @returns Series of `{ short, long }` Force Index values
 *
 * @example
 * ```ts
 * const fi = elderForceIndex(candles); // canonical 2 / 13
 * const last = fi[fi.length - 1].value;
 * if (last.long != null && last.long > 0 && last.short != null && last.short < 0) {
 *   // Long FI bullish + short FI dipped below zero = pullback-buy setup
 * }
 * ```
 */
export function elderForceIndex(
  candles: Candle[] | NormalizedCandle[],
  options: ElderForceIndexOptions = {},
): Series<ElderForceIndexValue> {
  const shortPeriod = options.shortPeriod ?? 2;
  const longPeriod = options.longPeriod ?? 13;

  if (shortPeriod < 1) {
    throw new Error("Elder Force Index shortPeriod must be at least 1");
  }
  if (longPeriod < 1) {
    throw new Error("Elder Force Index longPeriod must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Step 1: Raw FI(1)
  const rawForce: number[] = new Array(normalized.length);
  rawForce[0] = 0;
  for (let i = 1; i < normalized.length; i++) {
    rawForce[i] = (normalized[i].close - normalized[i - 1].close) * normalized[i].volume;
  }

  // Step 2: Two EMAs in parallel
  const shortValues = emaOfRaw(rawForce, shortPeriod);
  const longValues = emaOfRaw(rawForce, longPeriod);

  const result: Series<ElderForceIndexValue> = new Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    result[i] = {
      time: normalized[i].time,
      value: { short: shortValues[i], long: longValues[i] },
    };
  }

  return tagSeries(result, withLabelParams(ELDER_FORCE_INDEX_META, [shortPeriod, longPeriod]));
}

/**
 * EMA over a numeric series, seeded with the SMA of the first `period`
 * samples. Returns `null` for the first `period - 1` indices so callers
 * know the EMA hasn't warmed up yet.
 */
function emaOfRaw(values: readonly number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0) return result;

  const multiplier = 2 / (period + 1);
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sum += values[i];
      continue;
    }
    if (i === period - 1) {
      sum += values[i];
      result[i] = sum / period;
      continue;
    }
    const prev = result[i - 1] as number;
    result[i] = values[i] * multiplier + prev * (1 - multiplier);
  }

  return result;
}
