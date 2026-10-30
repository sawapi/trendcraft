/**
 * Median Price, Typical Price, and Weighted Close indicators
 *
 * These are basic price transform indicators used as inputs for other indicators.
 */

import { ensureNormalized } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import type { SeriesMeta } from "../../types/candle";

/** Series metadata for `medianPrice`. */
export const MEDIAN_PRICE_META: SeriesMeta = {
  kind: "medianPrice",
  overlay: true,
  label: "Median Price",
};

/** Series metadata for `typicalPrice`. */
export const TYPICAL_PRICE_META: SeriesMeta = {
  kind: "typicalPrice",
  overlay: true,
  label: "Typical Price",
};

/** Series metadata for `weightedClose`. */
export const WEIGHTED_CLOSE_META: SeriesMeta = {
  kind: "weightedClose",
  overlay: true,
  label: "Weighted Close",
};

/**
 * Calculate Median Price
 *
 * Median Price = (High + Low) / 2
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of median price values
 *
 * @example
 * ```ts
 * const mp = medianPrice(candles);
 * ```
 */
export function medianPrice(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = ensureNormalized(candles);
  return tagSeries(
    normalized.map((c) => ({
      time: c.time,
      value: (c.high + c.low) / 2,
    })),
    MEDIAN_PRICE_META,
  );
}

/**
 * Calculate Typical Price
 *
 * Typical Price = (High + Low + Close) / 3
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of typical price values
 *
 * @example
 * ```ts
 * const tp = typicalPrice(candles);
 * ```
 */
export function typicalPrice(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = ensureNormalized(candles);
  return tagSeries(
    normalized.map((c) => ({
      time: c.time,
      value: (c.high + c.low + c.close) / 3,
    })),
    TYPICAL_PRICE_META,
  );
}

/**
 * Calculate Weighted Close
 *
 * Weighted Close = (High + Low + Close × 2) / 4
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of weighted close values
 *
 * @example
 * ```ts
 * const wc = weightedClose(candles);
 * ```
 */
export function weightedClose(candles: Candle[] | NormalizedCandle[]): Series<number> {
  const normalized = ensureNormalized(candles);
  return tagSeries(
    normalized.map((c) => ({
      time: c.time,
      value: (c.high + c.low + c.close * 2) / 4,
    })),
    WEIGHTED_CLOSE_META,
  );
}
