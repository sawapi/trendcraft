/**
 * Average True Range (ATR) indicator
 * Uses Wilder's smoothing method
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { AtrOptions, Candle, NormalizedCandle, Series } from "../../types";

/**
 * Calculate Average True Range using Wilder's method
 *
 * True Range = max(
 *   High - Low,
 *   |High - Previous Close|,
 *   |Low - Previous Close|
 * )
 *
 * ATR = Wilder's smoothed average of True Range
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - ATR options (period=14)
 * @returns Series of ATR values
 *
 * @example
 * ```ts
 * const atr14 = atr(candles);
 * const atr7 = atr(candles, { period: 7 });
 * ```
 */
export function atr(
  candles: Candle[] | NormalizedCandle[],
  options: AtrOptions = {},
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 1) {
    throw new Error("ATR period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];

  // Calculate True Range for each candle
  const trueRanges: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];

    if (i === 0) {
      // First candle: TR = High - Low
      trueRanges.push(current.high - current.low);
    } else {
      const prevClose = normalized[i - 1].close;
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - prevClose),
        Math.abs(current.low - prevClose),
      );
      trueRanges.push(tr);
    }
  }

  // Calculate ATR using Wilder's smoothing
  let prevAtr: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      // Not enough data
      result.push({ time: normalized[i].time, value: null });
    } else if (i === period - 1) {
      // First ATR is simple average of first `period` TRs
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += trueRanges[j];
      }
      prevAtr = sum / period;
      result.push({ time: normalized[i].time, value: prevAtr });
    } else {
      // Wilder's smoothing: ATR = ((Previous ATR * (period - 1)) + Current TR) / period
      // prevAtr is guaranteed to be non-null here since we set it in the i === period - 1 branch
      prevAtr = (prevAtr as number) * (period - 1) + trueRanges[i];
      prevAtr = prevAtr / period;
      result.push({ time: normalized[i].time, value: prevAtr });
    }
  }

  return result;
}
