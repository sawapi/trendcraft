/**
 * Ease of Movement (EMV)
 *
 * Measures the relationship between price change and volume,
 * indicating how easily price moves.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Ease of Movement options
 */
export type EaseOfMovementOptions = {
  /** SMA smoothing period (default: 14) */
  period?: number;
  /** Volume divisor to scale values (default: 10000) */
  volumeDivisor?: number;
};

/**
 * Calculate Ease of Movement
 *
 * EMV = ((H+L)/2 - (prevH+prevL)/2) / ((Volume/divisor) / (H-L))
 * Then smoothed with SMA.
 *
 * Note on `volumeDivisor`: trendcraft's default is `10000`, which makes
 * EMV values comparable across small-volume instruments. The canonical
 * StockCharts / ChartSchool reference uses `100_000_000` (100M), which
 * scales EMV down by ~10000× and is the value to pass when comparing
 * directly to charting platform references:
 *
 * ```ts
 * // Match StockCharts / ChartSchool reference values
 * const emv = easeOfMovement(candles, { period: 14, volumeDivisor: 100_000_000 });
 * ```
 *
 * For trading-decision use cases the **sign** and **slope** of EMV are
 * what matters, and both are invariant to `volumeDivisor`. The default
 * is preserved for backward compatibility through the 0.x line; a future
 * major bump may switch to the canonical 100M.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of EMV values
 *
 * @example
 * ```ts
 * const emv = easeOfMovement(candles, { period: 14 });
 * ```
 */
export function easeOfMovement(
  candles: Candle[] | NormalizedCandle[],
  options: EaseOfMovementOptions = {},
): Series<number | null> {
  const { period = 14, volumeDivisor = 10000 } = options;

  if (period < 1) {
    throw new Error("EMV period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Step 1: Calculate raw EMV values
  const rawEmv: (number | null)[] = [];
  rawEmv.push(null); // i=0: no previous bar

  for (let i = 1; i < normalized.length; i++) {
    const c = normalized[i];
    const p = normalized[i - 1];
    const hl = c.high - c.low;

    if (hl === 0 || c.volume === 0) {
      rawEmv.push(null);
      continue;
    }

    const distanceMoved = (c.high + c.low) / 2 - (p.high + p.low) / 2;
    const boxRatio = c.volume / volumeDivisor / hl;
    rawEmv.push(distanceMoved / boxRatio);
  }

  // Step 2: SMA smoothing
  const result: Series<number | null> = [];
  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      // Not enough data yet for SMA
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Calculate SMA of raw EMV values in window [i-period+1, i]
    let sum = 0;
    let validCount = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (rawEmv[j] !== null) {
        sum += rawEmv[j] as number;
        validCount++;
      }
    }

    result.push({
      time: normalized[i].time,
      value: validCount === period ? sum / period : null,
    });
  }

  return tagSeries(
    result,
    withLabelParams({ overlay: false, label: "EMV", referenceLines: [0] }, [period]),
  );
}
