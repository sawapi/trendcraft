/**
 * Balance of Power (BOP) indicator
 *
 * Measures the strength of buyers vs sellers by comparing the close
 * relative to the open against the full range.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * BOP options
 */
export type BalanceOfPowerOptions = {
  /** Smoothing period (SMA, default: 14, set to 1 for raw) */
  smoothPeriod?: number;
};

/**
 * Calculate Balance of Power
 *
 * BOP = (Close - Open) / (High - Low)
 * Smoothed BOP = SMA(BOP, smoothPeriod)
 *
 * Interpretation:
 * - Positive BOP: Buyers are stronger
 * - Negative BOP: Sellers are stronger
 * - Values range from -1 to +1
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - BOP options
 * @returns Series of BOP values (-1 to +1, null for insufficient data)
 *
 * @example
 * ```ts
 * const bop = balanceOfPower(candles);
 * const isBullish = bop[i].value !== null && bop[i].value! > 0;
 * ```
 */
export function balanceOfPower(
  candles: Candle[] | NormalizedCandle[],
  options: BalanceOfPowerOptions = {},
): Series<number | null> {
  const { smoothPeriod = 14 } = options;

  if (smoothPeriod < 1) {
    throw new Error("BOP smooth period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  // Calculate raw BOP
  const rawBop: number[] = normalized.map((c) => {
    const range = c.high - c.low;
    return range > 0 ? (c.close - c.open) / range : 0;
  });

  // Apply SMA smoothing
  for (let i = 0; i < normalized.length; i++) {
    if (i < smoothPeriod - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let sum = 0;
    for (let j = i - smoothPeriod + 1; j <= i; j++) {
      sum += rawBop[j];
    }

    result.push({ time: normalized[i].time, value: sum / smoothPeriod });
  }

  return tagSeries(
    result,
    withLabelParams({ overlay: false, label: "BOP", yRange: [-1, 1], referenceLines: [0] }, [
      smoothPeriod,
    ]),
  );
}
