/**
 * Ease of Movement (EMV)
 *
 * Measures the relationship between price change and volume,
 * indicating how easily price moves.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
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

  return result;
}
