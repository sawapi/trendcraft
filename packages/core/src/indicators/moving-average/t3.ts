/**
 * Tillson T3 Moving Average
 *
 * T3 is an ultra-smooth moving average using a six-fold EMA application
 * with a volume factor. It provides minimal lag while being extremely smooth.
 * The Generalized Double EMA (GD) is: GD(n) = EMA(n) * (1+v) - EMA(EMA(n)) * v
 * T3 = GD(GD(GD(n)))
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * T3 options
 */
export type T3Options = {
  /** EMA period (default: 5) */
  period?: number;
  /** Volume factor controlling smoothness vs lag (default: 0.7) */
  vFactor?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Tillson T3 Moving Average
 *
 * T3 applies 6 cascaded EMAs with coefficients derived from the volume factor:
 * c1 = -v^3
 * c2 = 3v^2 + 3v^3
 * c3 = -6v^2 - 3v - 3v^3
 * c4 = 1 + 3v + v^3 + 3v^2
 * T3 = c1*e6 + c2*e5 + c3*e4 + c4*e3
 *
 * Note: T3 requires `6 * (period - 1)` bars of warmup before the first
 * non-null value is produced (e.g., period=5 → first value at index 24).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - T3 options
 * @returns Series of T3 values
 *
 * @example
 * ```ts
 * const t3Data = t3(candles); // Default T3(5, 0.7)
 * const t3Custom = t3(candles, { period: 8, vFactor: 0.7 });
 * ```
 */
export function t3(
  candles: Candle[] | NormalizedCandle[],
  options: T3Options = {},
): Series<number | null> {
  const { period = 5, vFactor = 0.7, source = "close" } = options;

  if (period < 1) {
    throw new Error("T3 period must be at least 1");
  }
  if (!Number.isInteger(period)) {
    throw new Error("T3 period must be an integer");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Extract prices
  const prices = normalized.map((c) => getPrice(c, source));

  // Calculate 6 cascaded EMAs
  const e1 = calcEma(prices, period);
  const e2 = calcEma(e1, period);
  const e3 = calcEma(e2, period);
  const e4 = calcEma(e3, period);
  const e5 = calcEma(e4, period);
  const e6 = calcEma(e5, period);

  // T3 coefficients from volume factor
  const v = vFactor;
  const c1 = -(v * v * v);
  const c2 = 3 * v * v + 3 * v * v * v;
  const c3 = -6 * v * v - 3 * v - 3 * v * v * v;
  const c4 = 1 + 3 * v + v * v * v + 3 * v * v;

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (e6[i] === null) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      const t3Value = c1 * (e6[i] ?? 0) + c2 * (e5[i] ?? 0) + c3 * (e4[i] ?? 0) + c4 * (e3[i] ?? 0);
      result.push({ time: normalized[i].time, value: t3Value });
    }
  }

  return result;
}

/**
 * Internal EMA calculation on a raw number array.
 * Returns null for the initial warmup period.
 */
function calcEma(data: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  const multiplier = 2 / (period + 1);

  // Find the first non-null index to maintain proper time-series alignment
  let startIdx = 0;
  while (startIdx < data.length && data[startIdx] === null) {
    startIdx++;
  }

  if (startIdx >= data.length) return result;

  let prevEma: number | null = null;
  let count = 0;
  let sum = 0;

  for (let i = startIdx; i < data.length; i++) {
    const val = data[i];
    if (val === null) {
      // After valid values start, null should not appear in cascaded EMAs;
      // stop processing to avoid misaligned seeds
      break;
    }

    if (prevEma === null) {
      count++;
      sum += val;
      if (count === period) {
        prevEma = sum / period;
        result[i] = prevEma;
      }
    } else {
      prevEma = val * multiplier + prevEma * (1 - multiplier);
      result[i] = prevEma;
    }
  }

  return result;
}
