/**
 * Hull Moving Average (HMA) indicator
 *
 * HMA reduces lag while maintaining smoothness by using weighted moving averages.
 * Formula: HMA(n) = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { wma } from "./wma";

/**
 * HMA options
 */
export type HmaOptions = {
  /** Period for HMA calculation (default: 9) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Hull Moving Average
 *
 * HMA = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
 *
 * Steps:
 * 1. Calculate WMA with period n/2
 * 2. Calculate WMA with period n
 * 3. Compute 2 * WMA(n/2) - WMA(n) for each point
 * 4. Apply WMA with period sqrt(n) to the result
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - HMA options (period, source)
 * @returns Series of HMA values (null for insufficient data)
 *
 * @example
 * ```ts
 * const hma9 = hma(candles); // Default period 9
 * const hma20 = hma(candles, { period: 20 });
 * ```
 */
export function hma(
  candles: Candle[] | NormalizedCandle[],
  options: HmaOptions = {},
): Series<number | null> {
  const { period = 9, source = "close" } = options;

  if (period < 2) {
    throw new Error("HMA period must be at least 2");
  }
  if (!Number.isInteger(period)) {
    throw new Error("HMA period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  // Step 1 & 2: Calculate WMA(n/2) and WMA(n)
  const wmaHalf = wma(normalized, { period: halfPeriod, source });
  const wmaFull = wma(normalized, { period, source });

  // Step 3: Compute 2 * WMA(n/2) - WMA(n) — create synthetic candles for final WMA
  const diffCandles: NormalizedCandle[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const halfVal = wmaHalf[i]?.value;
    const fullVal = wmaFull[i]?.value;

    if (halfVal != null && fullVal != null) {
      const diffValue = 2 * halfVal - fullVal;
      diffCandles.push({
        time: normalized[i].time,
        open: diffValue,
        high: diffValue,
        low: diffValue,
        close: diffValue,
        volume: 0,
      });
    }
  }

  // Step 4: Apply WMA(sqrt(n)) to the diff series
  if (diffCandles.length === 0) {
    return normalized.map((c) => ({ time: c.time, value: null }));
  }

  const finalWma = wma(diffCandles, { period: sqrtPeriod });

  // Map back to original timeline
  const result: Series<number | null> = [];
  // Number of leading nulls = candles where either wmaHalf or wmaFull was null
  const diffStartIndex = normalized.length - diffCandles.length;

  for (let i = 0; i < normalized.length; i++) {
    const diffIdx = i - diffStartIndex;
    if (diffIdx < 0 || diffIdx >= finalWma.length || finalWma[diffIdx].value === null) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      result.push({ time: normalized[i].time, value: finalWma[diffIdx].value });
    }
  }

  return tagSeries(result, { overlay: true, label: "HMA" });
}
