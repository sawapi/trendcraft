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
  /**
   * Volume scaling divisor (default: `100_000_000`, matching StockCharts /
   * ChartSchool canonical EMV). Smaller-volume instruments may want a
   * smaller divisor to keep the values from collapsing toward zero — pass
   * the divisor that produces readable magnitudes for your data.
   */
  volumeDivisor?: number;
};

/**
 * Calculate Ease of Movement
 *
 * EMV = ((H+L)/2 - (prevH+prevL)/2) / ((Volume/divisor) / (H-L))
 * Then smoothed with SMA.
 *
 * The default `volumeDivisor` is `100_000_000` (100M), matching the
 * StockCharts / ChartSchool canonical EMV scaling. With this default,
 * trendcraft's EMV values can be compared directly against any reference
 * implementation — Bulkowski, Yahoo Finance, TradingView's `Ease of
 * Movement`, etc.
 *
 * If you previously relied on the legacy `volumeDivisor: 10000` default
 * (which produced ~10000× larger values), pass it explicitly:
 *
 * ```ts
 * // Pre-canonical (legacy) scaling
 * const emv = easeOfMovement(candles, { period: 14, volumeDivisor: 10000 });
 * ```
 *
 * For trading-decision use cases the **sign** and **slope** of EMV are
 * what matters, and both are invariant to `volumeDivisor`.
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
  const { period = 14 } = options;
  // Use `??` rather than a destructuring default so an explicit
  // `volumeDivisor: null` (common after JSON / form deserialization of
  // unset optional fields) still falls back to the canonical default.
  // Without this guard `null` slips through and `c.volume / null` makes
  // boxRatio infinite, collapsing every EMV value to zero.
  const volumeDivisor = options.volumeDivisor ?? 100_000_000;

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
